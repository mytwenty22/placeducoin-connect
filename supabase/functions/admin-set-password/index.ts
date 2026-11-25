import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Changement du mot de passe du propriétaire d'une fiche commerce, depuis /admin.
// Sécurité : l'appelant doit être authentifié ET avoir le rôle 'admin' dans public.profiles
// (vérifié ici, côté serveur, avec la clé service_role). La cible n'est jamais un identifiant
// d'utilisateur fourni par le client : c'est le owner_id de la fiche, relu en base, et la fonction
// refuse de toucher un compte admin ou mairie.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MIN_LENGTH = 8;
// bcrypt (utilisé par Supabase Auth) ignore tout ce qui dépasse 72 octets.
const MAX_BYTES = 72;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non authentifié." }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: callerError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (callerProfile?.role !== "admin") {
      return json({ error: "Réservé aux administrateurs." }, 403);
    }

    const body = (await req.json().catch(() => null)) as {
      commerce_id?: unknown;
      password?: unknown;
    } | null;
    const commerceId = typeof body?.commerce_id === "string" ? body.commerce_id : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!commerceId) return json({ error: "Fiche commerce manquante." }, 400);
    if (password.length < MIN_LENGTH) {
      return json(
        { error: `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.` },
        400,
      );
    }
    if (new TextEncoder().encode(password).length > MAX_BYTES) {
      return json({ error: "Le mot de passe est trop long (72 caractères maximum)." }, 400);
    }

    const { data: commerce, error: commerceError } = await admin
      .from("commerces")
      .select("owner_id")
      .eq("id", commerceId)
      .maybeSingle();
    if (commerceError) throw commerceError;
    if (!commerce) return json({ error: "Fiche introuvable." }, 404);
    if (!commerce.owner_id) {
      return json({ error: "Cette fiche n'a pas de compte propriétaire." }, 400);
    }

    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", commerce.owner_id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (targetProfile?.role === "admin" || targetProfile?.role === "mairie") {
      return json(
        { error: "Le mot de passe d'un compte admin ou mairie ne se change pas ici." },
        403,
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(commerce.owner_id, {
      password,
    });
    if (updateError) return json({ error: updateError.message }, 400);

    console.log(`admin-set-password: admin ${user.id} → owner of commerce ${commerceId}`);
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Erreur interne." }, 500);
  }
});
