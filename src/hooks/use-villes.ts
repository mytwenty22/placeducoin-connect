import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import { useCityChoice, writeCityChoice } from "@/lib/city-pref";

export type Ville = {
  id: string;
  nom: string;
  slug: string;
  codes_postaux: string[];
  insee_code: string | null;
  commerceCount: number;
};

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

/**
 * Ville affichée, par ordre de priorité :
 *   1. le dernier choix explicite du visiteur dans un menu de ville (Marketplace ou Espace Pro) ;
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
  const chosen = choice ? villes.find((v) => v.id === choice.villeId) : undefined;
  const ownResolved = ready && (!userId || !ownVilleQuery.isLoading);
  const own = ownVilleQuery.data ? villes.find((v) => v.id === ownVilleQuery.data) : undefined;
  const busiest = villes.reduce<Ville | undefined>(
    (best, v) => (!best || v.commerceCount > best.commerceCount ? v : best),
    undefined,
  );
  const ville = chosen ?? (ownResolved ? (own ?? busiest) : undefined) ?? null;
  const quartierId = chosen && choice ? choice.quartierId : null;

  return {
    villes,
    villesLoading: villesQuery.isLoading,
    ville,
    quartierId,
    /** Choix explicite d'une ville : remet le filtre quartier à "tous". */
    selectVille: (villeId: string) => writeCityChoice({ villeId, quartierId: null }),
    selectQuartier: (quartierId: string | null) => {
      if (ville) writeCityChoice({ villeId: ville.id, quartierId });
    },
  };
}
