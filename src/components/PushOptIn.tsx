import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Loader2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/placeducoin-data";
import { useUserPrefs } from "@/lib/user-prefs";
import {
  disablePush,
  enablePush,
  getCurrentPushSubscription,
  getPushSupport,
  getSavedPushVille,
  type PushSupport,
} from "@/lib/web-push";

const CARD_DISMISSED_KEY = "spotlocal:push-card-dismissed";

type PushState = { support: PushSupport; enabled: boolean; denied: boolean };

function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const refresh = async () => {
    const support = getPushSupport();
    const subscription = support === "supported" ? await getCurrentPushSubscription() : null;
    setState({
      support,
      enabled: subscription !== null,
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
          Une notification dès qu'un commerce de {villeNom} publie une offre.
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
