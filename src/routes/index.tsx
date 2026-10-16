import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, ChevronDown, Megaphone, Building2, Map as MapIcon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SponsorBanner } from "@/components/SponsorBanner";
import { BottomSponsorBanner } from "@/components/BottomSponsorBanner";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { PushOptInCard } from "@/components/PushOptIn";
import { CommerceMap } from "@/components/CommerceMap";
import { OfferCard } from "@/components/OfferCard";
import { RadiusSelector } from "@/components/RadiusSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  type CategoryKey,
  type CommerceListing,
  type PromoItem,
} from "@/lib/placeducoin-data";
import { supabase } from "@/lib/supabase";
import { normalizeSearch } from "@/lib/utils";
import { withComputedDistance } from "@/lib/geo";
import { isBoostActive } from "@/lib/boost";
import { useUserPrefs } from "@/lib/user-prefs";
import { useVedetteAlerts } from "@/hooks/use-vedette-alerts";
import { useMarketplaceRealtime } from "@/hooks/use-marketplace-realtime";
import type { Horaire } from "@/lib/horaires";
import type { ThemeVisuel } from "@/lib/site-theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SpotLocal — Toute la vie de votre quartier en un clic" },
      {
        name: "description",
        content:
          "Les promotions de vos commerçants, les événements de votre quartier et les informations officielles de votre mairie, réunis en un clic.",
      },
      { property: "og:title", content: "SpotLocal — Marketplace de quartier" },
      {
        property: "og:description",
        content: "Toute la vie de votre quartier, vos commerces et votre mairie en un clic.",
      },
    ],
  }),
  component: Marketplace,
});

type Ville = {
  id: string;
  nom: string;
  slug: string;
  codes_postaux: string[];
  insee_code: string | null;
};
type Quartier = { id: string; nom: string; code_postal: string; ville_id: string };

// Valeur de l'option "Tous les quartiers" (Radix Select n'accepte pas de valeur vide).
const ALL_QUARTIERS = "all";

const MAP_PREF_KEY = "spotlocal:home-map";
type PublicNotice = {
  id: string;
  titre: string;
  corps: string | null;
  type: "Événement" | "Travaux" | "Information";
  date_info: string | null;
};

type PromoEmbed = {
  id: string;
  titre: string;
  kind: "promo" | "arrivage" | "evenement";
  photo_url: string | null;
  prix_avant: number | null;
  prix_maintenant: number | null;
  valide_jusqu_a: string;
  created_at: string;
};
type CommerceRow = {
  id: string;
  slug: string;
  nom: string;
  trade: string;
  category: CategoryKey;
  adresse: string | null;
  telephone: string | null;
  photo_url: string | null;
  logo_url: string | null;
  description: string | null;
  horaires: Horaire[];
  theme_visuel: ThemeVisuel;
  site_actif: boolean;
  boost_actif: boolean;
  boost_expires_at: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  quartier_id: string | null;
  latitude: number | null;
  longitude: number | null;
  promos: PromoEmbed[];
};

// Une offre est encore "active" tant que sa date de fin n'est pas passée -- la requête filtre
// déjà côté serveur (`.gt("promos.valide_jusqu_a", …)`), ce second filtre ne fait que se prémunir
// d'un léger décalage d'horloge entre le moment de la requête et le rendu.
function mapPromoEmbed(row: PromoEmbed): PromoItem {
  const endsInHours = Math.max(
    0,
    Math.round((new Date(row.valide_jusqu_a).getTime() - Date.now()) / 3_600_000),
  );
  return {
    id: row.id,
    title: row.titre,
    kind: row.kind,
    ...(row.prix_avant != null ? { priceBefore: row.prix_avant } : {}),
    ...(row.prix_maintenant != null ? { priceNow: row.prix_maintenant } : {}),
    endsInHours,
    ...(row.kind === "evenement" ? { eventDate: row.valide_jusqu_a } : {}),
    ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
  };
}

