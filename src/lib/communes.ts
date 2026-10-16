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
