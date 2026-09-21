import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const favoritesQueryKey = (userId: string | undefined) => ["favoris", userId] as const;

// Identifiants des commerces mis en favori par l'utilisateur connecté. La requête ne part que
// s'il y a une session ; sinon la liste est simplement vide.
export function useFavoriteIds(userId: string | undefined) {
  return useQuery({
    queryKey: favoritesQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favoris")
        .select("commerce_id")
        .eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: { commerce_id: string }) => row.commerce_id);
    },
  });
}

export function useToggleFavorite(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commerceId, isFavorite }: { commerceId: string; isFavorite: boolean }) => {
      if (!userId) throw new Error("Connectez-vous pour gérer vos favoris.");
      const { error } = isFavorite
        ? await supabase
            .from("favoris")
            .delete()
            .eq("user_id", userId)
            .eq("commerce_id", commerceId)
        : await supabase.from("favoris").insert({ user_id: userId, commerce_id: commerceId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["favoris"] });
      void queryClient.invalidateQueries({ queryKey: ["favoris-list"] });
    },
  });
}
