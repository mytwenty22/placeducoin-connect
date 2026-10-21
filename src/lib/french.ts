/**
 * « de » + nom de commune, avec élision et contraction : « d'Annecy », « du Havre »,
 * « des Sables-d'Olonne », « de La Rochelle », « de Lyon ». Le « h » n'est pas élidé, faute de
 * pouvoir distinguer h muet et h aspiré (« de Haguenau »).
 */
export function deCommune(nom: string): string {
  const name = nom.trim();
  const article = /^(Le|Les)\s+(.+)$/.exec(name);
  if (article) return `${article[1] === "Le" ? "du" : "des"} ${article[2]}`;
  return /^[aeiouyàâäéèêëîïôöùûüÿæœ]/i.test(name) ? `d'${name}` : `de ${name}`;
}
