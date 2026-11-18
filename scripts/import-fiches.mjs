#!/usr/bin/env node
/**
 * Import en masse de fiches sans gérant depuis un dossier de CSV « spotlocal_<cp>_<commune>.csv ».
 *
 *   node scripts/import-fiches.mjs <dossier>            → essai à blanc (lectures seules, aucun écrit)
 *   node scripts/import-fiches.mjs <dossier> --apply    → écriture réelle
 *   options : --only=33130,33400   limite aux codes postaux listés
 *             --report=<fichier>   bilan détaillé en JSON (défaut : <dossier>/../import_bilan.json)
 *
 * Mêmes règles que l'import CSV de /admin (AdminAddFiches + admin_create_unclaimed_fiches) :
 * parseur de l'app (tout ou rien par fichier), fiche ignorée si même nom + même adresse déjà dans la
 * commune, slug unique suffixé -2, -3…, géocodage BAN (sinon latitude/longitude nulles).
 * La RPC exige is_admin(), impossible avec la clé service_role : les insertions sont faites en
 * direct, par lots de 100, avec la clé SUPABASE_SERVICE_ROLE_KEY de .env.local (jamais affichée).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GEO_API_URL = "https://geo.api.gouv.fr/communes";
const GEOCODE_CONCURRENCY = 2;
const INSERT_BATCH_SIZE = 100;
const PLACEHOLDER_PHONE = /^0[1-9](?:[ .]?00){4}$/;

// --- Arguments -------------------------------------------------------------------------------
const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");
const reportPath =
  args.find((a) => a.startsWith("--report="))?.slice(9) ??
  (folder ? join(resolve(folder), "..", "import_bilan.json") : "");
// --keep-file=<fichier> : une ligne « nom|adresse » par fiche à importer malgré le contrôle tolérant.
const keepFile = args.find((a) => a.startsWith("--keep-file="))?.slice(12);
const KEEP = new Set(
  keepFile
    ? readFileSync(keepFile, "utf8")
        .split(/\r?\n/)
        .map((l) => l.replace(/^﻿/, "").trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const [nom, adresse = ""] = l.split("|");
          return `${nom.trim().toLowerCase()}|${adresse.trim().toLowerCase()}`;
        })
    : [],
);
if (!folder) {
  console.error("Usage : node scripts/import-fiches.mjs <dossier> [--apply] [--only=cp,…]");
  process.exit(1);
}

// --- Environnement ---------------------------------------------------------------------------
function readEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = { ...readEnv(join(ROOT, ".env.local")), ...process.env };
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans .env.local.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// --- Modules de l'app (parseur CSV, slugify, géocodage) chargés tels quels via Vite ----------
const vite = await createServer({
  configFile: false,
  root: ROOT,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { "@": join(ROOT, "src") } },
});
let lib;
try {
  lib = {
    ...(await vite.ssrLoadModule("/src/lib/csv.ts")),
    ...(await vite.ssrLoadModule("/src/lib/fiches-csv.ts")),
    ...(await vite.ssrLoadModule("/src/lib/slugify.ts")),
  };
} finally {
  await vite.close();
}
const { decodeCsvBytes, parseFichesCsv, CsvImportError, slugify } = lib;

// --- Utilitaires -----------------------------------------------------------------------------
const key = (nom, adresse) => `${nom.trim().toLowerCase()}|${adresse.trim().toLowerCase()}`;

async function fetchJson(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return await res.json();
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} ${url}`);
    } catch (error) {
      if (i === attempts) throw error;
    }
    await new Promise((r) => setTimeout(r, 1000 * i));
  }
}

/** Commune officielle d'après le nom de fichier spotlocal_<cp>_<slug>[_<quartier>].csv. */
const communeCache = new Map();
async function communeFromFile(file) {
  const m = basename(file).match(/^spotlocal_(\d{5})_([a-z0-9-]+)(?:_[a-z0-9-]+)?\.csv$/i);
  if (!m) throw new Error("nom de fichier inattendu");
  const [, cp, slug] = m;
  const cacheKey = `${cp}:${slug}`;
  if (!communeCache.has(cacheKey)) {
    const list = await fetchJson(
      `${GEO_API_URL}?codePostal=${cp}&fields=nom,code,codeDepartement,codesPostaux`,
    );
    const commune = list.find((c) => slugify(c.nom) === slug.toLowerCase());
    if (!commune) {
      throw new Error(
        `commune « ${slug} » absente du code postal ${cp} (${list.map((c) => c.nom).join(", ")})`,
      );
    }
    communeCache.set(cacheKey, commune);
  }
  return { cp, commune: communeCache.get(cacheKey) };
}

