import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { InstallGuideDialog } from "@/components/InstallGuideDialog";
import {
  detectInstallPlatform,
  isIos,
  isMobileDevice,
  promptInstall,
  useInstallState,
  type InstallPlatform,
} from "@/lib/pwa-install";

/**
 * Bouton « Installer » de l'en-tête : invite native (beforeinstallprompt) quand le navigateur la
 * propose, sinon modale d'aide (iPhone : Partager > Sur l'écran d'accueil). Masqué une fois
 * l'application installée, et sur ordinateur quand aucune installation n'est possible.
 */
export function InstallAppButton() {
  const { canPrompt, installed } = useInstallState();
  // Détection d'appareil après le montage : le rendu serveur ne connaît pas le navigateur.
  const [device, setDevice] = useState<{ platform: InstallPlatform; mobile: boolean } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setDevice({ platform: detectInstallPlatform(), mobile: isMobileDevice() || isIos() });
  }, []);

  if (!device || installed) return null;
  if (!canPrompt && !device.mobile) return null;

  async function install() {
    const prompted = await promptInstall();
    if (!prompted) setGuideOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Installer l'application"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-promo px-2.5 py-1.5 text-sm font-semibold text-promo-foreground transition-opacity hover:opacity-90 sm:px-3"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Installer</span>
      </button>
      <InstallGuideDialog open={guideOpen} onOpenChange={setGuideOpen} platform={device.platform} />
    </>
  );
}
