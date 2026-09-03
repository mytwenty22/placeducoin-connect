import { useEffect } from "react";
import type { CategoryKey, Offer } from "@/lib/placeducoin-data";
import { addNotification, hasSeenOffer, markOfferSeen } from "@/lib/notifications-store";

/**
 * Génère une notification pour chaque offre En Vedette / Sponsorisée qui entre dans le rayon et
 * les catégories choisies par l'utilisateur, une seule fois par offre (suivi via localStorage).
 */
export function useVedetteAlerts(
  offers: (Offer & { id: string })[],
  options: { radiusKm: number; favoriteCategories: CategoryKey[]; hasPosition: boolean },
) {
  const { radiusKm, favoriteCategories, hasPosition } = options;

  useEffect(() => {
    if (!hasPosition) return;

    for (const offer of offers) {
      if (!offer.sponsored) continue;
      if (offer.distanceKm > radiusKm) continue;
      if (favoriteCategories.length > 0 && !favoriteCategories.includes(offer.category)) continue;
      if (hasSeenOffer(offer.id)) continue;

      markOfferSeen(offer.id);
      addNotification({
        title: `Offre en vedette près de vous : ${offer.shop}`,
        body: `${offer.title} — à ${offer.distanceKm.toFixed(1)} km`,
        category: offer.category,
        shop: offer.shop,
        slug: offer.slug,
        distanceKm: offer.distanceKm,
      });
    }
  }, [offers, radiusKm, favoriteCategories, hasPosition]);
}
