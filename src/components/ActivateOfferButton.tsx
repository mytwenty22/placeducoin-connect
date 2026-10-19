import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, KeyRound, Loader2, MapPin, Ticket, X } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { GeoPositionError, getCurrentPositionOnce, positionErrorMessage } from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { logStatEvent } from "@/lib/stats-tracking";
import { offerInstallOnFirstCoupon } from "@/lib/pwa-install";

// Au-delà, la précision annoncée par le GPS est trop faible pour prouver une présence dans un
// rayon de 100 m (position "réseau" d'un ordinateur, GPS pas encore verrouillé en intérieur…).
const MAX_ACCURACY_M = 150;

type ActivateResponse =
  | { status: "activated" | "already_active" | "already_used"; expires_at: string }
  | { status: "too_far"; distance_m: number }
  | { status: "no_location" | "promo_unavailable" | "own_commerce" };

type PinResponse =
  | { status: "activated" | "already_active" | "already_used"; expires_at: string }
  | { status: "wrong_pin"; attempts_left: number }
  | { status: "locked" | "promo_unavailable" | "own_commerce" };

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

function formatTime(ms: number) {
  return new Date(ms)
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
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

// Garde l'écran allumé pendant le compte à rebours : le commerçant doit pouvoir lire le badge
// sans que le client touche au téléphone. Best-effort (API absente sur certains navigateurs).
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () => {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => {});
    };
    // Le verrou est libéré quand l'onglet passe en arrière-plan : on le redemande au retour.
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

