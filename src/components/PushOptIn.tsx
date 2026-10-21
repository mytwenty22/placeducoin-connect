import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Loader2, X, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { deCommune } from "@/lib/french";
import { CATEGORIES } from "@/lib/placeducoin-data";
import { useUserPrefs } from "@/lib/user-prefs";
import { useSession } from "@/hooks/use-session";
import { useFavoriteIds } from "@/hooks/use-favorites";
import {
  disableFavoritesPush,
  disablePush,
  enableFavoritesPush,
  enablePush,
  getPushSubscriptionState,
  getPushSupport,
  getSavedPushVille,
  type PushSupport,
} from "@/lib/web-push";

const CARD_DISMISSED_KEY = "spotlocal:push-card-dismissed";

// `enabled` : alertes de commune actives ; `favorites` : Promos Flash des favoris actives. Un même
// navigateur peut avoir l'une, l'autre ou les deux (un seul abonnement push côté navigateur).
type PushState = { support: PushSupport; enabled: boolean; favorites: boolean; denied: boolean };

function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const refresh = async () => {
    const support = getPushSupport();
    const subscription = support === "supported" ? await getPushSubscriptionState() : null;
    setState({
      support,
      enabled: subscription?.ville ?? false,
      favorites: subscription?.favorites ?? false,
      denied: support === "supported" && Notification.permission === "denied",
    });
  };
  useEffect(() => {
    void refresh();
  }, []);
  return { state, refresh };
}

// Catégories des préférences + "locale" (actualités de la mairie) ; aucune sélection = tout.
function useAlertCategories() {
  const { favoriteCategories } = useUserPrefs();
  return favoriteCategories.length > 0
    ? [...favoriteCategories, "locale"]
    : CATEGORIES.map((c) => c.key as string);
}

/**
 * Réglage "Recevoir les bons plans du quartier" du panneau Préférences : active ou coupe les
 * notifications push de ce navigateur pour la commune choisie.
 */
