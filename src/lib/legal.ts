import { supabase } from "@/lib/supabase";

// Informations légales de l'éditeur, reprises dans tous les documents juridiques (/legal).
// Remplacer chaque valeur entre crochets par l'information réelle : tant qu'une valeur reste
// entre crochets, elle est surlignée dans les textes affichés pour signaler qu'elle manque.
export const LEGAL_IDENTITY = {
  nomSociete: "[NOM_SOCIETE]",
  formeJuridique: "[FORME_JURIDIQUE]",
  capital: "[CAPITAL]",
  siren: "[SIREN]",
  rcsVille: "[RCS_VILLE]",
  adresse: "[ADRESSE]",
  numTva: "[NUM_TVA]",
  telephone: "[TELEPHONE]",
  directeurPublication: "[DIRECTEUR_PUB]",
  emailContact: "[EMAIL_CONTACT]",
  emailRgpd: "[EMAIL_RGPD]",
  // Médiateur de la consommation (article L612-1 du Code de la consommation).
  mediateurNom: "[MEDIATEUR_NOM]",
  mediateurSite: "[MEDIATEUR_SITE]",
  // Prix de l'Espace Pro : « hors taxes » ou « toutes taxes comprises ».
  regimePrix: "[HT_OU_TTC]",
  dateMiseAJour: "[DATE_MISE_A_JOUR]",
} as const;

// Version des CGU/CGV Espace Pro enregistrée avec chaque acceptation : à changer à chaque
// modification substantielle du texte pour savoir quelle version chaque commerçant a acceptée.
export const PRO_TERMS_VERSION = "2026-10-20";

// Version de la Charte Espace Mairies acceptée par chaque agent : la changer à chaque
// modification substantielle redemande l'acceptation à la prochaine connexion.
export const CHARTE_MAIRIES_VERSION = "2026-10-20";

export const LEGAL_DOCS = [
  { key: "mentions", title: "Mentions légales", short: "Mentions légales" },
  { key: "cgu", title: "CGU Particuliers & Politique de confidentialité", short: "CGU & RGPD" },
  { key: "cgv-pro", title: "CGV & CGU Espace Pro", short: "CGV Espace Pro" },
  {
    key: "charte-mairies",
    title: "Charte Espace Mairies & Collectivités",
    short: "Charte Mairies",
  },
] as const;

export type LegalDocKey = (typeof LEGAL_DOCS)[number]["key"];

export function isLegalDocKey(value: unknown): value is LegalDocKey {
  return LEGAL_DOCS.some((doc) => doc.key === value);
}

/**
 * Enregistre l'acceptation d'un document par l'utilisateur connecté dans le journal
 * legal_acceptances (preuve horodatée par le serveur, avec adresse IP et navigateur).
 */
export async function recordLegalAcceptance(doc: "cgv-pro" | "charte-mairies", version: string) {
  const { error } = await supabase.rpc("record_legal_acceptance", {
    p_document: doc,
    p_version: version,
  });
  if (error) throw new Error(error.message);
}

/** Une valeur encore entre crochets n'a pas été renseignée. */
export function isPlaceholder(value: string) {
  return /^\[[A-Z_]+\]$/.test(value);
}
