import { normalizeSearch } from "./utils";

/**
 * Pertinence d'un nom de commune pour une saisie (déjà normalisée par normalizeSearch) :
 * 0 nom exact, 1 début du nom, 2 début d'un mot du nom, 3 ailleurs dans le nom, null sinon.
 * « bordeaux » doit proposer Bordeaux avant Artigues-près-Bordeaux, que l'ordre alphabétique
 * met en tête (Entrée choisit le premier résultat).
 */
export function cityMatchRank(nom: string, query: string): number | null {
  const name = normalizeSearch(nom);
  if (!query || !name.includes(query)) return null;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/[\s'’-]+/).some((word) => word.startsWith(query))) return 2;
  return 3;
}

/** Communes dont le nom contient la saisie, les plus pertinentes d'abord (ordre stable sinon). */
export function rankCitiesByName<T extends { nom: string }>(villes: T[], query: string): T[] {
  return villes
    .map((ville) => ({ ville, rank: cityMatchRank(ville.nom, query) }))
    .filter((entry): entry is { ville: T; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.ville);
}
