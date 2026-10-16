import { supabase } from "@/lib/supabase";

export type StatEventType =
  "app_view" | "google_view" | "offer_view" | "coupon_open" | "coupon_validated";

// Best-effort analytics write: never blocks or surfaces an error to the visitor, since a missed
// view/coupon-open event isn't worth interrupting the page for. commerce_stats_events has no
// promo_id column — a coupon_open/coupon_validated event is only ever tied to the commerce, not
// to which specific promo was opened/redeemed.
export async function logStatEvent(commerceId: string | undefined, eventType: StatEventType) {
  if (!commerceId) return;
  const { error } = await supabase.from("commerce_stats_events").insert({
    commerce_id: commerceId,
    event_type: eventType,
  });
  if (error) console.error("logStatEvent failed:", error.message);
}

const OFFER_VIEWS_KEY = "spotlocal:offer-views";

/**
 * "Vue d'offre" : une carte portant une offre active a été vue à l'écran sur la marketplace.
 * Une seule fois par commerce et par visite (sessionStorage), pour que défiler ou revenir sur
 * l'accueil ne gonfle pas le compteur.
 */
export function logOfferViewOnce(commerceId: string) {
  let seen: string[] = [];
  try {
    seen = JSON.parse(window.sessionStorage.getItem(OFFER_VIEWS_KEY) ?? "[]") as string[];
  } catch {
    seen = [];
  }
  if (seen.includes(commerceId)) return;
  try {
    window.sessionStorage.setItem(OFFER_VIEWS_KEY, JSON.stringify([...seen, commerceId]));
  } catch {
    // Sans stockage, la vue reste comptée une fois par affichage de la page.
  }
  void logStatEvent(commerceId, "offer_view");
}

export function isFromGoogleReferrer(): boolean {
  if (typeof document === "undefined" || !document.referrer) return false;
  try {
    return new URL(document.referrer).hostname.includes("google.");
  } catch {
    return false;
  }
}
