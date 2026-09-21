import { useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/use-favorites";

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
        onSuccess: () =>
          toast.success(isFavorite ? "Retiré de vos favoris." : "Ajouté à vos favoris."),
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
