import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { SpotLocalMark } from "@/components/SpotLocalLogo";
import {
  confirmInstalledManually,
  dismissInstallBanner,
  isIos,
  isMobileDevice,
  promptInstall,
  useInstallState,
} from "@/lib/pwa-install";

/**
 * Bandeau d'invitation à ajouter SpotLocal à l'écran d'accueil (PWA). Affiché sur mobile, ou sur
 * tout appareil pour les visiteurs arrivés via le QR code de l'affiche vitrine (`?app=1`). Masqué
 * une fois l'application installée, et pendant une semaine après fermeture — sauf au premier
 * coupon utilisé (voir offerInstallOnFirstCoupon).
 */
export function InstallAppBanner() {
  const { canPrompt, installed, dismissed, forced } = useInstallState();
  // Détection d'appareil après le montage : le rendu serveur ne connaît pas le navigateur.
  const [device, setDevice] = useState<{ eligible: boolean; ios: boolean } | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const fromPoster = new URLSearchParams(window.location.search).get("app") === "1";
    setDevice({ eligible: fromPoster || isMobileDevice(), ios: isIos() });
  }, []);

  if (!device || installed) return null;
  if (!forced && (dismissed || !device.eligible)) return null;

  const { ios } = device;

  async function install() {
    const prompted = await promptInstall();
    if (!prompted) setShowSteps(true);
  }

  return (
    <div
      role="region"
      aria-label="Ajouter SpotLocal à l'écran d'accueil"
      className="fixed inset-x-3 z-50 mx-auto max-w-md rounded-2xl bg-navy p-3 pr-2 text-primary-foreground shadow-lift"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-promo text-promo-foreground">
          <SpotLocalMark className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug">
            Ajoutez SpotLocal à votre écran d'accueil
          </p>
          <p className="text-xs text-primary-foreground/70">
            Pour accéder à vos réductions en 1 clic.
          </p>
        </div>
        {canPrompt ? (
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-promo px-3 py-2 text-xs font-bold text-promo-foreground hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> Installer
          </button>
        ) : !showSteps ? (
          <button
            type="button"
            onClick={() => setShowSteps(true)}
            className="shrink-0 rounded-xl bg-promo px-3 py-2 text-xs font-bold text-promo-foreground hover:opacity-90"
          >
            Comment ?
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Fermer"
          onClick={dismissInstallBanner}
          className="shrink-0 rounded-full p-1.5 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showSteps && !canPrompt ? (
        <div className="mt-3 rounded-xl bg-primary-foreground/10 p-3 text-xs">
          <ol className="space-y-1.5">
            {ios ? (
              <>
                <li className="flex items-center gap-2">
                  <Step n={1} /> Appuyez sur <Share className="h-4 w-4 shrink-0" />
                  <strong>Partager</strong> dans la barre de Safari
                </li>
                <li className="flex items-center gap-2">
                  <Step n={2} /> Choisissez <SquarePlus className="h-4 w-4 shrink-0" />
                  <strong>Sur l'écran d'accueil</strong>
                </li>
              </>
            ) : (
              <>
                <li className="flex items-center gap-2">
                  <Step n={1} /> Ouvrez le menu <MoreVertical className="h-4 w-4 shrink-0" /> du
                  navigateur
                </li>
                <li className="flex items-center gap-2">
                  <Step n={2} /> Appuyez sur <strong>Installer l'application</strong>
                </li>
              </>
            )}
            <li className="flex items-center gap-2">
              <Step n={3} /> Validez avec <strong>Ajouter</strong>
            </li>
          </ol>
          <button
            type="button"
            onClick={confirmInstalledManually}
            className="mt-3 w-full rounded-lg bg-primary-foreground/15 py-2 font-bold hover:bg-primary-foreground/20"
          >
            C'est fait
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-promo text-[11px] font-bold text-promo-foreground">
      {n}
    </span>
  );
}
