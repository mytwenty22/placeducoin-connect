import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendAlertEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return jsonError("Non authentifié.", 401);

    const { infoId } = await req.json();
    if (!infoId) return jsonError("infoId manquant.", 400);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: info, error: infoError } = await adminClient
      .from("Infos_Mairie")
      .select("id, titre, corps, type, ville_id, created_by")
      .eq("id", infoId)
      .maybeSingle();
    if (infoError) throw infoError;
    if (!info) return jsonError("Publication introuvable.", 404);
    if (info.created_by !== user.id) return jsonError("Non autorisé.", 403);

    const { data: subscribers, error: subsError } = await adminClient
      .from("alert_subscriptions")
      .select("email")
      .eq("ville_id", info.ville_id)
      .contains("categories", ["locale"]);
    if (subsError) throw subsError;

    const subject = `Mairie — ${info.titre}`;
    const html = `
      <p><strong>${info.type}</strong></p>
      <p>${info.titre}</p>
      ${info.corps ? `<p>${info.corps}</p>` : ""}
      <p><a href="${SITE_URL}/mairie">Voir sur PlaceDuCoin</a></p>
    `;

    const results = await Promise.allSettled(
      (subscribers ?? []).filter((s) => s.email).map((s) => sendAlertEmail(s.email, subject, html)),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return jsonError((error as Error).message, 500);
  }
});
