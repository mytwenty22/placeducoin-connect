export type LatLng = { lat: number; lng: number };

// Coordonnées approximatives des communes utilisées par la marketplace (démo + villes réelles
// créées par les pros). Une commune absente de cette liste retombe sur DEFAULT_COORDS (Paris).
const CITY_COORDS: Record<string, LatLng> = {
  Annecy: { lat: 45.8992, lng: 6.1294 },
  Bayeux: { lat: 49.2764, lng: -0.7024 },
  Colmar: { lat: 48.0794, lng: 7.3585 },
  Dinan: { lat: 48.4535, lng: -2.0453 },
  Étretat: { lat: 49.7086, lng: 0.2036 },
  Figeac: { lat: 44.6084, lng: 2.0325 },
  Gordes: { lat: 43.9114, lng: 5.2004 },
  Honfleur: { lat: 49.4189, lng: 0.2333 },
  Uzès: { lat: 44.0122, lng: 4.4196 },
  "Sarlat-la-Canéda": { lat: 44.8896, lng: 1.2166 },
  "Saint-Émilion": { lat: 44.8926, lng: -0.1557 },
  Vannes: { lat: 47.6582, lng: -2.7603 },
  Canéjan: { lat: 44.7658, lng: -0.6494 },
};

const DEFAULT_COORDS: LatLng = { lat: 48.8566, lng: 2.3522 };

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function unitFromHash(hash: number): number {
  return (Math.abs(hash) % 1000) / 1000;
}

/**
 * Les fiches commerce n'ont pas de coordonnées GPS réelles en base : on dérive une position
 * stable (toujours la même pour un même commerce) autour du centre de sa commune, pour pouvoir
 * calculer une distance plausible avec la position réelle de l'utilisateur.
 */
export function derivePosition(slug: string, cityName: string): LatLng {
  const base = CITY_COORDS[cityName] ?? DEFAULT_COORDS;
  const spanDeg = 0.06; // ~ ±3 km
  const jitterLat = (unitFromHash(hashString(`${slug}:lat`)) - 0.5) * spanDeg;
  const jitterLng = (unitFromHash(hashString(`${slug}:lng`)) - 0.5) * spanDeg;
  return { lat: base.lat + jitterLat, lng: base.lng + jitterLng };
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function withComputedDistance<T extends { slug: string; city: string; distanceKm: number }>(
  offers: T[],
  position: LatLng | null,
): T[] {
  if (!position) return offers;
  return offers.map((offer) => ({
    ...offer,
    distanceKm: Math.round(haversineKm(position, derivePosition(offer.slug, offer.city)) * 10) / 10,
  }));
}