export function PushSettings() {
  const { state, refresh } = usePushState();
  const categories = useAlertCategories();
  const [villeId, setVilleId] = useState("");
  const [busy, setBusy] = useState(false);

  const villesQuery = useQuery({
    queryKey: ["villes-signup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("villes").select("id, nom").order("nom");
      if (error) throw error;
      return data as { id: string; nom: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setVilleId((current) => current || getSavedPushVille() || "");
  }, []);

  async function toggle(next: boolean) {
    if (next && !villeId) {
      toast.error("Choisis d'abord ta commune.");
      return;
    }
    setBusy(true);
    try {
      if (next) await enablePush(villeId, categories);
      else await disablePush();
      toast.success(next ? "Bons plans activés sur cet appareil." : "Notifications coupées.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  async function changeVille(next: string) {
    setVilleId(next);
    // Déjà abonné : on met à jour la commune de l'abonnement existant.
    if (!state?.enabled) return;
    setBusy(true);
    try {
      await enablePush(next, categories);
      toast.success("Commune mise à jour.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Recevoir les bons plans du quartier
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {!state
              ? "…"
              : state.support === "ios-needs-install"
                ? "Sur iPhone, ajoutez d'abord SpotLocal à l'écran d'accueil (Partager > Sur l'écran d'accueil), puis activez-les depuis l'application."
                : state.support === "unsupported"
                  ? "Non prises en charge par ce navigateur."
                  : state.denied
                    ? "Refusées — autorisez les notifications pour spotlocal.fr dans les réglages du navigateur."
                    : "Promos des commerces et actualités de la mairie de ta commune, pour les catégories choisies ci-dessus."}
          </p>
        </div>
        {busy ? (
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        <Switch
          checked={state?.enabled ?? false}
          disabled={!state || state.support !== "supported" || state.denied || busy}
          onCheckedChange={(checked) => void toggle(checked)}
          aria-label="Recevoir les bons plans du quartier"
          className="mt-0.5"
        />
      </div>
      {state?.support === "supported" && !state.denied ? (
        <select
          value={villeId}
          onChange={(e) => void changeVille(e.target.value)}
          disabled={busy}
          aria-label="Commune des notifications"
          className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-navy"
        >
          <option value="">Ta commune</option>
          {villesQuery.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nom}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

/**
 * Invitation discrète affichée sur la page d'accueil : un clic abonne ce navigateur aux bons
 * plans de la commune affichée. Masquée si déjà abonné, refusé, non pris en charge ou fermée.
 */
export function PushOptInCard({ villeId, villeNom }: { villeId: string; villeNom: string }) {
  const { state, refresh } = usePushState();
  const categories = useAlertCategories();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(CARD_DISMISSED_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || !state || state.enabled || state.denied || state.support !== "supported") {
    return null;
  }

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(CARD_DISMISSED_KEY, "1");
    } catch {
      // Sans stockage, la carte réapparaîtra à la prochaine visite.
    }
  }

  async function activate() {
    setBusy(true);
    try {
      await enablePush(villeId, categories);
      toast.success(`Vous recevrez les bons plans de ${villeNom}.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  return (
    <aside className="surface-card flex items-center gap-3 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-promo/10 text-promo">
        <BellRing className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">Recevoir les bons plans du quartier</p>
        <p className="text-xs text-muted-foreground">
          Une notification dès qu'un commerce {deCommune(villeNom)} publie une offre.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void activate()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-navy-soft disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Activer
      </button>
      <button
        type="button"
        aria-label="Fermer"
        onClick={dismiss}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}

const FAVORITES_CARD_DISMISSED_KEY = "spotlocal:favorites-push-card-dismissed";

function useFavoritesPushToggle(refresh: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (next) await enableFavoritesPush();
      else await disableFavoritesPush();
      toast.success(
        next
          ? "Vous serez prévenu des Promos Flash de vos commerces favoris."
          : "Promos Flash des favoris coupées.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  return { busy, toggle };
}

/**
 * Réglage "Promos Flash de mes favoris" du panneau Préférences : réservé aux comptes connectés,
 * puisque ce sont leurs favoris qui déclenchent l'envoi.
 */
export function FavoritesPushSettings() {
  const { session, ready } = useSession();
  const { state, refresh } = usePushState();
  const { busy, toggle } = useFavoritesPushToggle(refresh);
  const signedIn = Boolean(session);

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">Promos Flash de mes favoris</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {!ready || !state
            ? "…"
            : !signedIn
              ? "Connectez-vous pour être prévenu des offres flash de vos commerces favoris."
              : state.support !== "supported" || state.denied
                ? "Indisponible sur ce navigateur (voir ci-dessus)."
                : "Une notification dès qu'un de vos commerces favoris publie une offre flash (4 h ou moins)."}
        </p>
      </div>
      {busy ? (
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
      ) : null}
      <Switch
        checked={state?.favorites ?? false}
        disabled={!signedIn || !state || state.support !== "supported" || state.denied || busy}
        onCheckedChange={(checked) => void toggle(checked)}
        aria-label="Promos Flash de mes favoris"
        className="mt-0.5"
      />
    </div>
  );
}

/**
 * Invitation discrète de la Marketplace : proposée aux comptes connectés qui ont au moins un
 * commerce en favori, tant que les Promos Flash des favoris ne sont pas activées sur ce
 * navigateur. Fermée une fois, elle ne revient plus (le réglage reste dans les Préférences).
 */
export function FavoritesPushCard() {
  const { session } = useSession();
  const userId = session?.user.id;
  const favoritesQuery = useFavoriteIds(userId);
  const { state, refresh } = usePushState();
  const { busy, toggle } = useFavoritesPushToggle(refresh);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(FAVORITES_CARD_DISMISSED_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  const favoriteCount = favoritesQuery.data?.length ?? 0;
  if (
    hidden ||
    !userId ||
    favoriteCount === 0 ||
    !state ||
    state.favorites ||
    state.denied ||
    state.support !== "supported"
  ) {
    return null;
  }

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(FAVORITES_CARD_DISMISSED_KEY, "1");
    } catch {
      // Sans stockage, la carte réapparaîtra à la prochaine visite.
    }
  }

  return (
    <aside className="flex items-center gap-3 rounded-2xl border border-promo/30 bg-promo/5 px-3 py-2.5">
      <Zap className="h-4 w-4 shrink-0 text-promo" aria-hidden />
      <p className="min-w-0 flex-1 text-xs text-foreground">
        <span className="font-bold">Promos Flash</span> : soyez prévenu dès qu'un de vos{" "}
        {favoriteCount > 1 ? `${favoriteCount} commerces favoris` : "commerces favoris"} publie une
        offre flash.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-promo px-3 py-1.5 text-xs font-bold text-promo-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Activer
      </button>
      <button
        type="button"
        aria-label="Fermer"
        onClick={dismiss}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
