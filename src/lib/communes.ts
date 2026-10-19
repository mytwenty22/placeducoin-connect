// Référentiels publics data.gouv.fr, sans clé et ouverts aux appels depuis le navigateur :
// - geo.api.gouv.fr : communes rattachées à un code postal (un code postal peut couvrir plusieurs
//   communes, ex. 33610 = Canéjan + Cestas) ;
// - api-adresse.data.gouv.fr (BAN) : code postal + commune déduits d'une adresse saisie.

export type Commune = {
  nom: string;
  code: string;
  codeDepartement: string;
  codesPostaux: string[];
};

const GEO_API_URL = "https://geo.api.gouv.fr/communes";
const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";

export async function fetchCommunesByPostalCode(codePostal: string): Promise<Commune[]> {
  if (!/^\d{5}$/.test(codePostal)) return [];
  const params = new URLSearchParams({
    codePostal,
    fields: "nom,code,codeDepartement,codesPostaux",
  });
  const response = await fetch(`${GEO_API_URL}?${params.toString()}`);
  if (!response.ok) throw new Error("Référentiel des communes indisponible.");
  return ((await response.json()) as Commune[]).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/** Code postal + code INSEE d'une adresse, ou null si l'adresse est trop approximative. */
export async function locateAddress(
  adresse: string,
): Promise<{ codePostal: string; insee: string } | null> {
  const query = adresse.trim();
  if (query.length < 6) return null;
  try {
    const params = new URLSearchParams({ q: query, limit: "1" });
    const response = await fetch(`${BAN_SEARCH_URL}?${params.toString()}`);
    if (!response.ok) return null;
    const json = (await response.json()) as {
      features?: { properties?: { postcode?: string; citycode?: string; score?: number } }[];
    };
    const props = json.features?.[0]?.properties;
    if (!props?.postcode || !props.citycode || (props.score ?? 0) < 0.5) return null;
    return { codePostal: props.postcode, insee: props.citycode };
  } catch {
    return null;
  }
}

export type CommuneWithCenter = {
  nom: string;
  code: string;
  codesPostaux: string[];
  centre: { lat: number; lng: number } | null;
};

/**
 * Recherche de communes dans le référentiel national (geo.api.gouv.fr), pour le menu de ville :
 * par code postal complet (5 chiffres) ou par nom (3 caractères minimum, communes les plus
 * peuplées en premier). Renvoie [] en cas d'indisponibilité : la recherche locale suffit alors.
 */
export async function searchCommunes(query: string): Promise<CommuneWithCenter[]> {
  const q = query.trim();
  const digits = q.replace(/\s/g, "");
  const params = new URLSearchParams({ fields: "nom,code,codesPostaux,centre" });
  if (/^\d{5}$/.test(digits)) params.set("codePostal", digits);
  else if (q.length >= 3 && !/^\d+$/.test(digits)) {
    params.set("nom", q);
    params.set("boost", "population");
    params.set("limit", "6");
  } else return [];
  try {
    const response = await fetch(`${GEO_API_URL}?${params.toString()}`);
    if (!response.ok) return [];
    const json = (await response.json()) as {
      nom: string;
      code: string;
      codesPostaux?: string[];
      centre?: { coordinates?: [number, number] };
    }[];
    return json.map((c) => ({
      nom: c.nom,
      code: c.code,
      codesPostaux: c.codesPostaux ?? [],
      centre: c.centre?.coordinates
        ? { lat: c.centre.coordinates[1], lng: c.centre.coordinates[0] }
        : null,
    }));
  } catch {
    return [];
  }
}
