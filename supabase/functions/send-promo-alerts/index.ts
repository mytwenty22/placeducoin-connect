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
    // Appelée uniquement par le trigger Postgres promo_alert_trigger (voir migration
    // 20260922140000_reliable_alert_triggers.sql), authentifié avec la clé service_role stockée
    // dans Vault -- jamais directement par le client, donc pas de vérification de propriétaire ici :
    // le trigger ne se déclenche que sur une ligne déjà insérée avec succès (RLS déjà appliquée).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`)
      return jsonError("Non autorisé.", 401);

    const { promoId } = await req.json();
    console.log("send-promo-alerts: reçu promoId =", promoId);
    if (!promoId) return jsonError("promoId manquant.", 400);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: promo, error: promoError } = await adminClient
      .from("promos")
      .select("id, titre, commerce_id, commerces(nom, slug, category, ville_id)")
      .eq("id", promoId)
      .maybeSingle();
    if (promoError) throw promoError;
    if (!promo) return jsonError("Promo introuvable.", 404);

    const commerce = Array.isArray(promo.commerces) ? promo.commerces[0] : promo.commerces;
    if (!commerce) return jsonError("Commerce introuvable.", 404);
    console.log(
      "send-promo-alerts: commerce =",
      commerce.nom,
      "category =",
      commerce.category,
      "ville_id =",
      commerce.ville_id,
    );

    const { data: subscribers, error: subsError } = await adminClient
      .from("alert_subscriptions")
      .select("email")
      .eq("ville_id", commerce.ville_id)
      .contains("categories", [commerce.category]);
    if (subsError) throw subsError;
    console.log(
      "send-promo-alerts: abonnés trouvés =",
      subscribers?.length ?? 0,
      subscribers?.map((s) => s.email),
    );

    const subject = `Nouvelle offre chez ${commerce.nom}`;
    const html = `
      <p><strong>${commerce.nom}</strong> vient de publier une nouvelle offre : ${promo.titre}.</p>
      <p><a href="${SITE_URL}/commerce/${commerce.slug}">Voir l'offre sur PlaceDuCoin</a></p>
    `;

    const results = await Promise.all(
      (subscribers ?? []).filter((s) => s.email).map((s) => sendAlertEmail(s.email, subject, html)),
    );
    const sent = results.filter((r) => r.ok).length;
    console.log("send-promo-alerts: résultats =", JSON.stringify(results));

    // Notification en base pour les clients connectés qui ont ce commerce en favori -- visible dans
    // l'écran Notifications de l'app même s'ils ne naviguent pas dessus au moment de la publication.
    const { data: favUsers, error: favError } = await adminClient
      .from("favoris")
      .select("user_id")
      .eq("commerce_id", promo.commerce_id);
    if (favError) throw favError;
    console.log("send-promo-alerts: favoris trouvés =", favUsers?.length ?? 0);

    if (favUsers && favUsers.length > 0) {
      const { error: notifError } = await adminClient.from("notifications").insert(
        favUsers.map((f) => ({
          user_id: f.user_id,
          title: `Nouvelle offre chez ${commerce.nom}`,
          body: promo.titre,
          commerce_slug: commerce.slug,
        })),
      );
      if (notifError) console.error("send-promo-alerts: échec insertion notifications", notifError);
    }

    return new Response(JSON.stringify({ sent, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return jsonError((error as Error).message, 500);
  }
});
