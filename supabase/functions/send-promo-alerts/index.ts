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

    const { promoId } = await req.json();
    if (!promoId) return jsonError("promoId manquant.", 400);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: promo, error: promoError } = await adminClient
      .from("promos")
      .select("id, titre, commerce_id, commerces(nom, slug, category, ville_id, owner_id)")
      .eq("id", promoId)
      .maybeSingle();
    if (promoError) throw promoError;
    if (!promo) return jsonError("Promo introuvable.", 404);

    const commerce = Array.isArray(promo.commerces) ? promo.commerces[0] : promo.commerces;
    if (!commerce || commerce.owner_id !== user.id) return jsonError("Non autorisé.", 403);

    const { data: subscribers, error: subsError } = await adminClient
      .from("alert_subscriptions")
      .select("email")
      .eq("ville_id", commerce.ville_id)
      .contains("categories", [commerce.category]);
    if (subsError) throw subsError;

    const subject = `Nouvelle offre chez ${commerce.nom}`;
    const html = `
      <p><strong>${commerce.nom}</strong> vient de publier une nouvelle offre : ${promo.titre}.</p>
      <p><a href="${SITE_URL}/commerce/${commerce.slug}">Voir l'offre sur PlaceDuCoin</a></p>
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
