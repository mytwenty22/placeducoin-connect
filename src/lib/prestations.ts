// Ligne de « Tarifs & prestations » d'une fiche (colonne commerces.prestations). Le prix est un
// texte libre : « 25 € », « à partir de 40 € », « sur devis »…
export type Prestation = { nom: string; prix: string };

export function cleanPrestations(prestations: Prestation[]): Prestation[] {
  return prestations
    .map((p) => ({ nom: p.nom.trim(), prix: p.prix.trim() }))
    .filter((p) => p.nom.length > 0);
}
