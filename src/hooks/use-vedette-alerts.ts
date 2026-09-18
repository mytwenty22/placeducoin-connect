import { useEffect } from "react";
import type { CategoryKey, CommerceListing } from "@/lib/placeducoin-data";
import { addNotification, hasSeenOffer, markOfferSeen } from "@/lib/notifications-store";

/**
 * Génère une notification pour chaque commerce En Vedette / Sponsorisé qui entre dans le rayon et
 * les catégories choisies par l'utilisateur, une seule fois par commerce (suivi via localStorage).
 */
export function useVedetteAlerts(
  commerces: CommerceListing[],
  options: { radiusKm: number; favoriteCategories: CategoryKey[]; hasPosition: boolean },
) {
  const { radiusKm, favoriteCategories, hasPosition } = options;

  useEffect(() => {
    if (!hasPosition) return;

    for (const commerce of commerces) {
      if (!commerce.sponsored) continue;
      if (commerce.distanceKm > radiusKm) continue;
      if (favoriteCategories.length > 0 && !favoriteCategories.includes(commerce.category))
        continue;
      if (hasSeenOffer(commerce.id)) continue;

      markOfferSeen(commerce.id);
      addNotification({
        title: `Offre en vedette près de vous : ${commerce.shop}`,
        body: `${commerce.promos[0]?.title ?? commerce.trade} — à ${commerce.distanceKm.toFixed(1)} km`,
        category: commerce.category,
        shop: commerce.shop,
        slug: commerce.slug,
        distanceKm: commerce.distanceKm,
      });
    }
  }, [commerces, radiusKm, favoriteCategories, hasPosition]);
}
