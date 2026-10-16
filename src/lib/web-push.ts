import { supabase } from "@/lib/supabase";

// Clé publique VAPID (publique par nature : elle identifie le serveur d'envoi auprès des services
// push). La clé privée correspondante est le secret VAPID_PRIVATE_KEY des Edge Functions.
export const VAPID_PUBLIC_KEY =
  "BKyfKrufGJjuSn3pOzKIbdU38wS-41tuQEFq1amdh60iYFszA9zZQI3LaXrgwfoTimYassPNM2U5VpjRKDGPbw4";

export type PushSupport = "supported" | "unsupported" | "ios-needs-install";

const VILLE_KEY = "spotlocal:push-ville";

function base64UrlToUint8Array(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // Sur iPhone/iPad, le push Web n'existe que dans l'application ajoutée à l'écran d'accueil.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) return "ios-needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return "unsupported";
  return "supported";
}

async function getRegistration() {
  // Le service worker n'est enregistré qu'en production (voir __root.tsx).
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error("Notifications indisponibles pour le moment : rechargez la page et réessayez.");
  }
  return registration;
}

export async function getCurrentPushSubscription() {
  if (getPushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export function getSavedPushVille() {
  try {
    return window.localStorage.getItem(VILLE_KEY);
  } catch {
    return null;
  }
}

/** Demande l'autorisation, abonne ce navigateur et l'enregistre pour la commune choisie. */
export async function enablePush(villeId: string, categories: string[]) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications refusées : autorisez-les dans les réglages du navigateur."
        : "Autorisation non accordée.",
    );
  }
  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    }));
  const json = subscription.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.["p256dh"] ?? "",
    p_auth: json.keys?.["auth"] ?? "",
    p_ville_id: villeId,
    p_categories: categories,
  });
  if (error) {
    await subscription.unsubscribe();
    throw new Error(error.message);
  }
  try {
    window.localStorage.setItem(VILLE_KEY, villeId);
  } catch {
    // Sans stockage, la commune sera simplement à re-choisir.
  }
}

export async function disablePush() {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;
  await supabase.rpc("delete_push_subscription", { p_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
