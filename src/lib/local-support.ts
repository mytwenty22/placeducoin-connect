import { supabase } from "@/lib/supabase";

// ---- Niveau honorifique du compteur « soutien local » (/compte) ----

const LEVELS = [
  { min: 500, label: "Ambassadeur indépendant" },
  { min: 200, label: "Pilier du quartier" },
  { min: 50, label: "Soutien local" },
  { min: 0, label: "Curieux du quartier" },
] as const;

export function supportLevel(totalEuros: number): string {
  return LEVELS.find((level) => totalEuros >= level.min)?.label ?? "Curieux du quartier";
}

// ---- Intention choisie sur l'accueil (facultative) ----
// Les clients n'ont pas de ligne dans `profiles` (réservée aux comptes pro/mairie/admin) : le
// choix est gardé dans les métadonnées du compte Supabase quand l'utilisateur est connecté, et
// dans le navigateur sinon.

export type Intention = "offres" | "quartier";

const INTENTION_KEY = "pdc:intention";

export function readStoredIntention(): Intention | null {
  try {
    const raw = window.localStorage.getItem(INTENTION_KEY);
    return raw === "offres" || raw === "quartier" ? raw : null;
  } catch {
    return null;
  }
}

export async function saveIntention(intention: Intention, signedIn: boolean): Promise<void> {
  try {
    window.localStorage.setItem(INTENTION_KEY, intention);
  } catch {
    // Stockage indisponible (navigation privée…) : sans conséquence, le choix est facultatif.
  }
  if (signedIn) {
    await supabase.auth.updateUser({ data: { intention } });
  }
}