async function selectAll(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

/** Même logique que supabase/functions/ensure-ville (lookup INSEE, ville héritée, slug homonyme). */
async function ensureVille(commune) {
  const patch = {
    nom: commune.nom,
    department_code: commune.codeDepartement,
    codes_postaux: commune.codesPostaux,
    insee_code: commune.code,
  };
  const baseSlug = slugify(commune.nom);
  const { data: legacy, error: legacyError } = await db
    .from("villes")
    .select("id, department_code")
    .eq("slug", baseSlug)
    .is("insee_code", null)
    .maybeSingle();
  if (legacyError) throw legacyError;
  if (legacy && (!legacy.department_code || legacy.department_code === commune.codeDepartement)) {
    const { data, error } = await db
      .from("villes")
      .update(patch)
      .eq("id", legacy.id)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
  for (const slug of [
    baseSlug,
    `${baseSlug}-${commune.codeDepartement}`,
    `${baseSlug}-${commune.code}`,
  ]) {
    const { data, error } = await db
      .from("villes")
      .insert({ ...patch, slug })
      .select("id")
      .single();
    if (!error) return data.id;
    if (error.code !== "23505") throw error;
  }
  throw new Error(`impossible de créer la commune ${commune.nom}`);
}

// Géocodage BAN, mêmes paramètres que src/lib/geocode.ts (limit 1, postcode, score ≥ 0.6), mais
// sans confondre « adresse introuvable » et « service indisponible » : geocodeAddress de l'app
// renvoie null dans les deux cas, ce qui faisait varier le nombre de fiches sans GPS d'un essai à
// l'autre. Ici les pannes (429, 5xx, délai) sont retentées longuement et signalées si elles durent.
const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
const BAN_MIN_SCORE = 0.6;
const BAN_ATTEMPTS = 6;
async function geocodeBan(adresse, codePostal) {
  const params = new URLSearchParams({ q: adresse.trim(), limit: "1" });
  if (/^\d{5}$/.test(codePostal.trim())) params.set("postcode", codePostal.trim());
  for (let attempt = 1; attempt <= BAN_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${BAN_SEARCH_URL}?${params}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const feature = (await res.json()).features?.[0];
        const coords = feature?.geometry?.coordinates;
        if (!coords || (feature.properties?.score ?? 0) < BAN_MIN_SCORE) return { pos: null };
        return { pos: { lat: coords[1], lng: coords[0] } };
      }
      if (res.status !== 429 && res.status < 500) return { pos: null };
    } catch {
      // Délai dépassé ou coupure réseau : nouvelle tentative.
    }
    if (attempt < BAN_ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
  return { pos: null, failed: true };
}

async function geocodeAll(fiches) {
  const out = new Array(fiches.length);
  let next = 0;
  async function worker() {
    while (next < fiches.length) {
      const i = next++;
      out[i] = await geocodeBan(fiches[i].adresse, fiches[i].codePostal);
    }
  }
  await Promise.all(Array.from({ length: GEOCODE_CONCURRENCY }, worker));
  return out;
}

// --- État de la base (lectures) --------------------------------------------------------------
console.log(`${APPLY ? "IMPORT RÉEL" : "ESSAI À BLANC (aucune écriture)"} — ${resolve(folder)}\n`);
const villes = await selectAll(() => db.from("villes").select("id, nom, insee_code").order("id"));
const villeByInsee = new Map(villes.filter((v) => v.insee_code).map((v) => [v.insee_code, v]));
const takenSlugs = new Set(
  (await selectAll(() => db.from("commerces").select("slug").order("id"))).map((c) => c.slug),
);
// Contrôle tolérant : au-delà du nom + adresse exacts (règle de la RPC), une fiche est tenue pour
// un quasi-doublon si son nom normalisé (sans accents, casse ni ponctuation) est celui d'une fiche
// de la commune ET que la rue est la même ou que les deux points sont à moins de NEAR_METERS.
const NEAR_METERS = 50;
/** « 4 bis Rue Pré Meunier, Za Du Courneau, 33610 Canéjan » → { num: "4bis", rue: "rue-pre-meunier" }. */
function streetOf(adresse) {
  const first = (adresse ?? "").split(",")[0];
  const m = first.match(/^\s*(\d+)\s*(bis|ter|quater|[a-d])?\b[\s,-]*/i);
  return {
    num: m ? `${m[1]}${(m[2] ?? "").toLowerCase()}` : "",
    rue: slugify(m ? first.slice(m[0].length) : first),
  };
}
function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
function nearMatch(candidate, others) {
  const nomN = slugify(candidate.nom);
  const rue = streetOf(candidate.adresse);
  return others.find((o) => {
    if (o.nomN !== nomN) return false;
    // Même rue : quasi-doublon seulement si même numéro ou numéro absent d'un côté. Deux numéros
    // différents peuvent être deux boutiques d'un même indépendant (règle des 2-3 sites).
    if (rue.rue && o.rue.rue === rue.rue && (!rue.num || !o.rue.num || rue.num === o.rue.num)) {
      return true;
    }
    return Boolean(candidate.pos && o.pos && distanceMeters(candidate.pos, o.pos) <= NEAR_METERS);
  });
}
const toKnown = (nom, adresse, pos) => ({
  nom,
  adresse,
  nomN: slugify(nom),
  rue: streetOf(adresse),
  pos,
});

const existingByVille = new Map();
/** Fiches déjà dans la commune : clés exactes + liste pour le contrôle tolérant. */
async function existingOf(villeId) {
  if (!villeId) return { keys: new Set(), list: [] };
  if (!existingByVille.has(villeId)) {
    const rows = await selectAll(() =>
      db
        .from("commerces")
        .select("nom, adresse, latitude, longitude")
        .eq("ville_id", villeId)
        .order("id"),
    );
    existingByVille.set(villeId, {
      keys: new Set(rows.map((r) => key(r.nom, r.adresse ?? ""))),
      list: rows.map((r) =>
        toKnown(
          r.nom,
          r.adresse ?? "",
          r.latitude != null && r.longitude != null ? { lat: r.latitude, lng: r.longitude } : null,
        ),
      ),
    });
  }
  return existingByVille.get(villeId);
}
function uniqueSlug(nom) {
  const base = slugify(nom) || "commerce";
  let slug = base;
  for (let n = 2; takenSlugs.has(slug); n++) slug = `${base}-${n}`;
  takenSlugs.add(slug);
  return slug;
}

// --- Traitement par fichier ------------------------------------------------------------------
const files = readdirSync(folder)
  .filter((f) => /^spotlocal_\d{5}_.+\.csv$/i.test(f))
  .filter((f) => !only || only.some((cp) => f.startsWith(`spotlocal_${cp}_`)))
  .sort();
const report = [];

for (const file of files) {
  const entry = { fichier: file, lignes: 0, statut: "ok" };
  report.push(entry);
  try {
    const { cp, commune } = await communeFromFile(file);
    entry.commune = commune.nom;
    entry.insee = commune.code;
    const ville = villeByInsee.get(commune.code);
    entry.ville_en_base = Boolean(ville);

    let rows;
    try {
      rows = parseFichesCsv(decodeCsvBytes(new Uint8Array(readFileSync(join(folder, file)))));
    } catch (error) {
      entry.statut = "rejeté";
      entry.erreur = error.message;
      entry.details = error instanceof CsvImportError ? error.details : [];
      continue;
    }
    entry.lignes = rows.length;
    entry.cp_hors_commune = rows
      .filter((r) => r.codePostal && !commune.codesPostaux.includes(r.codePostal))
      .map((r) => `${r.nom} (${r.codePostal})`);
    entry.tel_fictif = rows.filter((r) => PLACEHOLDER_PHONE.test(r.telephone.trim())).length;

    const existing = await existingOf(ville?.id);
    const seen = new Set();
    const candidates = [];
    entry.deja_en_base = [];
    entry.doublons_fichier = [];
    for (const r of rows) {
      const k = key(r.nom, r.adresse);
      if (existing.keys.has(k)) entry.deja_en_base.push(r.nom);
      else if (seen.has(k)) entry.doublons_fichier.push(r.nom);
      else candidates.push({ ...r, codePostal: r.codePostal ?? cp });
      seen.add(k);
    }

    // Géocodage avant le contrôle tolérant, qui compare aussi les distances.
    const geo = await geocodeAll(candidates);
    entry.echecs_ban = candidates
      .filter((_, i) => geo[i].failed)
      .map((f) => `${f.nom} — ${f.adresse}`);
    const candidatePositions = geo.map((g) => g.pos);
    const toCreate = [];
    const positions = [];
    const accepted = [];
    entry.quasi_doublons = [];
    entry.forcees = [];
    candidates.forEach((f, i) => {
      const known = toKnown(f.nom, f.adresse, candidatePositions[i]);
      const inBase = nearMatch(known, existing.list);
      const inFile = inBase ? null : nearMatch(known, accepted);
      const match = inBase ?? inFile;
      if (match && KEEP.has(key(f.nom, f.adresse))) {
        entry.forcees.push(`${f.nom} — ${f.adresse}`);
      } else if (match) {
        entry.quasi_doublons.push(
          `${f.nom} — ${f.adresse}  ≈  ${match.nom} — ${match.adresse}${inBase ? "" : " (même fichier)"}`,
        );
        return;
      }
      accepted.push(known);
      toCreate.push(f);
      positions.push(candidatePositions[i]);
    });
    // Visibles des fichiers suivants de la même commune (Bordeaux : 5 fichiers), même à blanc.
    existing.list.push(...accepted);
    for (const f of toCreate) existing.keys.add(key(f.nom, f.adresse));
    entry.a_creer = toCreate.length;
    entry.non_localisees = toCreate
      .filter((_, i) => !positions[i])
      .map((f) => `${f.nom} — ${f.adresse}`);

    const payload = toCreate.map((f, i) => ({
      owner_id: null,
      claimed: false,
      quartier_id: null,
      slug: uniqueSlug(f.nom),
      nom: f.nom.trim(),
      trade: f.trade.trim(),
      category: f.category,
      adresse: f.adresse.trim(),
      code_postal: f.codePostal,
      telephone: f.telephone.trim(),
      latitude: positions[i]?.lat ?? null,
      longitude: positions[i]?.lng ?? null,
    }));

    // Pas d'import partiellement non géolocalisé à cause d'une panne : relancer le script suffit.
    if (APPLY && entry.echecs_ban.length > 0) {
      throw new Error(
        `${entry.echecs_ban.length} adresse(s) non géocodée(s) (BAN indisponible), fichier non importé : relancer`,
      );
    }
    if (APPLY && payload.length > 0) {
      const villeId = ville?.id ?? (await ensureVille(commune));
      if (!ville) villeByInsee.set(commune.code, { id: villeId });
      entry.creees = 0;
      for (let s = 0; s < payload.length; s += INSERT_BATCH_SIZE) {
        const batch = payload
          .slice(s, s + INSERT_BATCH_SIZE)
          .map((p) => ({ ...p, ville_id: villeId }));
        const { error } = await db.from("commerces").insert(batch);
        if (error)
          throw new Error(`${error.message} (${entry.creees} déjà créée(s), relancer termine)`);
        entry.creees += batch.length;
      }
    }
  } catch (error) {
    entry.statut = "erreur";
    entry.erreur = error.message;
  }
}

// --- Bilan -----------------------------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const num = (s, n) => String(s).padStart(n);
console.log(
  `${pad("Fichier", 48)} ${pad("Commune", 26)} ${num("Lignes", 6)} ${num("Déjà", 5)} ${num("Doubl.", 6)} ${num("Quasi", 5)} ${num(APPLY ? "Créées" : "À créer", 7)} ${num("Non loc.", 8)} ${num("CP≠", 4)}  Ville`,
);
const t = { lignes: 0, deja: 0, doublons: 0, quasi: 0, creer: 0, nonloc: 0, cp: 0, tel: 0 };
for (const e of report) {
  if (e.statut !== "ok") {
    console.log(
      `${pad(e.fichier, 48)} ${pad(e.commune ?? "?", 26)} ${e.statut.toUpperCase()} : ${e.erreur}`,
    );
    for (const d of (e.details ?? []).slice(0, 5)) console.log(`${" ".repeat(50)}${d}`);
    continue;
  }
  const created = APPLY ? (e.creees ?? 0) : e.a_creer;
  t.lignes += e.lignes;
  t.deja += e.deja_en_base.length;
  t.doublons += e.doublons_fichier.length;
  t.quasi += e.quasi_doublons.length;
  t.creer += created;
  t.nonloc += e.non_localisees.length;
  t.cp += e.cp_hors_commune.length;
  t.tel += e.tel_fictif;
  console.log(
    `${pad(e.fichier, 48)} ${pad(e.commune, 26)} ${num(e.lignes, 6)} ${num(e.deja_en_base.length, 5)} ${num(e.doublons_fichier.length, 6)} ${num(e.quasi_doublons.length, 5)} ${num(created, 7)} ${num(e.non_localisees.length, 8)} ${num(e.cp_hors_commune.length, 4)}  ${e.ville_en_base ? "en base" : "À CRÉER"}`,
  );
}
console.log(
  `\n${pad("TOTAL", 75)} ${num(t.lignes, 6)} ${num(t.deja, 5)} ${num(t.doublons, 6)} ${num(t.quasi, 5)} ${num(t.creer, 7)} ${num(t.nonloc, 8)} ${num(t.cp, 4)}`,
);
console.log(
  `Fichiers : ${report.length} — rejetés/erreurs : ${report.filter((e) => e.statut !== "ok").length}`,
);
for (const e of report) {
  for (const q of e.quasi_doublons ?? []) console.log(`  quasi-doublon ignoré [${e.commune}] ${q}`);
  for (const q of e.forcees ?? [])
    console.log(`  quasi-doublon gardé (--keep-file) [${e.commune}] ${q}`);
  for (const q of e.echecs_ban ?? []) console.log(`  BAN indisponible [${e.commune}] ${q}`);
}
console.log(`Téléphones fictifs (0X 00 00 00 00) : ${t.tel} / ${t.lignes}`);
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Bilan détaillé : ${resolve(reportPath)}`);
if (!APPLY) console.log("\nAucune écriture. Relancer avec --apply pour importer.");