// Tri des offres à l'intérieur du carrousel d'une même carte : événements après les offres à
// durée limitée, puis la plus urgente (fin la plus proche) en premier.
function sortPromos(promos: PromoEmbed[]): PromoEmbed[] {
  return [...promos].sort((a, b) => {
    const aEvent = a.kind === "evenement" ? 1 : 0;
    const bEvent = b.kind === "evenement" ? 1 : 0;
    if (aEvent !== bEvent) return aEvent - bEvent;
    return new Date(a.valide_jusqu_a).getTime() - new Date(b.valide_jusqu_a).getTime();
  });
}

function mapCommerceToListing(row: CommerceRow, fallbackCity: string): CommerceListing {
  return {
    id: row.id,
    slug: row.slug,
    shop: row.nom,
    trade: row.trade,
    category: row.category,
    city: fallbackCity,
    quartierId: row.quartier_id,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceKm: 0,
    address: row.adresse ?? "",
    phone: row.telephone ?? "",
    sponsored: isBoostActive(row),
    premium: row.site_actif,
    ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
    ...(row.logo_url ? { logoUrl: row.logo_url } : {}),
    horaires: row.horaires,
    themeVisuel: row.theme_visuel,
    ...(row.description ? { description: row.description } : {}),
    ...(row.google_rating != null ? { googleRating: row.google_rating } : {}),
    ...(row.google_review_count != null ? { googleReviewCount: row.google_review_count } : {}),
    promos: sortPromos(row.promos).map(mapPromoEmbed),
  };
}

// Hiérarchie d'affichage de la marketplace : en tête, les abonnés Site Pro (site_actif) et les
// commerces ayant payé l'option Vedette 24h (sponsored) -- les deux groupes payants partagent le
// haut du fil, les fiches gratuites sans aucune option restent en bas. Au sein du groupe payant,
// Vedette passe devant (badge rouge, option limitée dans le temps) ; un commerce avec une offre
// active en cours passe avant les autres du même rang, puis on retombe sur l'ordre alphabétique.
function sortByTier(commerces: CommerceListing[]): CommerceListing[] {
  // Groupe (0 = payant : Site Pro et/ou Vedette, 1 = gratuit sans aucune option).
  function group(c: CommerceListing): number {
    return c.sponsored || c.premium ? 0 : 1;
  }
  // Au sein du groupe payant, Vedette (badge rouge, option 24h) passe devant Site Pro seul.
  function rank(c: CommerceListing): number {
    if (c.sponsored) return 0;
    if (c.premium) return 1;
    return 2;
  }
  return [...commerces].sort((a, b) => {
    const groupDiff = group(a) - group(b);
    if (groupDiff !== 0) return groupDiff;
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const hasPromoDiff = (b.promos.length > 0 ? 1 : 0) - (a.promos.length > 0 ? 1 : 0);
    if (hasPromoDiff !== 0) return hasPromoDiff;
    return a.shop.localeCompare(b.shop, "fr");
  });
}

function matchesSearch(commerce: CommerceListing, normalizedQuery: string): boolean {
  const categoryLabel = CATEGORIES.find((c) => c.key === commerce.category)?.label ?? "";
  const fields = [
    commerce.shop,
    commerce.trade,
    categoryLabel,
    commerce.description ?? "",
    ...commerce.promos.map((p) => p.title),
  ];
  return fields.some((f) => normalizeSearch(f).includes(normalizedQuery));
}

