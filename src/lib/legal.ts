import { supabase } from "@/lib/supabase";

// Informations légales de l'éditeur, reprises dans tous les documents juridiques (/legal).
// Remplacer chaque valeur entre crochets par l'information réelle : tant qu'une valeur reste
// entre crochets, elle est surlignée dans les textes affichés pour signaler qu'elle manque.
export const LEGAL_IDENTITY = {
  // Entrepreneur individuel : pas de capital social, l'établissement principal tient lieu de siège.
  nomSociete: "Bouyé Matthieu",
  formeJuridique: "entrepreneur individuel (micro-entreprise)",
  siren: "534 268 313",
  siret: "534 268 313 00036",
  rcsVille: "Bordeaux",
  adresse: "12 rue Latesta, 33200 Bordeaux",
  numTva: "non assujetti, article 293 B du code général des impôts",
  telephone: "06 58 07 54 19",
  directeurPublication: "Matthieu Bouyé",
  emailContact: "contact@spotlocal.fr",
  emailRgpd: "rgpd@spotlocal.fr",
  // Médiateur de la consommation (article L612-1 du Code de la consommation).
  mediateurNom: "[MEDIATEUR_NOM]",
  mediateurSite: "[MEDIATEUR_SITE]",
  // Prix de l'Espace Pro : sans TVA facturée tant que l'éditeur n'y est pas assujetti.
  regimePrix: "nets, TVA non applicable (article 293 B du code général des impôts)",
  dateMiseAJour: "23 octobre 2026",
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
