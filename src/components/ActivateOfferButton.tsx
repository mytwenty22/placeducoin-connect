import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MapPin, ShoppingBag, X } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { GeoPositionError, getCurrentPositionOnce, positionErrorMessage } from "@/lib/geo";
import { supabase } from "@/lib/supabase";

// Au-delà, la précision annoncée par le GPS est trop faible pour prouver une présence dans un
// rayon de 100 m (position "réseau" d'un ordinateur, GPS pas encore verrouillé en intérieur…).
const MAX_ACCURACY_M = 150;

type ActivateResponse =
  | { status: "activated" | "already_active" | "already_used"; expires_at: string }
  | { status: "too_far"; distance_m: number }
  | { status: "no_location" | "promo_unavailable" | "own_commerce" };

type Feedback = { tone: "info" | "error"; text: string };

function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.max(1, Math.round(meters))} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Recalcule "maintenant" chaque seconde tant que `active`, pour piloter le compte à rebours.
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function ConfirmationScreen({
  shopName,
  promoTitle,
  secondsLeft,
  onClose,
}: {
  shopName: string;
  promoTitle: string;
  secondsLeft: number;
  onClose: () => void;
}) {
  const expired = secondsLeft <= 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Offre activée"
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center text-white ${
        expired ? "bg-slate-700" : "bg-emerald-600"
      }`}
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/20 p-2 hover:bg-black/30"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <X className="h-5 w-5" />
      </button>

      <CheckCircle2 className="h-20 w-20" aria-hidden />
      <p className="mt-4 text-sm font-bold uppercase tracking-widest text-white/80">{shopName}</p>
      <h2 className="mt-2 font-display text-3xl font-extrabold">
        {expired ? "Offre expirée" : "Offre validée !"}
      </h2>
      <p className="mt-3 max-w-sm text-lg font-semibold leading-snug">{promoTitle}</p>

      {expired ? (
        <p className="mt-6 max-w-xs text-sm text-white/80">
          Le délai de 10 minutes est écoulé. Cette offre ne peut plus être présentée en caisse.
        </p>
      ) : (
        <>
          <p
            className="mt-8 font-display text-6xl font-black tabular-nums"
            role="timer"
            aria-live="off"
          >
            {formatCountdown(secondsLeft)}
          </p>
          <p className="mt-3 max-w-xs text-sm text-white/85">
            Présentez cet écran en caisse avant la fin du compte à rebours.
          </p>
        </>
      )}
    </div>
  );
}

export function ActivateOfferButton({
  promoId,
  shopName,
  promoTitle,
  compact = false,
  className = "",
}: {
  promoId: string;
  shopName: string;
  promoTitle: string;
  compact?: boolean;
  className?: string;
}) {
  const { session, ready } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"locating" | "checking" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [screenOpen, setScreenOpen] = useState(false);

  // Une activation déjà faite par ce client (même après un rechargement de page) : c'est elle qui
  // dit s'il peut rouvrir l'écran vert (< 10 min) ou si l'offre est consommée.
  const activationQuery = useQuery({
    queryKey: ["promo-activation", promoId, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_activations")
        .select("expires_at")
        .eq("promo_id", promoId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as { expires_at: string } | null;
    },
  });

  const expiresAt = activationQuery.data
    ? new Date(activationQuery.data.expires_at).getTime()
    : null;
  const now = useNow(expiresAt !== null);
  const secondsLeft = expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const isActive = expiresAt !== null && secondsLeft > 0;
  const isUsed = expiresAt !== null && secondsLeft <= 0;

  const sizeClass = compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  async function handleClick() {
    setFeedback(null);

    if (!userId) {
      setFeedback({ tone: "info", text: "Connectez-vous pour profiter de cette offre en caisse." });
      return;
    }
    if (isActive) {
      setScreenOpen(true);
      return;
    }

    setBusy("locating");
    let position;
    try {
      position = await getCurrentPositionOnce();
    } catch (error) {
      setBusy(null);
      setFeedback({
        tone: "error",
        text: positionErrorMessage(error instanceof GeoPositionError ? error.kind : "unavailable"),
      });
      return;
    }
    if (position.accuracyM > MAX_ACCURACY_M) {
      setBusy(null);
      setFeedback({
        tone: "error",
        text: `Votre position est trop imprécise (± ${Math.round(position.accuracyM)} m) pour vérifier votre présence en boutique. Activez le GPS de votre téléphone et réessayez.`,
      });
      return;
    }

    setBusy("checking");
    const { data, error } = await supabase.rpc("activate_promo", {
      p_promo_id: promoId,
      p_lat: position.lat,
      p_lng: position.lng,
    });
    setBusy(null);

    if (error) {
      setFeedback({
        tone: "error",
        text: "Impossible de valider l'offre pour le moment. Réessayez dans un instant.",
      });
      return;
    }

    const result = data as ActivateResponse;
    switch (result.status) {
      case "activated":
      case "already_active":
        await queryClient.invalidateQueries({ queryKey: ["promo-activation", promoId, userId] });
        setScreenOpen(true);
        return;
      case "already_used":
        await queryClient.invalidateQueries({ queryKey: ["promo-activation", promoId, userId] });
        setFeedback({ tone: "info", text: "Vous avez déjà profité de cette offre." });
        return;
      case "too_far":
        setFeedback({
          tone: "error",
          text: `Vous devez être présent en boutique pour activer cette promo (vous êtes à environ ${formatDistance(result.distance_m)} du commerce).`,
        });
        return;
      case "own_commerce":
        setFeedback({
          tone: "info",
          text: "Vous ne pouvez pas activer les offres de votre propre commerce.",
        });
        return;
      case "no_location":
        setFeedback({
          tone: "error",
          text: "Ce commerce n'a pas encore renseigné sa position : l'activation en caisse n'est pas disponible.",
        });
        return;
      default:
        setFeedback({ tone: "error", text: "Cette offre n'est plus disponible." });
    }
  }

  // Tant que la session n'est pas relue, ne pas afficher un bouton "Connectez-vous" trompeur.
  if (!ready) return null;

  return (
    <div className={className}>
      {isUsed ? (
        <p
          className={`inline-flex items-center gap-1.5 rounded-xl bg-secondary font-semibold text-muted-foreground ${sizeClass}`}
        >
          <CheckCircle2 className={iconClass} /> Offre déjà utilisée
        </p>
      ) : (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleClick()}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-70 ${sizeClass}`}
        >
          {busy ? (
            <Loader2 className={`${iconClass} animate-spin`} />
          ) : isActive ? (
            <CheckCircle2 className={iconClass} />
          ) : (
            <ShoppingBag className={iconClass} />
          )}
          {busy === "locating"
            ? "Localisation en cours…"
            : busy === "checking"
              ? "Vérification…"
              : isActive
                ? `Voir mon écran de validation (${formatCountdown(secondsLeft)})`
                : "Profiter de cette offre en caisse"}
        </button>
      )}

      {feedback ? (
        <p
          role="status"
          className={`mt-2 flex items-start gap-1.5 text-xs font-medium ${
            feedback.tone === "error" ? "text-red-600" : "text-muted-foreground"
          }`}
        >
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {feedback.text}
            {!userId ? (
              <>
                {" "}
                <Link
                  to="/compte"
                  search={{
                    redirect: typeof window !== "undefined" ? window.location.pathname : "/",
                  }}
                  className="font-bold text-navy underline"
                >
                  Se connecter
                </Link>
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      {screenOpen && expiresAt !== null ? (
        <ConfirmationScreen
          shopName={shopName}
          promoTitle={promoTitle}
          secondsLeft={secondsLeft}
          onClose={() => setScreenOpen(false)}
        />
      ) : null}
    </div>
  );
}