function Marketplace() {
  const [selectedVille, setSelectedVille] = useState<Ville | null>(null);
  // Le quartier choisi est mémorisé AVEC sa ville : dès que la ville change (liste, code postal,
  // ville par défaut…), le filtre retombe de lui-même sur "Tout <ville>", sans état résiduel.
  const [quartierSelection, setQuartierSelection] = useState<{
    villeId: string;
    quartierId: string;
  } | null>(null);
  const selectedQuartierId =
    quartierSelection && quartierSelection.villeId === selectedVille?.id
      ? quartierSelection.quartierId
      : null;
  const setSelectedQuartierId = (quartierId: string | null) =>
    setQuartierSelection(
      quartierId && selectedVille ? { villeId: selectedVille.id, quartierId } : null,
    );
  const [cityQuery, setCityQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey | null>(null);
  // Carte affichée d'office sur grand écran, repliée sur mobile (la liste reste visible sous les
  // filtres) ; le choix du visiteur est mémorisé sur l'appareil.
  const [showMap, setShowMap] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(MAP_PREF_KEY);
    } catch {
      // Stockage indisponible : valeur par défaut selon la taille d'écran.
    }
    setShowMap(stored === null ? window.innerWidth >= 1024 : stored === "1");
  }, []);
  const toggleMap = () => {
    setShowMap((prev) => {
      try {
        window.localStorage.setItem(MAP_PREF_KEY, prev ? "0" : "1");
      } catch {
        // Le choix ne sera pas mémorisé.
      }
      return !prev;
    });
  };
  const { radiusKm, favoriteCategories, position } = useUserPrefs();
  const hasPosition = position !== null;

  const villesQuery = useQuery({
    queryKey: ["villes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("villes")
        .select("id, nom, slug, codes_postaux, insee_code, commerces(count)")
        .order("nom");
      if (error) throw error;
      return (data as unknown as (Ville & { commerces: { count: number }[] })[]).map(
        ({ commerces, ...v }) => ({ ...v, commerceCount: commerces[0]?.count ?? 0 }),
      );
    },
  });

  // Les villes sont désormais créées à la volée par les Pros (ensure-ville) : par défaut on ouvre
  // la commune la plus fournie plutôt que la première par ordre alphabétique.
  useEffect(() => {
    const villes = villesQuery.data ?? [];
    const busiest = villes.reduce<(typeof villes)[number] | undefined>(
      (best, v) => (!best || v.commerceCount > best.commerceCount ? v : best),
      undefined,
    );
    if (!selectedVille && busiest) {
      setSelectedVille(busiest);
    }
  }, [selectedVille, villesQuery.data]);

  const citySuggestions = useMemo(
    () =>
      (villesQuery.data ?? [])
        // Recherche par nom de commune ou par code postal (33000, 336…).
        .filter((v) => {
          const q = cityQuery.trim().toLowerCase();
          return (
            v.nom.toLowerCase().includes(q) ||
            (/^d+$/.test(q) && v.codes_postaux.some((cp) => cp.startsWith(q)))
          );
        })
        .slice(0, 6),
    [villesQuery.data, cityQuery],
  );

  const city = selectedVille?.nom ?? "";

  // Annuaire général : tous les commerces de la ville sont chargés (pas seulement ceux qui ont
  // une promo en cours), avec leurs éventuelles offres actives embarquées via `promos(…)`. Le
  // filtre `.gt("promos.valide_jusqu_a", …)` ne restreint que le tableau embarqué -- sans
  // `!inner`, PostgREST garde la ligne commerce même quand ce tableau ressort vide.
  const commercesQuery = useQuery({
    queryKey: ["commerces-marketplace", selectedVille?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commerces")
        .select(
          "id, slug, nom, trade, category, adresse, telephone, photo_url, logo_url, description, horaires, theme_visuel, site_actif, boost_actif, boost_expires_at, google_rating, google_review_count, quartier_id, latitude, longitude, promos(id, titre, kind, photo_url, prix_avant, prix_maintenant, valide_jusqu_a, created_at)",
        )
        .eq("ville_id", selectedVille?.id)
        .gt("promos.valide_jusqu_a", new Date().toISOString());
      if (error) throw error;
      return (data as unknown as CommerceRow[]).map((row) => mapCommerceToListing(row, city));
    },
    enabled: !!selectedVille,
    // L'option Vedette expire au bout de 24h sans qu'aucune écriture en base ne le déclenche :
    // un refetch périodique est nécessaire pour que l'expiration se reflète "immédiatement" même
    // sur un onglet resté ouvert (les annulations explicites, elles, arrivent par Realtime).
    refetchInterval: 30_000,
  });

  useMarketplaceRealtime();

  const commercesWithDistance = withComputedDistance(commercesQuery.data ?? [], position);
  useVedetteAlerts(commercesWithDistance, { radiusKm, favoriteCategories, hasPosition });

  const searchQuery = normalizeSearch(query);
  const isSearching = searchQuery.length > 0;

  // Tous les quartiers rattachés à la commune sélectionnée (table quartiers, créés par code postal
  // depuis les fiches), y compris ceux qui n'ont pas encore de fiche (compteur à 0).
  const quartiersQuery = useQuery({
    queryKey: ["quartiers", "marketplace", selectedVille?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quartiers")
        .select("id, nom, code_postal, ville_id")
        .eq("ville_id", selectedVille!.id)
        .order("nom");
      if (error) throw error;
      return data as Quartier[];
    },
    enabled: !!selectedVille,
  });
  const quartierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of commercesQuery.data ?? []) {
      if (c.quartierId) counts.set(c.quartierId, (counts.get(c.quartierId) ?? 0) + 1);
    }
    return counts;
  }, [commercesQuery.data]);
  const quartiers = useMemo(
    () =>
      // Filtre strict sur la ville affichée : jamais un quartier d'une autre commune, même le temps
      // que la requête de la nouvelle ville arrive.
      (quartiersQuery.data ?? [])
        .filter((q) => q.ville_id === selectedVille?.id)
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base", numeric: true })),
    [quartiersQuery.data, selectedVille?.id],
  );
  const activeQuartierId = quartiers.some((q) => q.id === selectedQuartierId)
    ? selectedQuartierId
    : null;

  const filtered = useMemo(() => {
    const all = commercesQuery.data ?? [];
    const data = activeQuartierId ? all.filter((c) => c.quartierId === activeQuartierId) : all;
    if (isSearching) {
      return sortByTier(data.filter((c) => matchesSearch(c, searchQuery)));
    }
    if (category === null) return sortByTier(data);
    return sortByTier(data.filter((c) => c.category === category));
  }, [commercesQuery.data, activeQuartierId, isSearching, searchQuery, category]);

  const filteredWithDistance = withComputedDistance(filtered, position);
  const visibleCommerces = hasPosition
    ? filteredWithDistance.filter((c) => c.distanceKm <= radiusKm)
    : filteredWithDistance;

  // Encart VIP "À la une" : réservé aux commerces qui cumulent Site Pro ET l'option Vedette 24h
  // en cours -- pas juste l'un ou l'autre. Dès que le boost expire (isBoostActive côté requête)
  // ou que l'abonnement Site Pro est annulé, le commerce en sort au prochain refetch/realtime.
  const vip = commercesWithDistance.filter(
    (c) =>
      c.sponsored &&
      c.premium &&
      (!hasPosition || c.distanceKm <= radiusKm) &&
      (!activeQuartierId || c.quartierId === activeQuartierId),
  );

  const noticesQuery = useQuery({
    queryKey: ["infos-mairie-public", selectedVille?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Infos_Mairie")
        .select("id, titre, corps, type, date_info")
        .eq("ville_id", selectedVille?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PublicNotice[];
    },
    enabled: !!selectedVille,
  });

  const notices = noticesQuery.data ?? [];

  const bannerQuery = useQuery({
    queryKey: ["sponsor-banner", "top", selectedVille?.slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("image_url, target_url")
        .eq("city_slug", selectedVille?.slug)
        .eq("position", "top")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVille,
    refetchInterval: 30_000,
  });

  const bottomBannerQuery = useQuery({
    queryKey: ["sponsor-banner", "bottom", selectedVille?.slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("image_url, target_url")
        .eq("city_slug", selectedVille?.slug)
        .eq("position", "bottom")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVille,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Barre supérieure de recherche */}
      <section className="w-full overflow-hidden border-b border-border/60 bg-gradient-navy pb-5 pt-4 text-primary-foreground sm:pb-8 sm:pt-6">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="break-words font-display text-xl font-extrabold sm:text-2xl lg:text-3xl">
            {city
              ? `Les bons plans de ${city}, en direct de vos commerçants`
              : "Les bons plans de vos commerçants, en direct"}
          </h1>
          <p className="mt-1 hidden text-sm text-primary-foreground/70 sm:block">
            Toute la vie de votre quartier, vos commerces et votre mairie en un clic.
          </p>

          <div className="mt-3 sm:hidden">
            <RadiusSelector />
          </div>

          <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCityOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-xl bg-card px-3 py-3 text-left text-sm font-semibold text-foreground shadow-card"
              >
                <MapPin className="h-4 w-4 shrink-0 text-promo" />
                <span className="min-w-0 flex-1 truncate">{city || "Choisir une ville"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              {cityOpen ? (
                <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
                  <input
                    autoFocus
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder="Ville, village ou code postal…"
                    className="w-full border-b border-border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
                  />
                  <ul className="max-h-56 overflow-auto py-1">
                    {citySuggestions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVille(v);
                            setSelectedQuartierId(null);
                            setCityOpen(false);
                            setCityQuery("");
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-secondary"
                        >
                          {v.nom}
                        </button>
                      </li>
                    ))}
                    {villesQuery.isLoading ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">Chargement…</li>
                    ) : null}
                    {!villesQuery.isLoading && citySuggestions.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">Aucune commune</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                (document.activeElement as HTMLElement | null)?.blur();
                document
                  .getElementById("resultats")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex items-center gap-2 rounded-xl bg-card px-3 py-3 shadow-card"
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Boucherie, coiffeur, nom de commerce, mot-clé…"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </form>
          </div>
        </div>
      </section>

      {/* Bannière sponsorisée par commune : bannière-modèle tant qu'aucune vraie pub n'est configurée */}
      <SponsorBanner banner={bannerQuery.data} />

      {/* Espace VIP "À la une" : Site Pro + Vedette 24h cumulés, juste sous la bannière */}
      {!isSearching && vip.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pt-6">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-extrabold text-foreground">À la Une</h2>
            <span className="rounded-full bg-promo/10 px-2 py-1 text-[11px] font-bold uppercase text-promo">
              VIP
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vip.map((c) => (
              <OfferCard key={`vip-${c.id}`} commerce={c} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Onglets catégories : juste sous la barre de recherche */}
      {/* Sur mobile, quartiers et catégories tiennent chacun sur une seule ligne défilable au doigt
          (bord à bord, sans barre de défilement) pour que la liste des fiches reste visible juste
          en dessous ; à partir de sm, les catégories repassent sur plusieurs lignes. */}
      <section className="mx-auto max-w-6xl px-4 pb-3 pt-4 sm:pb-4 sm:pt-6">
        {/* Filtre quartier : masqué si la commune n'a aucun quartier en base. La clé par ville
            remonte le menu à chaque changement de commune (aucune sélection résiduelle). */}
        {quartiers.length > 0 && selectedVille ? (
          <div className="mb-2 flex items-center gap-2 sm:mb-3">
            <label
              htmlFor="quartier-filter"
              className="hidden shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:block"
            >
              Quartier / secteur
            </label>
            <Select
              key={selectedVille.id}
              value={activeQuartierId ?? ALL_QUARTIERS}
              onValueChange={(value) =>
                setSelectedQuartierId(value === ALL_QUARTIERS ? null : value)
              }
            >
              <SelectTrigger
                id="quartier-filter"
                aria-label="Filtrer par quartier"
                className={`h-9 w-full rounded-full text-xs font-semibold sm:w-72 ${
                  activeQuartierId ? "border-navy bg-navy text-primary-foreground" : "bg-card"
                }`}
              >
                {/* div et non span : le déclencheur applique line-clamp à ses span enfants. */}
                <div className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    <SelectValue />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_QUARTIERS}>Tous les quartiers de {city}</SelectItem>
                {quartiers.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.nom} ({quartierCounts.get(q.id) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:py-2 sm:text-sm ${
              category === null
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            Tous
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory((prev) => (prev === c.key ? null : c.key))}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                category === c.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-3 hidden text-xs text-muted-foreground sm:block">
          {category === null
            ? "Tous les commerces, toutes catégories confondues."
            : CATEGORIES.find((c) => c.key === category)?.sub.join(" · ")}
          {hasPosition ? ` · Dans un rayon de ${radiusKm} km autour de vous` : ""}
        </p>
      </section>

      {/* Carte OpenStreetMap des fiches affichées (ville, quartier, catégorie, recherche). */}
      {selectedVille ? (
        <section className="mx-auto max-w-6xl px-4 pb-4">
          <button
            type="button"
            onClick={toggleMap}
            aria-expanded={showMap}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <MapIcon className="h-3.5 w-3.5" /> {showMap ? "Masquer la carte" : "Voir sur la carte"}
          </button>
          {showMap ? (
            <CommerceMap
              commerces={visibleCommerces}
              inseeCode={selectedVille.insee_code}
              className="mt-3 h-72 sm:h-96"
            />
          ) : null}
        </section>
      ) : null}

      {isSearching ? (
        /* Résultats de recherche : remplace tout le reste de la page, juste sous la barre */
        <section id="resultats" className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-extrabold text-foreground">
              Résultats pour « {query.trim()} »
            </h2>
            <span className="rounded-full bg-promo/10 px-2 py-1 text-[11px] font-bold uppercase text-promo">
              {visibleCommerces.length} résultat{visibleCommerces.length > 1 ? "s" : ""}
            </span>
          </div>

          {commercesQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
          ) : visibleCommerces.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun commerce trouvé.</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Réinitialiser la recherche
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCommerces.map((c) => (
                <OfferCard key={c.id} commerce={c} />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Un seul flux, trié par rang (Vedette > Site Pro > gratuit) : chaque commerce
           n'apparaît qu'une fois, ses éventuelles offres actives défilent dans sa carte. */
        <section className="mx-auto max-w-6xl px-4 pb-12">
          {category === "locale" && notices.length > 0 ? (
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              {notices.map((n) => (
                <NoticeCard
                  key={n.id}
                  title={n.titre}
                  body={n.corps ?? ""}
                  date={n.date_info ?? ""}
                  type={n.type}
                />
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCommerces.map((c) => (
              <OfferCard key={c.id} commerce={c} />
            ))}
            {commercesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : null}
            {!commercesQuery.isLoading &&
            visibleCommerces.length === 0 &&
            !(category === "locale" && notices.length > 0) ? (
              <p className="col-span-full text-sm text-muted-foreground">
                {activeQuartierId ? (
                  <>
                    Aucune fiche dans le quartier «{" "}
                    {quartiers.find((q) => q.id === activeQuartierId)?.nom} » pour le moment.{" "}
                    <button
                      type="button"
                      onClick={() => setSelectedQuartierId(null)}
                      className="font-semibold text-navy underline"
                    >
                      Voir tout {city}
                    </button>
                  </>
                ) : category === null ? (
                  hasPosition ? (
                    `Aucun commerce à moins de ${radiusKm} km à ${city}.`
                  ) : (
                    `Aucun commerce à ${city} pour le moment.`
                  )
                ) : (
                  "Aucun commerce dans cette catégorie pour le moment."
                )}
              </p>
            ) : null}
          </div>

          {selectedVille ? (
            <div className="mx-auto mt-8 max-w-xl">
              <PushOptInCard villeId={selectedVille.id} villeNom={selectedVille.nom} />
            </div>
          ) : null}
        </section>
      )}

      {/* Bloc Mairie */}
      <section className="border-t border-border/60 bg-card py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-5 w-5 shrink-0 text-mairie" />
            <h2 className="truncate font-display text-xl font-extrabold text-foreground">
              Mairie & Événements — {city}
            </h2>
            <span className="ml-auto shrink-0 rounded-full bg-mairie px-2 py-1 text-[11px] font-bold uppercase text-mairie-foreground">
              Info Officielle
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {notices.map((n) => (
              <NoticeCard
                key={n.id}
                title={n.titre}
                body={n.corps ?? ""}
                date={n.date_info ?? ""}
                type={n.type}
              />
            ))}
            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas d'information municipale publiée pour le moment.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Bannière sponsorisée : deuxième emplacement, tout en bas juste au-dessus du footer */}
      <BottomSponsorBanner banner={bottomBannerQuery.data} />

      <footer className="bg-gradient-navy py-8 text-center text-sm text-primary-foreground/70">
        <p>SpotLocal — le commerce local, à portée de rue.</p>
        <Link to="/cgv" className="mt-2 inline-block underline hover:text-primary-foreground">
          Conditions Générales de Vente & Mentions Légales
        </Link>
      </footer>

      <InstallAppBanner />
    </div>
  );
}

function NoticeCard({
  title,
  body,
  date,
  type,
}: {
  title: string;
  body: string;
  date: string;
  type: string;
}) {
  return (
    <article className="surface-card border-l-4 border-l-mairie p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 shrink-0 text-mairie" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-mairie">{type}</span>
        <span className="ml-auto text-xs text-muted-foreground">{date}</span>
      </div>
      <h3 className="mt-2 text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </article>
  );
}
