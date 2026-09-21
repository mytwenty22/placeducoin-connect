import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Même domaine de secours que src/lib/site-url.ts côté client -- garantit une redirection valide
// même si la variable d'env SITE_URL n'est pas configurée sur ce projet Supabase.
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://placeducoin-connect.vercel.app";

type BannerTierKey = "test" | "standard" | "exclusif";

// Grille tarifaire côté serveur, en miroir de BANNER_TIERS dans src/routes/pro.tsx -- le prix
// n'est jamais accepté depuis le client, uniquement recalculé ici à partir de la formule choisie,
// pour qu'un client modifié ne puisse pas payer moins que le tarif affiché.
const BANNER_TIER_PRICES: Record<BannerTierKey, { label: string; amountCents: number }> = {
  test: { label: "Bannière 7 jours (Test)", amountCents: 2900 },
  standard: { label: "Bannière 1 mois (Standard)", amountCents: 9900 },
  exclusif: { label: "Bannière 1 mois (Sponsor Exclusif)", amountCents: 24900 },
};

function bannerWindow(tier: BannerTierKey, monthKey: string): { start: Date; end: Date } {
  if (tier === "test") {
    const start = new Date();
    return { start, end: new Date(start.getTime() + 7 * 24 * 3600 * 1000) };
  }
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

function isBoostActive(commerce: { boost_actif: boolean; boost_expires_at: string | null }) {
  if (!commerce.boost_actif) return false;
  if (!commerce.boost_expires_at) return true;
  return new Date(commerce.boost_expires_at).getTime() > Date.now();
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
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const type = body.type as "site_pro" | "boost" | "banner";

    const { data: commerce, error: commerceError } = await userClient
      .from("commerces")
      .select(
        "id, slug, nom, ville_id, logo_url, photo_url, site_actif, boost_actif, boost_expires_at, stripe_customer_id",
      )
      .eq("owner_id", user.id)
      .maybeSingle();
    if (commerceError) throw commerceError;
    if (!commerce) {
      return new Response(JSON.stringify({ error: "Commerce introuvable." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    let mode: Stripe.Checkout.SessionCreateParams.Mode;
    const metadata: Record<string, string> = { commerce_id: commerce.id, type };

    if (type === "site_pro") {
      if (commerce.site_actif) {
        return new Response(JSON.stringify({ error: "Site Pro déjà actif." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      mode = "subscription";
      lineItem = {
        price_data: {
          currency: "eur",
          product_data: { name: "Place du Coin Connect — Site Pro" },
          unit_amount: 1900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      };
    } else if (type === "boost") {
      if (isBoostActive(commerce)) {
        return new Response(JSON.stringify({ error: "Option déjà active." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      mode = "payment";
      lineItem = {
        price_data: {
          currency: "eur",
          product_data: {
            name: commerce.site_actif ? "Booster à la Une — 24h" : "Option Vedette — 24h",
          },
          unit_amount: 900,
        },
        quantity: 1,
      };
    } else if (type === "banner") {
      const position = body.position as "top" | "bottom";
      const tier = body.tier as BannerTierKey;
      const monthKey = body.monthKey as string;
      const imageUrl = (body.imageUrl as string | undefined)?.trim() || commerce.logo_url || commerce.photo_url;
      if (!["top", "bottom"].includes(position) || !BANNER_TIER_PRICES[tier]) {
        return new Response(JSON.stringify({ error: "Paramètres de bannière invalides." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: "Ajoutez une image pour la bannière avant de payer." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: ville, error: villeError } = await userClient
        .from("villes")
        .select("slug, department_code")
        .eq("id", commerce.ville_id)
        .maybeSingle();
      if (villeError) throw villeError;
      if (!ville) {
        return new Response(JSON.stringify({ error: "Ville introuvable." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { start, end } = bannerWindow(tier, monthKey);
      const tierInfo = BANNER_TIER_PRICES[tier];
      mode = "payment";
      lineItem = {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${tierInfo.label} — ${position === "top" ? "Haut de page" : "Bas de page"}`,
          },
          unit_amount: tierInfo.amountCents,
        },
        quantity: 1,
      };
      Object.assign(metadata, {
        position,
        tier,
        starts_at: start.toISOString(),
        expires_at: end.toISOString(),
        image_url: imageUrl,
        city_slug: ville.slug,
        department_code: ville.department_code ?? "",
        target_url: commerce.site_actif ? `/site/${commerce.slug}` : `/commerce/${commerce.slug}`,
      });
    } else {
      return new Response(JSON.stringify({ error: "Type de paiement inconnu." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let customerId = commerce.stripe_customer_id ?? undefined;
    if (!customerId && user.email) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { commerce_id: commerce.id },
      });
      customerId = customer.id;
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await adminClient
        .from("commerces")
        .update({ stripe_customer_id: customerId })
        .eq("id", commerce.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [lineItem],
      // Affiche automatiquement le champ "Code promo" sur la page de paiement Stripe.
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/pro?checkout=success`,
      cancel_url: `${SITE_URL}/pro?checkout=cancel`,
      client_reference_id: commerce.id,
      metadata,
      subscription_data: mode === "subscription" ? { metadata } : undefined,
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
