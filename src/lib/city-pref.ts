import { useSyncExternalStore } from "react";

// Ville (et quartier) choisis EXPLICITEMENT par le visiteur dans un menu de ville, mémorisés sur
// l'appareil et partagés entre la Marketplace et l'Espace Pro. Une ville appliquée par défaut
// (celle du commerce connecté, ou la plus fournie) n'est jamais enregistrée ici : sinon ce
// défaut deviendrait un "choix" et masquerait définitivement la ville réelle du commerçant.
//
// Nouvelle clé : l'ancienne ("spotlocal:home-ville") enregistrait aussi la ville par défaut,
// elle est volontairement ignorée.
const KEY = "spotlocal:ville-choice";
const CHANGE_EVENT = "spotlocal:ville-choice-change";

/** Commune du référentiel national sans fiche SpotLocal (pas encore dans la table villes). */
export type ExternalCommune = { insee: string; nom: string; lat: number; lng: number };

/**
 * Choix de zone :
 *  - une commune SpotLocal (`villeId`), éventuellement restreinte à un quartier OU à un code
 *    postal (Bordeaux 33200) ;
 *  - ou une commune du référentiel sans fiche (`external`, ex. Talence 33400) : la Marketplace
 *    affiche alors les bons plans des alentours.
 */
export type CityChoice =
  | { villeId: string; quartierId: string | null; codePostal: string | null; external?: undefined }
  | {
      villeId: null;
      quartierId: null;
      codePostal: string | null;
      external: ExternalCommune;
    };

// Repli en mémoire quand localStorage est bloqué (navigation privée stricte…).
let memoryChoice: string | null = null;

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

function parse(raw: string | null): CityChoice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const codePostal = str(parsed["codePostal"]);
    const ext = parsed["external"] as Partial<ExternalCommune> | undefined;
    if (
      ext &&
      typeof ext.insee === "string" &&
      typeof ext.nom === "string" &&
      typeof ext.lat === "number" &&
      typeof ext.lng === "number"
    ) {
      return {
        villeId: null,
        quartierId: null,
        codePostal,
        external: { insee: ext.insee, nom: ext.nom, lat: ext.lat, lng: ext.lng },
      };
    }
    const villeId = str(parsed["villeId"]);
    if (!villeId) return null;
    return { villeId, quartierId: str(parsed["quartierId"]), codePostal };
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeCityChoice(choice: CityChoice) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Stockage indisponible : le choix vaut pour cette page seulement (voir memoryChoice).
  }
  memoryChoice = JSON.stringify(choice);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  // "storage" : choix fait dans un autre onglet ; CHANGE_EVENT : dans cet onglet.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// Instantané sous forme de chaîne (comparable par valeur) pour useSyncExternalStore.
function getSnapshot() {
  return readRaw() ?? memoryChoice;
}

let lastRaw: string | null = null;
let lastParsed: CityChoice | null = null;

/** Choix explicite de ville du visiteur, ou null s'il n'en a fait aucun. */
export function useCityChoice(): CityChoice | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parse(raw);
  }
  return lastParsed;
}
