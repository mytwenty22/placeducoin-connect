#!/usr/bin/env node
/**
 * Nouveau géocodage des fiches sans position, en ne gardant que la partie « rue » de l'adresse.
 *
 *   node scripts/regeocode-fiches.mjs [--since=2026-11-18] [--plan=<fichier.json>]   → essai à blanc
 *   node scripts/regeocode-fiches.mjs --apply --plan=<fichier.json> [--level=numero|rue]
 *
 * Les adresses importées commencent souvent par un lieu (« Centre commercial X, 49 Avenue Y,
 * 33700 Mérignac ») que la Base Adresse Nationale ne connaît pas. On retire ces segments, on
 * interroge la BAN sur chaque segment qui ressemble à une voie (avec puis sans numéro) et on
 * garde le premier résultat sûr : score ≥ 0.6 et même code postal que la fiche.
 * Niveau « numero » : point de l'adresse exacte. Niveau « rue » : centre de la voie seulement,
 * parfois loin de la boutique sur une longue avenue (rayon d'activation des offres : 100 m).
 * --apply relit le plan produit par l'essai à blanc et ne met à jour que les fiches toujours
 * sans position, au niveau demandé (numero par défaut).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const APPLY = args.includes("--apply");
const SINCE = opt("since") ?? "2026-11-18";
const PLAN = opt("plan") ?? "D:/spotlocal/regeocode_plan.json";
const LEVEL = opt("level") ?? "numero";

const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- Écriture : application d'un plan déjà relu ----------------------------------------------
if (APPLY) {
  const levels = LEVEL === "rue" ? ["numero", "rue"] : ["numero"];
  const plan = JSON.parse(readFileSync(PLAN, "utf8")).filter((p) => levels.includes(p.niveau));
  let updated = 0;
  for (const p of plan) {
    const { data, error } = await db
      .from("commerces")
      .update({ latitude: p.lat, longitude: p.lng })
      .eq("id", p.id)
      .is("latitude", null)
      .select("id");
    if (error) throw error;
    updated += data.length;
  }
  console.log(`${updated} fiche(s) mises à jour sur ${plan.length} (niveaux : ${levels.join(", ")}).`);
  process.exit(0);
}

// --- Essai à blanc ---------------------------------------------------------------------------
const PLACE_SEGMENT =
  /^(centre commercial|c\.?c\.?\b|galerie|halle|postes?\b|march[ée]|arcades|les arcades|village|domaine|lieu-dit|r[ée]sidence|parvis|passage paul|quartier|place florale)/i;
const STREET_WORD =
  /\b(rue|avenue|av\.?|boulevard|bd|cours|place|all[ée]e|chemin|route|impasse|quai|esplanade|square|passage|parvis|rond-point|voie|lotissement)\b/i;

// Erreurs de nom de voie relevées dans les CSV importés (la BAN ne trouve pas la forme fautive).
const STREET_FIXES = [[/\bRue du Passage Saint-Georges\b/i, "Rue du Pas-Saint-Georges"]];
const fixStreets = (adresse) =>
  STREET_FIXES.reduce((text, [wrong, right]) => text.replace(wrong, right), adresse);

function candidates(adresse) {
  const parts = adresse
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^\d{5}\b/.test(s)); // « 33700 Mérignac »
  const out = [];
  for (const part of parts) {
    if (PLACE_SEGMENT.test(part) && !/^\d/.test(part)) continue;
    if (!STREET_WORD.test(part)) continue;
    out.push(part);
    const noNumber = part.replace(/^\s*\d+\s*(bis|ter|[a-z])?\b\s*/i, "");
    if (noNumber !== part) out.push(noNumber);
  }
  return [...new Set(out)];
}

// Filtre sur la commune (code INSEE) et non sur le code postal : 33270 couvre Floirac et
// Bouliac, 33160 Saint-Médard et Salaunes, et certains codes postaux des CSV sont faux.
async function ban(q, citycode) {
  const params = new URLSearchParams({ q, limit: "1", citycode });
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return (await res.json()).features?.[0] ?? null;
      if (res.status !== 429 && res.status < 500) return null;
    } catch {
      // nouvelle tentative
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
  throw new Error(`BAN indisponible pour « ${q} »`);
}

const { data: fiches, error } = await db
  .from("commerces")
  .select("id, slug, nom, adresse, code_postal, villes(nom, insee_code)")
  .is("latitude", null)
  .gte("created_at", `${SINCE}T00:00:00Z`)
  .order("nom");
if (error) throw error;

const results = [];
for (const f of fiches) {
  const entry = { id: f.id, slug: f.slug, nom: f.nom, commune: f.villes?.nom, adresse: f.adresse };
  const fixed = fixStreets(f.adresse ?? "");
  if (fixed !== f.adresse) entry.adresse_corrigee = fixed;
  for (const q of candidates(fixed)) {
    const feature = await ban(q, f.villes.insee_code);
    const p = feature?.properties;
    if (!feature || (p.score ?? 0) < 0.6 || p.citycode !== f.villes.insee_code) continue;
    if (p.type !== "housenumber" && p.type !== "street") continue;
    const [lng, lat] = feature.geometry.coordinates;
    Object.assign(entry, {
      requete: q,
      trouve: p.label,
      score: Math.round(p.score * 100) / 100,
      niveau: p.type === "housenumber" ? "numero" : "rue",
      lat,
      lng,
    });
    if (p.postcode !== f.code_postal) entry.cp_a_corriger = `${f.code_postal} → ${p.postcode}`;
    break;
  }
  entry.niveau ??= "introuvable";
  results.push(entry);
}

writeFileSync(PLAN, JSON.stringify(results, null, 2));
const count = (n) => results.filter((r) => r.niveau === n).length;
const byCommune = {};
for (const r of results) {
  const c = (byCommune[r.commune] ??= { numero: 0, rue: 0, introuvable: 0 });
  c[r.niveau]++;
}
console.log("ESSAI À BLANC — aucune écriture\n");
console.log(`${"Commune".padEnd(26)} ${"Numéro".padStart(6)} ${"Rue".padStart(4)} ${"Introuv.".padStart(8)}`);
for (const [c, n] of Object.entries(byCommune).sort((a, b) => a[0].localeCompare(b[0], "fr"))) {
  console.log(`${c.padEnd(26)} ${String(n.numero).padStart(6)} ${String(n.rue).padStart(4)} ${String(n.introuvable).padStart(8)}`);
}
console.log(
  `\nTOTAL ${results.length} : au numéro ${count("numero")}, centre de rue ${count("rue")}, introuvables ${count("introuvable")}`,
);
for (const niveau of ["numero", "rue", "introuvable"]) {
  console.log(`\n== ${niveau}`);
  for (const r of results.filter((x) => x.niveau === niveau)) {
    console.log(
      niveau === "introuvable"
        ? `[${r.commune}] ${r.nom} — ${r.adresse}`
        : `[${r.commune}] ${r.nom} — « ${r.requete} » → ${r.trouve} (${r.score})`,
    );
  }
}
const fixes = results.filter((r) => r.adresse_corrigee || r.cp_a_corriger);
if (fixes.length > 0) {
  console.log(`\n== adresses à corriger (${fixes.length}) — non modifiées par ce script`);
  for (const r of fixes) {
    console.log(
      `[${r.commune}] ${r.nom} — ${r.adresse}` +
        (r.adresse_corrigee ? `  → nom de voie : ${r.adresse_corrigee}` : "") +
        (r.cp_a_corriger ? `  → code postal ${r.cp_a_corriger}` : ""),
    );
  }
}
console.log(`\nPlan : ${resolve(PLAN)}`);
