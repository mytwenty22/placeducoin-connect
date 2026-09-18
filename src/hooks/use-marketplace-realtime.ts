import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Une option payante (Vedette, Site Pro, Bannière) ou une promo doit disparaître de la
// marketplace sans délai de cache dès qu'elle est annulée ou supprimée -- on écoute les tables
// concernées en direct plutôt que de compter sur le prochain refetch naturel de React Query.
export function useMarketplaceRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("marketplace-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commerces" },
        () => void queryClient.invalidateQueries({ queryKey: ["commerces-marketplace"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promos" },
        () => void queryClient.invalidateQueries({ queryKey: ["commerces-marketplace"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "banners" },
        () => void queryClient.invalidateQueries({ queryKey: ["sponsor-banner"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
