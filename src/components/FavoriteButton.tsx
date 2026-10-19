import { useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/use-favorites";
import {
  disableFavoritesPush,
  enableFavoritesPush,
  getPushSubscriptionState,
  getPushSupport,
} from "@/lib/web-push";

const ADDED = "Ajouté à vos favoris.";

function enableFromToast() {
  enableFavoritesPush().then(
    () => toast.success("Alertes Promos Flash activées pour vos favoris."),
    (error: Error) => toast.error(error.message),
  );
}

/**
 * Confirmation d'ajout aux favoris + proposition des alertes Promos Flash (push) :
 *  - notifications pas encore autorisées : message discret avec un bouton « Activer » ; la demande
 *    native du navigateur n'apparaît qu'après ce clic (un refus réflexe serait définitif) ;
 *  - déjà autorisées (ex. bons plans de la commune) : alertes des favoris activées directement,
 *    avec un bouton « Désactiver » ;
 *  - déjà actives, refusées ou navigateur non compatible : simple confirmation.
 */
async function confirmAddedWithPushOffer() {
  if (getPushSupport() !== "supported" || Notification.permission === "denied") {
    toast.success(ADDED);
    return;
  }
  const state = await getPushSubscriptionState();
  if (state.favorites) {
    toast.success(ADDED, { description: "Vous serez prévenu de ses Promos Flash." });
    return;
  }
  if (Notification.permission === "granted") {
    try {
      await enableFavoritesPush();
      toast.success(ADDED, {
        description: "Vous serez prévenu de ses Promos Flash.",
        action: {
          label: "Désactiver",
          onClick: () =>
            void disableFavoritesPush().then(() => toast("Alertes Promos Flash coupées.")),
        },
      });
    } catch {
      toast.success(ADDED);
    }
    return;
  }
  toast.success(ADDED, {
    description: "Recevoir une alerte quand ce commerce publie une Promo Flash ?",
    action: { label: "Activer", onClick: enableFromToast },
    duration: 10_000,
  });
}

export function FavoriteButton({
  commerceId,
  className = "",
}: {
  commerceId: string | undefined;
  className?: string;
}) {
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;
  const favoritesQuery = useFavoriteIds(userId);
  const toggle = useToggleFavorite(userId);

  // Les commerces de démonstration (données statiques) n'existent pas en base : rien à mettre
  // en favori, on n'affiche donc pas le bouton.
  if (!commerceId) return null;

  const isFavorite = favoritesQuery.data?.includes(commerceId) ?? false;

  function handleClick() {
    if (!commerceId) return;
    if (!userId) {
      toast("Connectez-vous pour ajouter ce commerce à vos favoris.", {
        action: {
          label: "Se connecter",
          onClick: () =>
            void navigate({ to: "/compte", search: { redirect: window.location.pathname } }),
        },
      });
      return;
    }
    toggle.mutate(
      { commerceId, isFavorite },
      {
        onSuccess: () => {
          if (isFavorite) toast.success("Retiré de vos favoris.");
          else void confirmAddedWithPushOffer();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      disabled={toggle.isPending}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
        className,
      )}
    >
      <Heart className={`h-4 w-4 ${isFavorite ? "fill-current text-red-500" : ""}`} />
      {isFavorite ? "Dans mes favoris" : "Ajouter aux favoris"}
    </button>
  );
}
