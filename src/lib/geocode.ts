import type { LatLng } from "@/lib/geo";

// Géocodage via la Base Adresse Nationale (api-adresse.data.gouv.fr) : service public, gratuit,
// sans clé d'API et ouvert aux appels depuis le navigateur.
const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
// En dessous de ce score de confiance, l'adresse trouvée est trop approximative (ex. la commune
// entière) pour servir de centre à un rayon de 100 m : on préfère ne rien enregistrer.
const MIN_SCORE = 0.6;
// Sans délai, une requête qui ne répond jamais bloquerait tout un import CSV.
const REQUEST_TIMEOUT_MS = 8000;
const ATTEMPTS = 2;

type BanResponse = {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { score?: number };
  }[];
};

/** Position de l'adresse, ou null si introuvable, imprécise ou si la BAN ne répond pas. */
export async function geocodeAddress(adresse: string, codePostal: string): Promise<LatLng | null> {
  const query = adresse.trim();
  if (!query) return null;
  const params = new URLSearchParams({ q: query, limit: "1" });
  if (/^\d{5}$/.test(codePostal.trim())) params.set("postcode", codePostal.trim());

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${BAN_SEARCH_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      // Trop de requêtes ou panne passagère : on retente après une courte pause.
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`BAN ${response.status}`);
      }
      if (!response.ok) return null;
      const json = (await response.json()) as BanResponse;
      const feature = json.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!coordinates || (feature?.properties?.score ?? 0) < MIN_SCORE) return null;
      const [lng, lat] = coordinates;
      return { lat, lng };
    } catch {
      if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return null;
}