function ConfirmationScreen({
  shopName,
  promoTitle,
  validatedAt,
  secondsLeft,
  onClose,
}: {
  shopName: string;
  promoTitle: string;
  validatedAt: number | null;
  secondsLeft: number;
  onClose: () => void;
}) {
  const used = secondsLeft <= 0;
  useWakeLock(!used);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={used ? "Coupon utilisé" : "Coupon validé"}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center text-white ${
        used ? "bg-slate-700" : "bg-emerald-600"
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

      <p className="text-sm font-bold uppercase tracking-widest text-white/80">{shopName}</p>
      <p className="mt-2 max-w-sm text-lg font-semibold leading-snug">{promoTitle}</p>

      {used ? (
        <>
          <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 font-display text-2xl font-extrabold">
            <CheckCircle2 className="h-7 w-7" aria-hidden /> Coupon utilisé
          </span>
          <p className="mt-6 max-w-xs text-sm text-white/80">
            {validatedAt ? `Validé à ${formatTime(validatedAt)}. ` : ""}Ce coupon ne peut plus être
            présenté en caisse.
          </p>
        </>
      ) : (
        <>
          {/* Badge animé : un écran "vivant" se distingue d'une simple capture d'écran. */}
          <span className="relative mt-8 inline-flex flex-col items-center rounded-3xl bg-white px-6 py-5 text-emerald-700 shadow-2xl">
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-300 ring-2 ring-white" />
            </span>
            <BadgeCheck className="h-14 w-14" aria-hidden />
            <span className="mt-2 font-display text-3xl font-black leading-tight">
              Coupon validé
              <br />à l'instant
            </span>
            {validatedAt ? (
              <span className="mt-1 text-sm font-semibold text-emerald-700/80">
                à {formatTime(validatedAt)}
              </span>
            ) : null}
          </span>
          <p
            className="mt-8 font-display text-6xl font-black tabular-nums"
            role="timer"
            aria-live="off"
          >
            {formatCountdown(secondsLeft)}
          </p>
          <p className="mt-3 max-w-xs text-sm text-white/85">
            Montrez cet écran au commerçant. Passé ce délai, le coupon sera marqué comme utilisé.
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
  commerceId,
  compact = false,
  pinOnly = false,
  className = "",
}: {
  promoId: string;
  shopName: string;
  promoTitle: string;
  commerceId?: string | undefined;
  compact?: boolean;
  /** Commerce sans position GPS : on passe directement à la saisie du code commerçant. */
  pinOnly?: boolean;
  className?: string;
}) {
  const { session, ready } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"locating" | "checking" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [screenOpen, setScreenOpen] = useState(false);
  // Étape "Valider / Annuler" : la validation est définitive, elle se fait devant le commerçant
  // et pas par erreur depuis chez soi.
  const [confirming, setConfirming] = useState(false);
  // Secours quand le GPS ne permet pas de valider (refusé, imprécis, trop loin…) : le code PIN à
  // 4 chiffres du commerce, saisi par le commerçant (ou donné au client) sur ce téléphone.
  const [gpsFailed, setGpsFailed] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState("");

  // Une activation déjà faite par ce client (même après un rechargement de page) : c'est elle qui
  // dit s'il peut rouvrir l'écran vert (< 5 min) ou si le coupon est utilisé.
  const activationQuery = useQuery({
    queryKey: ["promo-activation", promoId, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_activations")
        .select("created_at, expires_at")
        .eq("promo_id", promoId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as { created_at: string; expires_at: string } | null;
    },
  });

  const expiresAt = activationQuery.data
    ? new Date(activationQuery.data.expires_at).getTime()
    : null;
  const validatedAt = activationQuery.data
    ? new Date(activationQuery.data.created_at).getTime()
    : null;
  const now = useNow(expiresAt !== null);
  const secondsLeft = expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const isActive = expiresAt !== null && secondsLeft > 0;
  const isUsed = expiresAt !== null && secondsLeft <= 0;

  const sizeClass = compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  function handleStart() {
    setFeedback(null);
    // Premier coupon : on propose d'ajouter SpotLocal à l'écran d'accueil (une seule fois).
    offerInstallOnFirstCoupon();
    if (!userId) {
      setFeedback({ tone: "info", text: "Connectez-vous pour utiliser ce coupon sur place." });
      return;
    }
    if (isActive) {
      setScreenOpen(true);
      return;
    }
    setConfirming(true);
    if (pinOnly) setPinMode(true);
    // Remplace "Voir mon coupon" (masqué quand la validation sur place existe) dans la
    // statistique "Coupons ouverts" de l'espace Pro.
    void logStatEvent(commerceId, "coupon_open");
  }

  async function handleValidate() {
    setFeedback(null);
    setBusy("locating");
    let position;
    try {
      position = await getCurrentPositionOnce();
    } catch (error) {
      setBusy(null);
      setGpsFailed(true);
      setFeedback({
        tone: "error",
        text: positionErrorMessage(error instanceof GeoPositionError ? error.kind : "unavailable"),
      });
      return;
    }
    if (position.accuracyM > MAX_ACCURACY_M) {
      setBusy(null);
      setGpsFailed(true);
      setFeedback({
        tone: "error",
        text: `Votre position est trop imprécise (± ${Math.round(position.accuracyM)} m) pour vérifier votre présence sur place. Activez le GPS de votre téléphone et réessayez.`,
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
        text: "Impossible de valider le coupon pour le moment. Réessayez dans un instant.",
      });
      return;
    }

    const result = data as ActivateResponse;
    switch (result.status) {
      case "activated":
      case "already_active":
        setConfirming(false);
        await queryClient.invalidateQueries({ queryKey: ["promo-activation", promoId, userId] });
        setScreenOpen(true);
        return;
      case "already_used":
        setConfirming(false);
        await queryClient.invalidateQueries({ queryKey: ["promo-activation", promoId, userId] });
        setFeedback({ tone: "info", text: "Vous avez déjà utilisé ce coupon." });
        return;
      case "too_far":
        setGpsFailed(true);
        setFeedback({
          tone: "error",
          text: `Vous devez être sur place pour valider ce coupon (vous êtes à environ ${formatDistance(result.distance_m)} du commerce).`,
        });
        return;
      case "own_commerce":
        setFeedback({
          tone: "info",
          text: "Vous ne pouvez pas valider les coupons de votre propre commerce.",
        });
        return;
      case "no_location":
        setGpsFailed(true);
        setFeedback({
          tone: "error",
          text: "Ce commerce n'a pas encore renseigné sa position : validez avec le code du commerçant.",
        });
        return;
      default:
        setFeedback({ tone: "error", text: "Ce coupon n'est plus disponible." });
    }
  }

  async function handleValidatePin() {
    if (!/^\d{4}$/.test(pin)) {
      setFeedback({ tone: "error", text: "Le code commerçant comporte 4 chiffres." });
      return;
    }
    setFeedback(null);
    setBusy("checking");
    const { data, error } = await supabase.rpc("activate_promo_with_pin", {
      p_promo_id: promoId,
      p_pin: pin,
    });
    setBusy(null);
    setPin("");

    if (error) {
      setFeedback({
        tone: "error",
        text: "Impossible de valider le coupon pour le moment. Réessayez dans un instant.",
      });
      return;
    }

    const result = data as PinResponse;
    switch (result.status) {
      case "activated":
      case "already_active":
        setConfirming(false);
        setPinMode(false);
        setGpsFailed(false);
        await queryClient.invalidateQueries({ queryKey: ["promo-activation", promoId, userId] });
        setScreenOpen(true);
        return;
      case "already_used":
        setConfirming(false);
        setPinMode(false);
        await queryClient.invalidateQueries({ queryKey: ["promo-activation", promoId, userId] });
        setFeedback({ tone: "info", text: "Vous avez déjà utilisé ce coupon." });
        return;
      case "wrong_pin":
        setFeedback({
          tone: "error",
          text:
            result.attempts_left > 0
              ? `Code incorrect. ${result.attempts_left} essai${result.attempts_left > 1 ? "s" : ""} restant${result.attempts_left > 1 ? "s" : ""}.`
              : "Code incorrect. Trop d'essais : réessayez dans 15 minutes.",
        });
        return;
      case "locked":
        setFeedback({
          tone: "error",
          text: "Trop de codes erronés. Réessayez dans 15 minutes.",
        });
        return;
      case "own_commerce":
        setFeedback({
          tone: "info",
          text: "Vous ne pouvez pas valider les coupons de votre propre commerce.",
        });
        return;
      default:
        setFeedback({ tone: "error", text: "Ce coupon n'est plus disponible." });
    }
  }

  function resetConfirm() {
    setConfirming(false);
    setPinMode(false);
    setGpsFailed(false);
    setPin("");
    setFeedback(null);
  }

  // Tant que la session n'est pas relue, ne pas afficher un bouton "Connectez-vous" trompeur.
  if (!ready) return null;

  return (
    <div className={className}>
      {isUsed ? (
        <button
          type="button"
          onClick={() => setScreenOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-secondary font-semibold text-muted-foreground ${sizeClass}`}
        >
          <CheckCircle2 className={iconClass} /> Coupon utilisé
        </button>
      ) : confirming && pinMode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleValidatePin();
          }}
          className="rounded-2xl border border-emerald-600/30 bg-emerald-50 p-3 text-left text-emerald-950"
        >
          <label htmlFor={`pin-${promoId}`} className="block text-xs font-medium leading-snug">
            Code commerçant (4 chiffres) : à saisir par le commerçant, ou demandez-le en caisse.
          </label>
          <input
            id={`pin-${promoId}`}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="mt-2 w-32 rounded-xl border border-emerald-600/40 bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.5em] text-foreground outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy !== null || pin.length !== 4}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-70 ${sizeClass}`}
            >
              {busy ? (
                <Loader2 className={`${iconClass} animate-spin`} />
              ) : (
                <KeyRound className={iconClass} />
              )}
              {busy ? "Vérification…" : "Valider avec ce code"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={resetConfirm}
              className={`inline-flex items-center justify-center rounded-xl bg-white font-semibold text-foreground ring-1 ring-border hover:bg-secondary disabled:opacity-70 ${sizeClass}`}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : confirming ? (
        <div className="rounded-2xl border border-emerald-600/30 bg-emerald-50 p-3 text-left text-emerald-950">
          <p className="text-xs font-medium leading-snug">
            À faire devant le commerçant : votre position est vérifiée, puis le badge « Coupon
            validé » s'affiche 5 minutes. Le coupon est ensuite marqué comme utilisé.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleValidate()}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-70 ${sizeClass}`}
            >
              {busy ? (
                <Loader2 className={`${iconClass} animate-spin`} />
              ) : (
                <BadgeCheck className={iconClass} />
              )}
              {busy === "locating"
                ? "Localisation en cours…"
                : busy === "checking"
                  ? "Vérification…"
                  : "Valider le coupon sur place"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={resetConfirm}
              className={`inline-flex items-center justify-center rounded-xl bg-white font-semibold text-foreground ring-1 ring-border hover:bg-secondary disabled:opacity-70 ${sizeClass}`}
            >
              Annuler
            </button>
          </div>
          {gpsFailed ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setFeedback(null);
                setPinMode(true);
              }}
              className={`mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-navy font-bold text-primary-foreground hover:opacity-90 disabled:opacity-70 ${sizeClass}`}
            >
              <KeyRound className={iconClass} /> Valider avec le code commerçant
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-bold text-white transition-colors hover:bg-emerald-700 ${sizeClass}`}
        >
          {isActive ? <BadgeCheck className={iconClass} /> : <Ticket className={iconClass} />}
          {isActive
            ? `Coupon validé — afficher (${formatCountdown(secondsLeft)})`
            : "Utiliser ce coupon sur place"}
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
                    // Avec la query (?offre=…) : au retour, la même offre reste pré-sélectionnée.
                    redirect:
                      typeof window !== "undefined"
                        ? window.location.pathname + window.location.search
                        : "/",
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
          validatedAt={validatedAt}
          secondsLeft={secondsLeft}
          onClose={() => setScreenOpen(false)}
        />
      ) : null}
    </div>
  );
}
