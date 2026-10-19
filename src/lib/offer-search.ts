// Paramètre `?offre=<promoId>` des pages /commerce/$slug et /site/$slug : l'offre sur laquelle le
// visiteur a cliqué depuis la marketplace, pré-sélectionnée à l'ouverture de la fiche.
export type OfferSearch = { offre?: string };

export function validateOfferSearch(search: Record<string, unknown>): OfferSearch {
  const offre = search["offre"];
  return typeof offre === "string" && offre.length > 0 ? { offre } : {};
}
