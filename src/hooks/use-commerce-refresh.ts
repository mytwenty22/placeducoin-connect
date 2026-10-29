import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const CHANNEL = "spotlocal-commerce";

/**
 * Espace Pro : prévient les autres onglets (Site Pro, fiche publique déjà ouverts) qu'une fiche
 * vient d'être modifiée, pour qu'ils se rechargent sans F5.
 */
export function notifyCommerceUpdated(slug: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ slug });
  channel.close();
}

/**
 * Pages publiques d'une fiche : relance le loader quand l'Espace Pro signale une modification de
 * cette fiche, et à chaque retour sur l'onglet (autre appareil, navigateur sans BroadcastChannel).
 */
export function useCommerceRefresh(slug: string) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => void router.invalidate();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (e: MessageEvent<{ slug?: string }>) => {
        if (e.data?.slug === slug) refresh();
      };
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, [router, slug]);
}
