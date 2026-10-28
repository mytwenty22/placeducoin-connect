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

// Une écriture en échec doit faire échouer le webhook (500) pour que Stripe renvoie l'événement,
// sinon la base reste désynchronisée sans que personne ne le voie.
async function must<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// Abonnement en règle : le Site Pro reste actif. "past_due" aussi, le temps des relances de
// paiement de Stripe ; la suite (annulation ou "unpaid") arrive par un nouvel événement.
const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);
const ENDED_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "unpaid",
  "incomplete_expired",
  "paused",
]);

async function activateFromSession(session: Stripe.Checkout.Session) {
  // Moyen de paiement différé (SEPA…) : la session est "completed" avant l'encaissement, on attend
  // alors checkout.session.async_payment_succeeded.
  if (session.payment_status === "unpaid") return;

  const metadata = session.metadata ?? {};
  const commerceId = metadata.commerce_id;
  if (!commerceId) return;

  if (metadata.type === "site_pro") {
    await must(admin.from("commerces").update({ site_actif: true }).eq("id", commerceId));
    // Identifiants Stripe : table privée commerce_billing, jamais dans commerces (lecture publique).
    await must(
      admin.from("commerce_billing").upsert({
        commerce_id: commerceId,
        stripe_customer_id: (session.customer as string) ?? null,
        stripe_subscription_id: (session.subscription as string) ?? null,
        updated_at: new Date().toISOString(),
      }),
    );
    return;
  }

  if (metadata.type === "boost") {
    await must(
      admin
        .from("commerces")
        .update({
          boost_actif: true,
          boost_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        })
        .eq("id", commerceId),
    );
    return;
  }

  if (metadata.type === "banner") {
    const position = metadata.position as "top" | "bottom";
    const tier = metadata.tier as string;
    // Même règle de dédoublonnage que la réservation gratuite (src/routes/pro.tsx) : un Test
    // actif existant sur cette position est remplacé, une formule mensuelle remplace uniquement
    // la réservation qui démarre exactement à la même date (un achat à l'avance sur un autre mois
    // doit rester intact).
    const dedup = admin
      .from("banners")
      .delete()
      .eq("commerce_id", commerceId)
      .eq("position", position);
    if (tier === "test") {
      await must(dedup.eq("tier", "test").eq("active", true));
    } else {
      await must(dedup.eq("starts_at", metadata.starts_at));
    }
    await must(
      admin.from("banners").insert({
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
      }),
    );
  }
}

async function commercesOfSubscription(subscriptionId: string) {
  const billing = await must(
    admin
      .from("commerce_billing")
      .select("commerce_id")
      .eq("stripe_subscription_id", subscriptionId),
  );
  return (billing ?? []).map((b) => b.commerce_id as string);
}

async function deactivateSubscription(subscriptionId: string) {
  // Seuls les commerces rattachés à cet abonnement : un Site Pro activé sans Stripe (offert) ou
  // déjà passé sur un nouvel abonnement n'est pas touché.
  const commerceIds = await commercesOfSubscription(subscriptionId);
  if (commerceIds.length === 0) return;
  await must(admin.from("commerces").update({ site_actif: false }).in("id", commerceIds));
  await must(
    admin
      .from("commerce_billing")
      .update({ stripe_subscription_id: null, updated_at: new Date().toISOString() })
      .in("commerce_id", commerceIds),
  );
}

async function reactivateSubscription(subscription: Stripe.Subscription) {
  const commerceIds = await commercesOfSubscription(subscription.id);
  // Repli sur les métadonnées posées à la création (subscription_data.metadata) si la ligne de
  // facturation a été perdue ou effacée, sans écraser un autre abonnement rattaché au commerce.
  const fallbackId =
    subscription.metadata?.type === "site_pro" ? subscription.metadata.commerce_id : undefined;
  if (commerceIds.length === 0 && fallbackId) {
    const billing = await must(
      admin
        .from("commerce_billing")
        .select("stripe_subscription_id")
        .eq("commerce_id", fallbackId)
        .maybeSingle(),
    );
    if (!billing?.stripe_subscription_id) commerceIds.push(fallbackId);
  }
  if (commerceIds.length === 0) return;
  await must(admin.from("commerces").update({ site_actif: true }).in("id", commerceIds));
  await must(
    admin.from("commerce_billing").upsert(
      commerceIds.map((id) => ({
        commerce_id: id,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        updated_at: new Date().toISOString(),
      })),
    ),
  );
}

// Les événements peuvent arriver dans le désordre ou en double : on relit l'état courant de
// l'abonnement chez Stripe plutôt que de se fier à la charge utile de l'événement.
async function syncSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  // Résiliation programmée (cancel_at_period_end) : le statut reste "active" jusqu'à l'échéance,
  // le Site Pro aussi ; customer.subscription.deleted le coupe ensuite.
  if (ACTIVE_STATUSES.has(subscription.status)) {
    await reactivateSubscription(subscription);
  } else if (ENDED_STATUSES.has(subscription.status)) {
    await deactivateSubscription(subscription.id);
  }
  // "incomplete" : premier paiement en cours, checkout.session.completed s'en charge.
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
      case "checkout.session.async_payment_succeeded":
        await activateFromSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await syncSubscription((event.data.object as Stripe.Subscription).id);
        break;
      case "customer.subscription.deleted":
        await deactivateSubscription((event.data.object as Stripe.Subscription).id);
        break;
      case "invoice.paid": {
        // Renouvellement mensuel (ou régularisation d'un impayé) : confirme le Site Pro.
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.subscription === "string") await syncSubscription(invoice.subscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Erreur de traitement du webhook Stripe (${event.type}):`, error);
    return new Response("Erreur interne.", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
