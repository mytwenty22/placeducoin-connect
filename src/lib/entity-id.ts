// Validation des identifiants légaux saisis à l'inscription Pro. Même règle que la fonction SQL
// public.is_valid_siret (migration entity_identifiers) et que la vérification dans
// supabase/functions/create-checkout-session -- les trois doivent rester alignées.

export type EntityType = "company" | "association";
export type VerificationStatus = "non_renseigne" | "a_verifier" | "verifie" | "refuse";

export type EntityIdentity = {
  entity_type: EntityType | null;
  siret: string | null;
  rna: string | null;
  immatriculation_en_cours: boolean;
  verification_status: VerificationStatus;
  /** Dénomination officielle renvoyée par l'annuaire des entreprises (verify-identity). */
  legal_name: string | null;
};

/** Retire espaces, points et tirets ("123 456 789 00012" → "12345678900012"), met en majuscules. */
export function normalizeIdentifier(raw: string): string {
  return raw.replace(/[\s.-]/g, "").toUpperCase();
}

/**
 * SIRET : 14 chiffres + clé de Luhn. Exception connue : les établissements de La Poste
 * (SIREN 356000000) ne respectent pas tous Luhn -- leur somme des chiffres est un multiple de 5
 * (le siège, lui, reste valide au sens de Luhn).
 */
export function isValidSiret(value: string | null | undefined): boolean {
  if (!value || !/^\d{14}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = Number(value[13 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (sum % 10 === 0) return true;
  if (value.startsWith("356000000")) {
    return [...value].reduce((acc, d) => acc + Number(d), 0) % 5 === 0;
  }
  return false;
}

/** RNA (Répertoire National des Associations) : "W" suivi de 9 chiffres, ex. W123456789. */
export function isValidRna(value: string | null | undefined): boolean {
  return !!value && /^W\d{9}$/.test(value);
}

/**
 * Une association peut saisir indifféremment son RNA ou son SIRET dans un seul champ : on
 * reconnaît le format pour le ranger dans la bonne colonne.
 */
export function parseAssociationIdentifier(
  raw: string,
): { rna: string; siret: null } | { rna: null; siret: string } | null {
  const value = normalizeIdentifier(raw);
  if (isValidRna(value)) return { rna: value, siret: null };
  if (isValidSiret(value)) return { rna: null, siret: value };
  return null;
}

export type IdentityPatch = {
  siret: string | null;
  rna: string | null;
  immatriculation_en_cours: boolean;
};

/**
 * Transforme la saisie du formulaire en colonnes profiles. `allowPending` autorise la case
 * "En cours d'immatriculation" (inscription) ; elle est refusée quand on exige un SIRET pour payer.
 */
export function resolveIdentity(
  entityType: EntityType,
  input: { identifier: string; pending: boolean },
  options: { allowPending: boolean },
): { ok: true; patch: IdentityPatch } | { ok: false; error: string } {
  const value = normalizeIdentifier(input.identifier);
  if (entityType === "association") {
    const parsed = parseAssociationIdentifier(value);
    if (!parsed) {
      return {
        ok: false,
        error: "N° RNA (W suivi de 9 chiffres) ou N° SIRET (14 chiffres) invalide.",
      };
    }
    return { ok: true, patch: { ...parsed, immatriculation_en_cours: false } };
  }
  if (options.allowPending && input.pending && !value) {
    return { ok: true, patch: { siret: null, rna: null, immatriculation_en_cours: true } };
  }
  if (!isValidSiret(value)) {
    return {
      ok: false,
      error: options.allowPending
        ? "N° SIRET invalide (14 chiffres) — ou cochez « En cours d'immatriculation »."
        : "N° SIRET invalide (14 chiffres).",
    };
  }
  return { ok: true, patch: { siret: value, rna: null, immatriculation_en_cours: false } };
}

/** Associations : l'accès gratuit est ouvert dès qu'un RNA ou un SIRET valide est renseigné. */
export function hasAssociationIdentifier(identity: Pick<EntityIdentity, "rna" | "siret">) {
  return isValidRna(identity.rna) || isValidSiret(identity.siret);
}

/** Entreprises : les formules payantes exigent un SIRET valide (pas seulement "en cours"). */
export function canCompanyPay(identity: Pick<EntityIdentity, "siret" | "verification_status">) {
  return isValidSiret(identity.siret) && identity.verification_status !== "refuse";
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  non_renseigne: "Identifiant non renseigné",
  a_verifier: "Identifiant en cours de vérification",
  verifie: "Identifiant vérifié",
  refuse: "Identifiant refusé — contactez-nous",
};
