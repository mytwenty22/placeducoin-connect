import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// Non standard (Chromium uniquement) : absent des types DOM de TypeScript.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Bandeau d'invitation à installer l'application SpotLocal (PWA). Il n'apparaît que pour
 * les visiteurs arrivés via le QR code de l'affiche vitrine (`?app=1` dans l'URL) et qui n'ont pas
 * déjà installé l'application : un client qui scanne l'affiche voit la fiche du commerce ET la
 * proposition de garder SpotLocal sur son écran d'accueil.
 */
export function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("app") !== "1") return;
    if (isStandalone()) return;
    setVisible(true);
    setIos(isIos());

    const onPrompt = (event: Event) => {
      // Empêche la mini-barre d'installation automatique de Chrome : on déclenche l'invite
      // nous-mêmes au clic sur le bouton.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === "accepted") setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Installer l'application SpotLocal"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-navy p-3 pr-2 text-primary-foreground shadow-lift"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-promo font-display text-lg font-black text-promo-foreground">
        S
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Installez SpotLocal</p>
        {installEvent ? (
          <p className="text-xs text-primary-foreground/70">
            Retrouvez les promos de vos commerçants en un geste.
          </p>
        ) : ios ? (
          <p className="text-xs text-primary-foreground/70">
            Appuyez sur <Share className="inline h-3 w-3 align-[-1px]" /> puis « Sur l'écran
            d'accueil ».
          </p>
        ) : (
          <p className="text-xs text-primary-foreground/70">
            Ouvrez le menu de votre navigateur puis « Installer l'application ».
          </p>
        )}
      </div>
      {installEvent ? (
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-promo px-3 py-2 text-xs font-bold text-promo-foreground hover:opacity-90"
        >
          <Download className="h-3.5 w-3.5" /> Installer
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => setVisible(false)}
        className="shrink-0 rounded-full p-1.5 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
