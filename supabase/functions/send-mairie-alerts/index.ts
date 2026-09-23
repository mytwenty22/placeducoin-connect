import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendAlertEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://placeducoin-connect.vercel.app";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Appelée uniquement par le trigger Postgres mairie_alert_trigger (voir migration
    // 20260922140000_reliable_alert_triggers.sql), authentifié avec la clé service_role stockée
    // dans Vault -- jamais directement par le client.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`)
      return jsonError("Non autorisé.", 401);

    const { infoId } = await req.json();
    console.log("send-mairie-alerts: reçu infoId =", infoId);
    if (!infoId) return jsonError("infoId manquant.", 400);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: info, error: infoError } = await adminClient
      .from("Infos_Mairie")
      .select("id, titre, corps, type, ville_id")
      .eq("id", infoId)
      .maybeSingle();
    if (infoError) throw infoError;
    if (!info) return jsonError("Publication introuvable.", 404);
    console.log("send-mairie-alerts: info =", info.titre, "ville_id =", info.ville_id);

    const { data: subscribers, error: subsError } = await adminClient
      .from("alert_subscriptions")
      .select("email")
      .eq("ville_id", info.ville_id)
      .contains("categories", ["locale"]);
    if (subsError) throw subsError;
    console.log(
      "send-mairie-alerts: abonnés trouvés =",
      subscribers?.length ?? 0,
      subscribers?.map((s) => s.email),
    );

    const subject = `Mairie — ${info.titre}`;
    const html = `
      <p><strong>${info.type}</strong></p>
      <p>${info.titre}</p>
      ${info.corps ? `<p>${info.corps}</p>` : ""}
      <p><a href="${SITE_URL}/mairie">Voir sur SpotLocal</a></p>
    `;

    const results = await Promise.all(
      (subscribers ?? []).filter((s) => s.email).map((s) => sendAlertEmail(s.email, subject, html)),
    );
    const sent = results.filter((r) => r.ok).length;
    console.log("send-mairie-alerts: résultats =", JSON.stringify(results));

    return new Response(JSON.stringify({ sent, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return jsonError((error as Error).message, 500);
  }
});
