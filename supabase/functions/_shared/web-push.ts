import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "https://spotlocal.fr";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;

/**
 * Envoie une notification push à tous les navigateurs abonnés aux bons plans de cette commune
 * (table push_subscriptions) pour l'une de ces catégories. Les abonnements expirés (404/410 du
 * service push) sont supprimés. Un échec n'interrompt jamais l'envoi des alertes e-mail.
 */
export async function sendPushToVille(
  admin: SupabaseClient,
  villeId: string,
  category: string,
  payload: PushPayload,
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes -- push non envoyé.");
    return { sent: 0, failed: 0 };
  }
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("ville_id", villeId)
    .contains("categories", [category]);
  if (error) {
    console.error("push_subscriptions:", error.message);
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify(payload);
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 24 * 3600 },
        );
        sent++;
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
  console.log(`push: ${sent} envoyé(s), ${failed} échec(s), ${expired.length} expiré(s)`);
  return { sent, failed };
}
