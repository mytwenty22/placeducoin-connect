import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function activateFromSession(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const commerceId = metadata.commerce_id;
  if (!commerceId) return;

  if (metadata.type === "site_pro") {
    await admin
      .from("commerces")
      .update({
        site_actif: true,
        stripe_customer_id: (session.customer as string) ?? null,
        stripe_subscription_id: (session.subscription as string) ?? null,
      })
      .eq("id", commerceId);
    return;
  }

  if (metadata.type === "boost") {
    await admin
      .from("commerces")
      .update({
        boost_actif: true,
        boost_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      .eq("id", commerceId);
    return;
  }

  if (metadata.type === "banner") {
    const position = metadata.position as "top" | "bottom";
    const tier = metadata.tier as string;
    // Même règle de dédoublonnage que la réservation gratuite (src/routes/pro.tsx) : un Test
    // actif existant sur cette position est remplacé, une formule mensuelle remplace uniquement
    // la réservation qui démarre exactement à la même date (un achat à l'avance sur un autre mois
    // doit rester intact).
    const dedup = admin.from("banners").delete().eq("commerce_id", commerceId).eq("position", position);
    if (tier === "test") {
      await dedup.eq("tier", "test").eq("active", true);
    } else {
      await dedup.eq("starts_at", metadata.starts_at);
    }
    await admin.from("banners").insert({
      city_slug: metadata.city_slug,
      image_url: metadata.image_url,
      target_url: metadata.target_url,
      position,
      active: true,
      commerce_id: commerceId,
      tier,
      starts_at: metadata.starts_at,
      expires_at: metadata.expires_at,
      ...(metadata.department_code ? { target_departments: [metadata.department_code] } : {}),
    });
  }
}

async function deactivateSubscription(subscription: Stripe.Subscription) {
  await admin
    .from("commerces")
    .update({ site_actif: false, stripe_subscription_id: null })
    .eq("stripe_subscription_id", subscription.id);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Signature manquante.");
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (error) {
    console.error("Signature Stripe invalide:", (error as Error).message);
    return new Response(`Webhook signature invalide: ${(error as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await activateFromSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.deleted":
        await deactivateSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Erreur de traitement du webhook Stripe:", error);
    return new Response("Erreur interne.", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
