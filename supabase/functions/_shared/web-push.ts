import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "https://spotlocal.fr";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type PushResult = { sent: number; failed: number; subscriptionIds: string[] };

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

let configured = false;

function ensureConfigured() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes -- push non envoyé.");
    return false;
  }
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

// Envoi à une liste d'abonnements ; ceux que le service push déclare expirés (404/410) sont
// supprimés. `subscriptionIds` : abonnements effectivement atteints (pour éviter un doublon).
async function sendToSubscriptions(
  admin: SupabaseClient,
  subscriptions: SubscriptionRow[],
  payload: PushPayload,
  label: string,
): Promise<PushResult> {
  const body = JSON.stringify(payload);
  const expired: string[] = [];
  const reached: string[] = [];
  let failed = 0;
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 24 * 3600 },
        );
        reached.push(s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(s.id);
        else {
          failed++;
          console.error("Échec push", status, (err as Error).message);
        }
      }
    }),
  );

  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }
  console.log(
    `push ${label}: ${reached.length} envoyé(s), ${failed} échec(s), ${expired.length} expiré(s)`,
  );
  return { sent: reached.length, failed, subscriptionIds: reached };
}

/**
 * Envoie une notification push à tous les navigateurs abonnés aux bons plans de cette commune
 * (table push_subscriptions) pour l'une de ces catégories, sauf ceux de `excludeIds` (déjà
 * prévenus autrement). Un échec n'interrompt jamais l'envoi des alertes e-mail.
 */
export async function sendPushToVille(
  admin: SupabaseClient,
  villeId: string,
  category: string,
  payload: PushPayload,
  excludeIds: string[] = [],
): Promise<PushResult> {
  if (!ensureConfigured()) return { sent: 0, failed: 0, subscriptionIds: [] };

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("ville_id", villeId)
    .contains("categories", [category]);
  if (error) {
    console.error("push_subscriptions:", error.message);
    return { sent: 0, failed: 0, subscriptionIds: [] };
  }
  const excluded = new Set(excludeIds);
  return sendToSubscriptions(
    admin,
    (subscriptions ?? []).filter((s) => !excluded.has(s.id)),
    payload,
    "commune",
  );
}

/**
 * Promos Flash : notification aux navigateurs dont l'utilisateur a ce commerce en favori et a
 * activé "Promos Flash de mes favoris" (push_subscriptions.notify_favorites), quelle que soit
 * leur commune.
 */
export async function sendPushToFavorites(
  admin: SupabaseClient,
  commerceId: string,
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureConfigured()) return { sent: 0, failed: 0, subscriptionIds: [] };

  const { data: favoris, error: favError } = await admin
    .from("favoris")
    .select("user_id")
    .eq("commerce_id", commerceId);
  if (favError) {
    console.error("favoris:", favError.message);
    return { sent: 0, failed: 0, subscriptionIds: [] };
  }
  const userIds = [...new Set((favoris ?? []).map((f) => f.user_id as string))];
  if (userIds.length === 0) return { sent: 0, failed: 0, subscriptionIds: [] };

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("notify_favorites", true)
    .in("user_id", userIds);
  if (error) {
    console.error("push_subscriptions (favoris):", error.message);
    return { sent: 0, failed: 0, subscriptionIds: [] };
  }
  return sendToSubscriptions(admin, subscriptions ?? [], payload, "favoris");
}
