import type { LatLng } from "@/lib/geo";

// Position des fiches sur la carte de l'accueil : la position GPS enregistrée par le commerçant
// (ShopLocationField) si elle existe, sinon son adresse géocodée par la Base Adresse Nationale,
// restreinte à la commune (citycode) pour ne jamais placer un marqueur dans une autre ville.
// Les résultats sont gardés sur l'appareil : chaque adresse n'est géocodée qu'une fois.

const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
const CACHE_KEY = "spotlocal:map-geocode:v1";
// Seuil plus bas que pour la validation des coupons (0.6) : il s'agit ici de situer la fiche
// dans la commune, pas de prouver une présence à 100 m. En dessous, la fiche n'est pas placée.
const MIN_SCORE = 0.5;

type CacheEntry = LatLng | null;

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Stockage plein ou bloqué : les adresses seront regéocodées à la prochaine visite.
  }
}

async function geocodeInCommune(address: string, inseeCode: string): Promise<CacheEntry> {
  const params = new URLSearchParams({ q: address, citycode: inseeCode, limit: "1" });
  try {
    const response = await fetch(`${BAN_SEARCH_URL}?${params.toString()}`);
    if (!response.ok) return null;
    const json = (await response.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number] };
        properties?: { score?: number };
      }[];
    };
    const feature = json.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || (feature?.properties?.score ?? 0) < MIN_SCORE) return null;
    return { lat: coordinates[1], lng: coordinates[0] };
  } catch {
    return null;
  }
}

/** Géocode les adresses (par lots de 5, l'API publique limite le débit), avec cache local. */
export async function geocodeAddresses(
  addresses: string[],
  inseeCode: string,
): Promise<Map<string, LatLng>> {
  const cache = readCache();
  const result = new Map<string, LatLng>();
  const missing: string[] = [];
  for (const address of new Set(addresses.map((a) => a.trim()).filter(Boolean))) {
    const key = `${inseeCode}|${address.toLowerCase()}`;
    if (key in cache) {
      const hit = cache[key];
      if (hit) result.set(address, hit);
    } else missing.push(address);
  }

  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    const found = await Promise.all(batch.map((a) => geocodeInCommune(a, inseeCode)));
    batch.forEach((address, j) => {
      const position = found[j] ?? null;
      cache[`${inseeCode}|${address.toLowerCase()}`] = position;
      if (position) result.set(address, position);
    });
  }
  if (missing.length > 0) writeCache(cache);
  return result;
}

/** Centre de la commune (geo.api.gouv.fr), pour cadrer la carte quand aucune fiche n'est placée. */
export async function fetchCommuneCenter(inseeCode: string): Promise<LatLng | null> {
  try {
    const response = await fetch(`https://geo.api.gouv.fr/communes/${inseeCode}?fields=centre`);
    if (!response.ok) return null;
    const json = (await response.json()) as { centre?: { coordinates?: [number, number] } };
    const coordinates = json.centre?.coordinates;
    return coordinates ? { lat: coordinates[1], lng: coordinates[0] } : null;
  } catch {
    return null;
  }
}
