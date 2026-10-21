import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendAlertEmail } from "../_shared/resend.ts";
import { isServiceRoleRequest } from "../_shared/service-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://spotlocal.fr";

// Délai entre le préavis et la suppression (purge_expired_data, migration
// 20261021120000_data_retention.sql).
const NOTICE_DAYS = 30;

const BTN =
  "display:inline-block;background:#0F172A;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function noticeEmail(deletionDate: Date) {
  const date = deletionDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  return {
    subject: "Votre compte SpotLocal sera supprimé faute d'utilisation",
    html: `
<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0F172A;line-height:1.5">
  <h1 style="font-size:20px;margin:0 0 12px">Votre compte SpotLocal est inactif depuis bientôt 3 ans</h1>
  <p style="margin:0 0 12px">Conformément à notre politique de confidentialité, les comptes sans aucune connexion pendant 3 ans sont supprimés, avec leurs favoris et leur historique de coupons.</p>
  <p style="margin:0 0 16px">Sans connexion de votre part, votre compte sera supprimé définitivement le <strong>${date}</strong>.</p>
  <p style="margin:0 0 16px"><a href="${SITE_URL}/compte" style="${BTN}">Me connecter pour garder mon compte</a></p>
  <p style="margin:0;color:#64748B;font-size:13px">Vous ne souhaitez plus utiliser SpotLocal ? Vous n'avez rien à faire : le compte sera supprimé à cette date.</p>
</div>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Appelée uniquement par la tâche pg_cron purge_expired_data, avec la clé service_role
    // stockée dans Vault -- jamais par le client.
    if (!isServiceRoleRequest(req)) return jsonError("Non autorisé.", 401);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: accounts, error } = await adminClient.rpc("accounts_due_for_deletion_notice");
    if (error) throw error;

    const { subject, html } = noticeEmail(new Date(Date.now() + NOTICE_DAYS * 86_400_000));
    let notified = 0;
    for (const account of (accounts ?? []) as { user_id: string; email: string }[]) {
      const result = await sendAlertEmail(account.email, subject, html);
      // Sans préavis enregistré, purge_expired_data ne supprime jamais le compte : un envoi en
      // échec sera retenté le lendemain.
      if (!result.ok) continue;
      const { error: insertError } = await adminClient
        .from("account_deletion_notices")
        .insert({ user_id: account.user_id, email: account.email });
      if (insertError) console.error("Préavis non enregistré pour", account.user_id, insertError);
      else notified++;
    }
    console.log(
      "notify-inactive-accounts: comptes à prévenir =",
      accounts?.length ?? 0,
      "prévenus =",
      notified,
    );

    return new Response(JSON.stringify({ due: accounts?.length ?? 0, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return jsonError((error as Error).message, 500);
  }
});
