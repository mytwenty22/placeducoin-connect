import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPinOff } from "lucide-react";
import type { CommerceListing } from "@/lib/placeducoin-data";
import type { LatLng } from "@/lib/geo";
import { formatEventDate } from "@/lib/event-date";
import { fetchCommuneCenter, geocodeAddresses } from "@/lib/map-geocode";

export type MapCommerce = CommerceListing & { position?: LatLng };

type Leaflet = typeof import("leaflet");

function destination(c: CommerceListing) {
  return c.premium ? `/site/${c.slug}` : `/commerce/${c.slug}`;
}

// Pop-up construit en DOM (textContent) : noms et titres viennent des commerçants, jamais
// injectés comme HTML.
function popupContent(c: CommerceListing, onOpen: (href: string) => void) {
  const root = document.createElement("div");
  root.className = "min-w-[180px] max-w-[240px] font-sans";

  const name = document.createElement("p");
  name.className = "font-display text-base font-extrabold leading-tight text-navy";
  name.textContent = c.shop;
  root.append(name);

  const trade = document.createElement("p");
  trade.className = "text-xs text-slate-500";
  trade.textContent = c.trade;
  root.append(trade);

  const rating = document.createElement("p");
  rating.className = "mt-1 text-xs font-semibold text-slate-700";
  rating.textContent =
    c.googleRating != null
      ? `★ ${c.googleRating.toFixed(1).replace(".", ",")}${c.googleReviewCount ? ` (${c.googleReviewCount} avis)` : ""}`
      : "Pas encore de note";
  root.append(rating);

  const offer = c.promos.find((p) => p.kind !== "evenement") ?? c.promos[0];
  const box = document.createElement("p");
  if (offer) {
    box.className = "mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700";
    const price =
      offer.priceNow !== undefined
        ? ` — ${offer.priceNow === 0 ? "Offert" : `${offer.priceNow.toFixed(2).replace(".", ",")} €`}`
        : "";
    box.textContent =
      offer.kind === "evenement" && offer.eventDate
        ? `📅 ${offer.title} · ${formatEventDate(offer.eventDate)}`
        : `🔥 ${offer.title}${price}`;
  } else {
    box.className = "mt-2 text-xs text-slate-500";
    box.textContent = "Aucune offre en cours";
  }
  root.append(box);

  const link = document.createElement("a");
  const href = destination(c);
  link.href = href;
  link.className = "mt-2 inline-block text-xs font-bold text-navy underline";
  link.textContent = c.premium ? "Voir le site →" : "Voir la fiche →";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpen(href);
  });
  root.append(link);
  return root;
}

function markerIcon(L: Leaflet, c: CommerceListing) {
  const hasOffer = c.promos.length > 0;
  const color = hasOffer ? "var(--promo)" : "var(--navy)";
  const size = c.sponsored ? 38 : 30;
  const glyph = c.sponsored ? "★" : hasOffer ? "%" : "";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 4px 10px rgb(15 23 42 / .35)"><span style="transform:rotate(45deg);color:#fff;font:800 ${c.sponsored ? 15 : 12}px/1 sans-serif">${glyph}</span></span>`,
  });
}

/**
 * Carte OpenStreetMap (Leaflet) des fiches affichées : un marqueur par commerce/association
 * localisé, recalculé à chaque changement de ville, de quartier, de catégorie ou de recherche.
 * Rouge = offre en cours, étoile = En Vedette ; clic = nom, note et offre active.
 */
export type MapBounds = { south: number; west: number; north: number; east: number };

