import { useSyncExternalStore } from "react";

// Non standard (Chromium uniquement) : absent des types DOM de TypeScript.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "spotlocal:pwa-installed";
const DISMISSED_AT_KEY = "spotlocal:pwa-banner-dismissed-at";
const COUPON_PROMPTED_KEY = "spotlocal:pwa-coupon-prompted";
// Un visiteur qui ferme la bannière ne la revoit pas avant une semaine.
const DISMISS_DURATION_MS = 7 * 24 * 3600 * 1000;

type InstallState = {
  /** Invite native disponible (Chrome/Edge/Samsung Internet sur Android et ordinateur). */
  canPrompt: boolean;
  installed: boolean;
  dismissed: boolean;
  /** Mis à true au premier coupon : la bannière s'affiche même si elle avait été fermée. */
  forced: boolean;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, installed: false, dismissed: false, forced: false };
const SERVER_STATE = state;
const listeners = new Set<() => void>();
let started = false;

function setState(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Navigation privée / stockage bloqué : l'état ne sera simplement pas mémorisé.
  }
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  // iPadOS se présente comme un Mac : on le reconnaît à son écran tactile.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Navigateur intégré à une appli (Instagram, Facebook, appli Google, Snapchat…) : pas d'ajout à
 * l'écran d'accueil possible, il faut d'abord rouvrir la page dans Safari / Chrome.
 */
export function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|Instagram|Snapchat|musical_ly|TikTok|Line\/|LinkedInApp|Pinterest|GSA\//i.test(
    navigator.userAgent,
  );
}

export type InstallPlatform = "ios" | "android" | "in-app";

/** Parcours d'installation manuelle à montrer quand l'invite native n'est pas disponible. */
export function detectInstallPlatform(): InstallPlatform {
  if (isInAppBrowser()) return "in-app";
  return isIos() ? "ios" : "android";
}

export function isMobileDevice() {
  return window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024;
}

function markInstalled() {
  writeStorage(INSTALLED_KEY, "1");
  deferredPrompt = null;
  setState({ installed: true, canPrompt: false, forced: false });
}

/**
 * À appeler une fois au démarrage de l'application (__root) : beforeinstallprompt peut arriver
 * très tôt, avant que la bannière ou le bouton coupon ne soient montés.
 */
export function startInstallTracking() {
  if (started || typeof window === "undefined") return;
  started = true;

  const dismissedAt = Number(readStorage(DISMISSED_AT_KEY) ?? 0);
  if (isStandalone()) markInstalled();
  setState({
    installed: state.installed || readStorage(INSTALLED_KEY) === "1",
    dismissed: Date.now() - dismissedAt < DISMISS_DURATION_MS,
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    // Empêche la mini-barre automatique de Chrome : l'invite est déclenchée par nos boutons.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    // Chrome ne propose l'installation que si l'application n'est pas installée : si un ancien
    // "installé" traîne dans le stockage (application désinstallée depuis), on l'oublie.
    if (state.installed && !isStandalone()) writeStorage(INSTALLED_KEY, "0");
    setState({ canPrompt: true, installed: isStandalone() });
  });
  window.addEventListener("appinstalled", markInstalled);
}

/** Ouvre l'invite native. Renvoie false si elle n'est pas disponible (iOS, Firefox…). */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  setState({ canPrompt: false });
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") markInstalled();
  return true;
}

export function dismissInstallBanner() {
  writeStorage(DISMISSED_AT_KEY, String(Date.now()));
  setState({ dismissed: true, forced: false });
}

/** iOS n'a pas d'événement d'installation : le visiteur confirme lui-même l'ajout. */
export function confirmInstalledManually() {
  markInstalled();
}

/**
 * Premier coupon utilisé : moment idéal pour proposer l'application. Invite native si possible,
 * sinon la bannière (instructions iOS / Android) réapparaît. Une seule fois par appareil.
 */
export function offerInstallOnFirstCoupon() {
  if (typeof window === "undefined" || state.installed) return;
  if (readStorage(COUPON_PROMPTED_KEY) === "1") return;
  writeStorage(COUPON_PROMPTED_KEY, "1");
  if (deferredPrompt) {
    void promptInstall();
    return;
  }
  setState({ forced: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}
