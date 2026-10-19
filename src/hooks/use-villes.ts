import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import { useCityChoice, writeCityChoice, type ExternalCommune } from "@/lib/city-pref";

export type Ville = {
  id: string;
  nom: string;
  slug: string;
  codes_postaux: string[];
  insee_code: string | null;
  commerceCount: number;
  /**
   * Commune du référentiel national sans fiche SpotLocal (id factice `insee:<code>`) : aucune
   * requête par ville_id, la Marketplace affiche les bons plans autour de `center`.
   */
  external?: { lat: number; lng: number };
};

export type Quartier = { id: string; nom: string; code_postal: string; ville_id: string };

/** Résultat choisi dans le menu de ville (voir CitySelect). */
export type CityOption =
  | { kind: "ville"; ville: Ville; codePostal: string | null }
  | { kind: "quartier"; ville: Ville; quartier: Quartier }
  | { kind: "external"; commune: ExternalCommune; codePostal: string | null };

/** Toutes les communes, avec leur nombre de fiches (partagé Marketplace / Espace Pro). */
export function useVilles() {
  return useQuery({
    queryKey: ["villes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("villes")
        .select("id, nom, slug, codes_postaux, insee_code, commerces(count)")
        .order("nom");
      if (error) throw error;
      return (
        data as unknown as (Omit<Ville, "commerceCount"> & { commerces: { count: number }[] })[]
      ).map(({ commerces, ...v }) => ({ ...v, commerceCount: commerces[0]?.count ?? 0 }));
    },
  });
}

/** Tous les quartiers (peu nombreux), pour la recherche du menu de ville. */
export function useAllQuartiers() {
  return useQuery({
    queryKey: ["quartiers", "all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quartiers")
        .select("id, nom, code_postal, ville_id")
        .order("nom");
      if (error) throw error;
      return data as Quartier[];
    },
  });
}

function externalVille(c: ExternalCommune): Ville {
  return {
    id: `insee:${c.insee}`,
    nom: c.nom,
    slug: "",
    codes_postaux: [],
    insee_code: c.insee,
    commerceCount: 0,
    external: { lat: c.lat, lng: c.lng },
  };
}

/**
 * Zone affichée, par ordre de priorité :
 *   1. le dernier choix explicite du visiteur dans un menu de ville (Marketplace ou Espace Pro) :
 *      commune SpotLocal (+ quartier ou code postal), ou commune du référentiel sans fiche ;
 *   2. la ville du commerce de l'utilisateur connecté (un commerçant de Bordeaux voit Bordeaux) ;
 *   3. la commune la plus fournie.
 * Tant que la session et le commerce ne sont pas connus, `ville` reste null plutôt que d'afficher
 * brièvement la commune par défaut.
 */
export function useSelectedVille() {
  const villesQuery = useVilles();
  const choice = useCityChoice();
  const { session, ready } = useSession();
  const userId = session?.user.id;

  const ownVilleQuery = useQuery({
    queryKey: ["own-commerce-ville", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commerces")
        .select("ville_id")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.ville_id as string | undefined) ?? null;
    },
  });

  const villes = villesQuery.data ?? [];
  // Commune du référentiel choisie : si elle a entre-temps une fiche SpotLocal, on la prend.
  const externalMatch = choice?.external
    ? villes.find((v) => v.insee_code === choice.external!.insee)
    : undefined;
  const chosen = choice?.external
    ? (externalMatch ?? externalVille(choice.external))
    : choice
      ? villes.find((v) => v.id === choice.villeId)
      : undefined;
  const ownResolved = ready && (!userId || !ownVilleQuery.isLoading);
  const own = ownVilleQuery.data ? villes.find((v) => v.id === ownVilleQuery.data) : undefined;
  const busiest = villes.reduce<Ville | undefined>(
    (best, v) => (!best || v.commerceCount > best.commerceCount ? v : best),
    undefined,
  );
  const ville = chosen ?? (ownResolved ? (own ?? busiest) : undefined) ?? null;
  const quartierId = chosen && choice && !choice.external ? choice.quartierId : null;
  // Code postal : seulement s'il fait partie des codes de la commune affichée.
  const codePostal =
    chosen &&
    choice?.codePostal &&
    !chosen.external &&
    chosen.codes_postaux.includes(choice.codePostal)
      ? choice.codePostal
      : null;

  /** Choix explicite d'une commune (filtres quartier / code postal remis à "tous"). */
  const selectVille = (villeId: string, cp: string | null = null) =>
    writeCityChoice({ villeId, quartierId: null, codePostal: cp });
  /** Quartier d'une commune SpotLocal (remplace un éventuel filtre code postal). */
  const selectQuartier = (id: string | null, villeId: string | undefined = ville?.id) => {
    if (villeId && !villeId.startsWith("insee:")) {
      writeCityChoice({ villeId, quartierId: id, codePostal: null });
    }
  };
  const selectExternal = (commune: ExternalCommune, cp: string | null = null) =>
    writeCityChoice({ villeId: null, quartierId: null, codePostal: cp, external: commune });

  return {
    villes,
    villesLoading: villesQuery.isLoading,
    ville,
    quartierId,
    codePostal,
    selectVille,
    selectQuartier,
    selectExternal,
    /** Applique un résultat du menu de ville (commune, code postal, quartier ou commune externe). */
    chooseOption: (o: CityOption) => {
      if (o.kind === "ville") selectVille(o.ville.id, o.codePostal);
      else if (o.kind === "quartier") selectQuartier(o.quartier.id, o.ville.id);
      else selectExternal(o.commune, o.codePostal);
    },
    /** Retire le filtre code postal en gardant la commune. */
    clearCodePostal: () => {
      if (ville && !ville.external)
        writeCityChoice({ villeId: ville.id, quartierId, codePostal: null });
    },
  };
}
