import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { InstallGuideDialog } from "@/components/InstallGuideDialog";
import { SpotLocalMark } from "@/components/SpotLocalLogo";
import {
  detectInstallPlatform,
  dismissInstallBanner,
  isMobileDevice,
  promptInstall,
  useInstallState,
  type InstallPlatform,
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
  const [device, setDevice] = useState<{ eligible: boolean; platform: InstallPlatform } | null>(
    null,
  );
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const fromPoster = new URLSearchParams(window.location.search).get("app") === "1";
    setDevice({ eligible: fromPoster || isMobileDevice(), platform: detectInstallPlatform() });
  }, []);

  if (!device || installed) return null;
  if (!forced && (dismissed || !device.eligible)) return null;

  async function install() {
    const prompted = await promptInstall();
    if (!prompted) setGuideOpen(true);
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
        ) : (
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="shrink-0 rounded-xl bg-promo px-3 py-2 text-xs font-bold text-promo-foreground hover:opacity-90"
          >
            Comment ?
          </button>
        )}
        <button
          type="button"
          aria-label="Fermer"
          onClick={dismissInstallBanner}
          className="shrink-0 rounded-full p-1.5 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <InstallGuideDialog open={guideOpen} onOpenChange={setGuideOpen} platform={device.platform} />
    </div>
  );
}
