import type { LatLng } from "@/lib/geo";

// Géocodage via la Base Adresse Nationale (api-adresse.data.gouv.fr) : service public, gratuit,
// sans clé d'API et ouvert aux appels depuis le navigateur.
const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
// En dessous de ce score de confiance, l'adresse trouvée est trop approximative (ex. la commune
// entière) pour servir de centre à un rayon de 100 m : on préfère ne rien enregistrer.
const MIN_SCORE = 0.6;

export async function geocodeAddress(adresse: string, codePostal: string): Promise<LatLng | null> {
  const query = adresse.trim();
  if (!query) return null;
  const params = new URLSearchParams({ q: query, limit: "1" });
  if (/^\d{5}$/.test(codePostal.trim())) params.set("postcode", codePostal.trim());
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
    const [lng, lat] = coordinates;
    return { lat, lng };
  } catch {
    return null;
  }
}
