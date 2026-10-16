import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Référentiel officiel des communes (API Découpage administratif, publique et sans clé).
const GEO_API_URL = "https://geo.api.gouv.fr/communes";

type Commune = { nom: string; code: string; codeDepartement: string; codesPostaux: string[] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Même règle que src/lib/slugify.ts.
function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Renvoie la ville correspondant à un code INSEE, en la créant si besoin. Le nom, le département
 * et les codes postaux viennent toujours de geo.api.gouv.fr, jamais du client.
 */
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
    if (!user) return json({ error: "Non authentifié." }, 401);

    const { insee } = (await req.json()) as { insee?: string };
    if (!insee || !/^(\d{5}|2[AB]\d{3})$/.test(insee)) {
      return json({ error: "Code commune invalide." }, 400);
    }

    const res = await fetch(
      `${GEO_API_URL}/${insee}?fields=nom,code,codeDepartement,codesPostaux`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.status === 404) return json({ error: "Commune introuvable." }, 400);
    if (!res.ok) return json({ error: "Référentiel des communes indisponible." }, 503);
    const commune = (await res.json()) as Commune;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const patch = {
      nom: commune.nom,
      department_code: commune.codeDepartement,
      codes_postaux: commune.codesPostaux,
      insee_code: commune.code,
    };

    const { data: existing, error: existingError } = await admin
      .from("villes")
      .select("id")
      .eq("insee_code", commune.code)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const { data, error } = await admin
        .from("villes")
        .update({ codes_postaux: commune.codesPostaux })
        .eq("id", existing.id)
        .select("id, nom, slug")
        .single();
      if (error) throw error;
      return json(data);
    }

    // Ville créée avant les codes INSEE (ex. par createMairieAccount) : on la complète plutôt
    // que d'en créer un doublon, à condition qu'elle soit bien dans le même département.
    const baseSlug = slugify(commune.nom);
    const { data: legacy, error: legacyError } = await admin
      .from("villes")
      .select("id, department_code")
      .eq("slug", baseSlug)
      .is("insee_code", null)
      .maybeSingle();
    if (legacyError) throw legacyError;
    if (legacy && (!legacy.department_code || legacy.department_code === commune.codeDepartement)) {
      const { data, error } = await admin
        .from("villes")
        .update(patch)
        .eq("id", legacy.id)
        .select("id, nom, slug")
        .single();
      if (error) throw error;
      return json(data);
    }

    // Homonymes (plusieurs "Saint-Martin" en France) : le slug est suffixé par le département,
    // puis par le code INSEE en dernier recours.
    for (const slug of [
      baseSlug,
      `${baseSlug}-${commune.codeDepartement}`,
      `${baseSlug}-${commune.code}`,
    ]) {
      const { data, error } = await admin
        .from("villes")
        .insert({ ...patch, slug })
        .select("id, nom, slug")
        .single();
      if (!error) return json(data);
      if (error.code !== "23505") throw error;
      // Course possible : un autre utilisateur vient de créer la même commune.
      const { data: raced } = await admin
        .from("villes")
        .select("id, nom, slug")
        .eq("insee_code", commune.code)
        .maybeSingle();
      if (raced) return json(raced);
    }
    return json({ error: "Impossible de créer cette commune." }, 500);
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message }, 500);
  }
});
