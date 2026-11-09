import { hashString } from "./geo";
import { normalizeSearch } from "./utils";

// Tranches de distance (bornes hautes en km) : au sein d'une tranche, les commerces sont considérés
// à égale distance et se partagent le haut de leur bloc par rotation.
const DISTANCE_BANDS_KM = [1, 2, 5, 10, 20];

// « Restauration de meubles » ou « brasserie artisanale » restent des commerces de proximité.
const EXCLUDED_TRADES =
  /restaurant|restauration(?! d)|fast.?food|pizz|kebab|burger|snack|sandwich|brasserie(?! artisanale)|bistrot|creperie/;

type Sortable = { slug: string; distanceKm: number };

/** Tous les commerces de proximité sont listés, sauf la restauration assise ou rapide. */
export function isMarketplaceEligible(commerce: { trade: string }): boolean {
  return !EXCLUDED_TRADES.test(normalizeSearch(commerce.trade));
}

function distanceBand(distanceKm: number): number {
  const band = DISTANCE_BANDS_KM.findIndex((limit) => distanceKm <= limit);
  return band === -1 ? DISTANCE_BANDS_KM.length : band;
}

// hashString seul ne fait que décaler les valeurs d'une graine à l'autre (l'ordre changerait à
// peine) : ce brassage final redistribue vraiment les commerces à chaque visite.
function rotationRank(slug: string, seed: string): number {
  let hash = hashString(`${seed}:${slug}`);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function compareByProximity(a: Sortable, b: Sortable, seed: string): number {
  const bandDiff = distanceBand(a.distanceKm) - distanceBand(b.distanceKm);
  if (bandDiff !== 0) return bandDiff;
  return rotationRank(a.slug, seed) - rotationRank(b.slug, seed) || a.slug.localeCompare(b.slug);
}

/**
 * Liste de la marketplace : bloc Pro (Site Pro + fiches gratuites boostées), puis fiches gratuites.
 * Dans chaque bloc : tranche de distance croissante, puis rotation.
 */
export function sortMarketplace<T extends Sortable & { premium: boolean; sponsored: boolean }>(
  commerces: T[],
  seed: string,
): T[] {
  const block = (c: T) => (c.premium || c.sponsored ? 0 : 1);
  return [...commerces].sort((a, b) => block(a) - block(b) || compareByProximity(a, b, seed));
}

/** Emplacement Boost Site Pro : les favoris du visiteur d'abord, puis proximité et rotation. */
export function sortBoostSpot<T extends Sortable & { id: string }>(
  commerces: T[],
  favoriteIds: ReadonlySet<string>,
  seed: string,
): T[] {
  const rank = (c: T) => (favoriteIds.has(c.id) ? 0 : 1);
  return [...commerces].sort((a, b) => rank(a) - rank(b) || compareByProximity(a, b, seed));
}
