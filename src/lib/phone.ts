// Numéro fictif mis sur les fiches importées sans téléphone connu (« 05 00 00 00 00 ») : il reste
// en base pour respecter le champ obligatoire, mais ne doit jamais être montré ni appelé.
const PLACEHOLDER_PHONE = /^(?:\+33|0033|0)[1-9]0{8}$/;

export function isPlaceholderPhone(raw: string | null | undefined): boolean {
  return PLACEHOLDER_PHONE.test((raw ?? "").replace(/[\s.\-()]/g, ""));
}

/** Téléphone à afficher publiquement : vide si absent ou fictif. */
export function publicPhone(raw: string | null | undefined): string {
  const phone = (raw ?? "").trim();
  return isPlaceholderPhone(phone) ? "" : phone;
}
