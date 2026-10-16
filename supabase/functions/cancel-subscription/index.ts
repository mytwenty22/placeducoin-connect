import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
});
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: commerce, error: commerceError } = await userClient
      .from("commerces")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (commerceError) throw commerceError;
    if (!commerce) {
      return new Response(JSON.stringify({ error: "Commerce introuvable." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Un abonnement réellement payé via Stripe doit être annulé côté Stripe (sinon la facturation
    // continue même si le flag est désactivé côté site) ; un abonnement activé gratuitement en
    // mode démo n'a pas de stripe_subscription_id, on se contente alors du flag.
    // Identifiants Stripe : table privée commerce_billing (service_role uniquement).
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: billing, error: billingError } = await adminClient
      .from("commerce_billing")
      .select("stripe_subscription_id")
      .eq("commerce_id", commerce.id)
      .maybeSingle();
    if (billingError) throw billingError;
    if (billing?.stripe_subscription_id) {
      await stripe.subscriptions.cancel(billing.stripe_subscription_id);
    }

    const { error: updateError } = await adminClient
      .from("commerces")
      .update({ site_actif: false })
      .eq("id", commerce.id);
    if (updateError) throw updateError;
    if (billing) {
      const { error: billingUpdateError } = await adminClient
        .from("commerce_billing")
        .update({ stripe_subscription_id: null, updated_at: new Date().toISOString() })
        .eq("commerce_id", commerce.id);
      if (billingUpdateError) throw billingUpdateError;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
