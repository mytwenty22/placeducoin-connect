import { supabase } from "@/lib/supabase";

export type StatEventType = "app_view" | "google_view" | "coupon_open" | "coupon_validated";

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

export function isFromGoogleReferrer(): boolean {
  if (typeof document === "undefined" || !document.referrer) return false;
  try {
    return new URL(document.referrer).hostname.includes("google.");
  } catch {
    return false;
  }
}
