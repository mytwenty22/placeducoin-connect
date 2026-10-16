import { supabase } from "@/lib/supabase";

/**
 * Code postal → commune → quartier/secteur, partagé par la création et la modification de fiche.
 * `newQuartier` non nul = l'utilisateur ajoute un quartier absent de la liste ; il est créé dans
 * Supabase au moment de l'enregistrement (resolveLocality), puis visible par tous.
 */
export type LocalityValue = {
  codePostal: string;
  insee: string;
  quartierId: string | null;
  newQuartier: string | null;
};

export function validateLocality(value: LocalityValue): string | null {
  if (!/^\d{5}$/.test(value.codePostal)) return "Code postal invalide (5 chiffres).";
  if (!value.insee) return "Choisissez votre commune.";
  if (value.newQuartier !== null && value.newQuartier.trim().length < 2) {
    return "Nom du quartier trop court (2 caractères minimum).";
  }
  return null;
}

async function functionErrorMessage(error: unknown, fallback: string) {
  try {
    const body = await (error as { context?: Response }).context?.json();
    if (body?.error) return String(body.error);
  } catch {
    // Corps illisible : message générique ci-dessous.
  }
  return fallback;
}

/** Crée au besoin la ville (via ensure-ville) et le nouveau quartier, renvoie leurs ids. */
export async function resolveLocality(
  value: LocalityValue,
): Promise<{ villeId: string; quartierId: string | null }> {
  const { data: ville, error } = await supabase.functions.invoke("ensure-ville", {
    body: { insee: value.insee },
  });
  if (error || !ville?.id) {
    throw new Error(await functionErrorMessage(error, "Impossible d'enregistrer la commune."));
  }
  if (value.newQuartier === null || !value.newQuartier.trim()) {
    return { villeId: ville.id as string, quartierId: value.quartierId };
  }
  const { data: quartier, error: quartierError } = await supabase.rpc("add_quartier", {
    p_ville_id: ville.id,
    p_code_postal: value.codePostal,
    p_nom: value.newQuartier,
  });
  if (quartierError) throw new Error(quartierError.message);
  return { villeId: ville.id as string, quartierId: (quartier as { id: string }).id };
}
