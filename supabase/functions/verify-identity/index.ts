import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// API publique et gratuite de l'annuaire des entreprises (sans clé, ~7 requêtes/s par IP).
const SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search";

type Etablissement = { siret: string; etat_administratif: string };
type SearchResult = {
  nom_complet: string;
  siege?: Etablissement;
  matching_etablissements?: Etablissement[];
  complements?: { identifiant_association?: string | null };
};

type Outcome =
  | { status: "verifie"; legalName: string }
  | { status: "refuse"; reason: string }
  | { status: "a_verifier"; reason: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function search(q: string): Promise<SearchResult[]> {
  const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(q)}&per_page=5`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`annuaire-entreprises: HTTP ${res.status}`);
  return ((await res.json()).results ?? []) as SearchResult[];
}

// La recherche est plein texte : on n'accepte qu'une correspondance exacte sur le SIRET ou le RNA.
async function checkSiret(siret: string): Promise<Outcome> {
  const results = await search(siret);
  for (const r of results) {
    const etab = [...(r.matching_etablissements ?? []), ...(r.siege ? [r.siege] : [])].find(
      (e) => e.siret === siret,
    );
    if (!etab) continue;
    if (etab.etat_administratif !== "A") {
      return { status: "refuse", reason: "Établissement fermé au répertoire Sirene." };
    }
    return { status: "verifie", legalName: r.nom_complet };
  }
  return { status: "refuse", reason: "SIRET introuvable au répertoire Sirene." };
}

async function checkRna(rna: string): Promise<Outcome> {
  const results = await search(rna);
  const match = results.find((r) => r.complements?.identifiant_association === rna);
  if (match) return { status: "verifie", legalName: match.nom_complet };
  // Les associations sans SIREN (la majorité des petites associations) ne figurent pas dans
  // Sirene : un RNA introuvable n'est donc pas une preuve d'invalidité, on laisse à vérifier.
  return { status: "a_verifier", reason: "RNA absent de l'annuaire, vérification manuelle." };
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
    if (!user) return json({ error: "Non authentifié." }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("siret, rna, verification_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "Profil introuvable." }, 404);

    // Seul un identifiant fraîchement saisi est vérifié : une décision déjà prise (y compris une
    // correction manuelle par un admin) n'est jamais écrasée.
    if (profile.verification_status !== "a_verifier") {
      return json({ status: profile.verification_status });
    }

    let outcome: Outcome;
    try {
      outcome = profile.siret ? await checkSiret(profile.siret) : await checkRna(profile.rna);
    } catch (error) {
      console.error("Annuaire indisponible:", error);
      return json({
        status: "a_verifier",
        reason: "Annuaire indisponible, nouvel essai plus tard.",
      });
    }

    if (outcome.status !== "a_verifier") {
      // Conditionnel sur l'identifiant lu plus haut : si l'utilisateur l'a modifié entre-temps,
      // ce résultat ne s'applique plus et la ligne n'est pas touchée.
      let update = admin
        .from("profiles")
        .update({
          verification_status: outcome.status,
          verified_at: new Date().toISOString(),
          legal_name: outcome.status === "verifie" ? outcome.legalName : null,
        })
        .eq("id", user.id)
        .eq("verification_status", "a_verifier");
      update = profile.siret ? update.eq("siret", profile.siret) : update.is("siret", null);
      update = profile.rna ? update.eq("rna", profile.rna) : update.is("rna", null);
      const { error: updateError } = await update;
      if (updateError) throw updateError;
    }

    return json(outcome);
  } catch (error) {
    console.error(error);
    return json({ error: (error as Error).message }, 500);
  }
});