export function CommerceMap({
  commerces,
  inseeCode,
  fitKey,
  onUserMove,
  className = "",
}: {
  /** `inseeCode` par fiche : sa commune, quand elle diffère de la ville affichée (exploration). */
  commerces: (CommerceListing & {
    latitude?: number | null;
    longitude?: number | null;
    inseeCode?: string | null;
  })[];
  inseeCode: string | null;
  /**
   * Identifie la liste "principale" (ville, quartier, filtres) : la carte se recadre sur ses
   * marqueurs quand cette clé change, mais plus jamais de force une fois que le visiteur a
   * déplacé ou zoomé la carte lui-même.
   */
  fitKey: string;
  /** Zone visible après un déplacement ou un zoom fait par le visiteur. */
  onUserMove?: (bounds: MapBounds) => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const [leaflet, setLeaflet] = useState<Leaflet | null>(null);
  // Le visiteur a pris la main sur la carte depuis le dernier changement de fitKey.
  const userMovedRef = useRef(false);
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;
  useEffect(() => {
    userMovedRef.current = false;
  }, [fitKey]);

  // Adresses à géocoder : uniquement les fiches sans position GPS enregistrée, regroupées par
  // commune (chaque adresse est cherchée dans SA commune, jamais dans la ville affichée).
  const toGeocode = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    for (const c of commerces) {
      const address = c.address.trim();
      const insee = c.inseeCode ?? inseeCode;
      if ((c.latitude != null && c.longitude != null) || !address || !insee) continue;
      if (!groups.has(insee)) groups.set(insee, new Set());
      groups.get(insee)!.add(address);
    }
    return [...groups.entries()]
      .map(([insee, addresses]) => [insee, [...addresses].sort()] as const)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [commerces, inseeCode]);

  const geocodeQuery = useQuery({
    queryKey: ["map-geocode", toGeocode],
    queryFn: async () => {
      const positions = new Map<string, LatLng>();
      for (const [insee, addresses] of toGeocode) {
        const found = await geocodeAddresses(addresses, insee);
        for (const [address, position] of found) positions.set(`${insee}|${address}`, position);
      }
      return positions;
    },
    enabled: toGeocode.length > 0,
    staleTime: Infinity,
    // Garde les marqueurs déjà placés pendant le géocodage des nouvelles adresses.
    placeholderData: (previous) => previous,
  });

  const centerQuery = useQuery({
    queryKey: ["commune-center", inseeCode],
    queryFn: () => fetchCommuneCenter(inseeCode!),
    enabled: Boolean(inseeCode),
    staleTime: Infinity,
  });

  const placed = useMemo(() => {
    const result: MapCommerce[] = [];
    // Plusieurs fiches à la même adresse (même rue géocodée) : les marqueurs sont écartés en
    // cercle d'une vingtaine de mètres pour rester tous cliquables.
    const seen = new Map<string, number>();
    for (const c of commerces) {
      const position =
        c.latitude != null && c.longitude != null
          ? { lat: c.latitude, lng: c.longitude }
          : geocodeQuery.data?.get(`${c.inseeCode ?? inseeCode}|${c.address.trim()}`);
      if (!position) continue;
      const key = `${position.lat.toFixed(5)},${position.lng.toFixed(5)}`;
      const rank = seen.get(key) ?? 0;
      seen.set(key, rank + 1);
      const angle = rank * 2.4;
      const offset = rank === 0 ? 0 : 0.0002;
      result.push({
        ...c,
        position: {
          lat: position.lat + offset * Math.sin(angle),
          lng: position.lng + offset * Math.cos(angle) * 1.4,
        },
      });
    }
    return result;
  }, [commerces, geocodeQuery.data, inseeCode]);

  // Leaflet manipule window dès son import : chargé côté navigateur uniquement.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (!cancelled) setLeaflet((mod.default ?? mod) as Leaflet);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!leaflet || !containerRef.current || mapRef.current) return;
    const map = leaflet.map(containerRef.current, {
      center: [46.6, 2.4],
      zoom: 5,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      })
      .addTo(map);
    layerRef.current = leaflet.layerGroup().addTo(map);
    mapRef.current = map;

    // Geste du visiteur (glisser, boutons de zoom, double-clic, pincement) : on arrête de recadrer
    // et on signale la zone visible pour y charger les commerces, quelle que soit leur commune.
    // "dragstart"/"zoomstart" ne suffisent pas à distinguer un zoom programmatique : on marque le
    // geste au pointeur sur la carte elle-même.
    let gesture = false;
    const container = map.getContainer();
    const markGesture = () => {
      gesture = true;
    };
    container.addEventListener("pointerdown", markGesture);
    container.addEventListener("wheel", markGesture, { passive: true });
    map.on("moveend", () => {
      if (!gesture) return;
      gesture = false;
      userMovedRef.current = true;
      const b = map.getBounds();
      onUserMoveRef.current?.({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    });
    return () => {
      container.removeEventListener("pointerdown", markGesture);
      container.removeEventListener("wheel", markGesture);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [leaflet]);

  // Marqueurs et cadrage, à chaque changement de la liste affichée.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!leaflet || !map || !layer) return;
    layer.clearLayers();
    for (const c of placed) {
      leaflet
        .marker([c.position!.lat, c.position!.lng], {
          icon: markerIcon(leaflet, c),
          title: c.shop,
          zIndexOffset: c.sponsored ? 1000 : c.promos.length > 0 ? 500 : 0,
        })
        .bindPopup(() => popupContent(c, (href) => void navigate({ to: href })), {
          closeButton: true,
        })
        .addTo(layer);
    }
    // Recadrage sur la liste principale uniquement tant que le visiteur n'a pas bougé la carte :
    // les repères chargés pendant qu'il explore ne doivent pas le ramener de force sur la ville.
    if (userMovedRef.current) return;
    if (placed.length > 0) {
      const bounds = leaflet.latLngBounds(placed.map((c) => [c.position!.lat, c.position!.lng]));
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    } else if (centerQuery.data) {
      map.setView([centerQuery.data.lat, centerQuery.data.lng], 14);
    }
  }, [leaflet, placed, centerQuery.data, navigate, fitKey]);

  const unplaced = commerces.length - placed.length;
  const locating = geocodeQuery.isFetching;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border shadow-card ${className}`}
    >
      <div
        ref={containerRef}
        className="h-full w-full bg-secondary"
        role="region"
        aria-label="Carte des commerces"
      />
      {/* Légende et fiches non placées, au-dessus des tuiles (z-index Leaflet : 400). */}
      <div className="pointer-events-none absolute inset-x-2 bottom-7 z-[500] flex flex-wrap justify-between gap-2">
        <span className="rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-card">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-promo" /> Offre en cours
          <span className="ml-2 mr-1 inline-block h-2 w-2 rounded-full bg-navy" /> Commerce
        </span>
        {locating ? (
          <span className="rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-card">
            Localisation des adresses…
          </span>
        ) : unplaced > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-card">
            <MapPinOff className="h-3 w-3" /> {unplaced} fiche{unplaced > 1 ? "s" : ""} sans adresse
            précise
          </span>
        ) : null}
      </div>
    </div>
  );
}
