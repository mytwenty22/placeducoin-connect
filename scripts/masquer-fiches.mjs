#!/usr/bin/env node
/**
 * Masque (ou réaffiche) une liste de fiches via les colonnes masquee_at / masquage_motif.
 * Rien n'est supprimé : la fiche disparaît seulement du site public (cf. migration
 * 20261119100000_commerces_masquage.sql, à appliquer avant).
 *
 *   node scripts/masquer-fiches.mjs <liste.json>            → essai à blanc (lectures seules)
 *   node scripts/masquer-fiches.mjs <liste.json> --apply    → écriture réelle
 *   node scripts/masquer-fiches.mjs <liste.json> --undo --apply  → réaffiche les fiches de la liste
 *
 * <liste.json> : [{ "id": "<uuid>", "nom": "...", "motif": "hors_perimetre" | "fermee_ou_remplacee" }, …]
 * Garde-fous : les fiches revendiquées (claimed) ou au nom différent de celui de la liste ne sont
 * jamais touchées ; un fichier d'annulation <liste>.annulation.json est écrit avant toute écriture.
 * Clé SUPABASE_SERVICE_ROLE_KEY lue dans .env.local (jamais affichée).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOTIFS = new Set(["hors_perimetre", "fermee_ou_remplacee"]);
const BATCH = 100;

const args = process.argv.slice(2);
const listPath = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const UNDO = args.includes("--undo");
if (!listPath) {
  console.error("Usage : node scripts/masquer-fiches.mjs <liste.json> [--apply] [--undo]");
  process.exit(1);
}

function readEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = { ...readEnv(join(ROOT, ".env.local")), ...process.env };
const db = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const list = JSON.parse(readFileSync(listPath, "utf8").replace(/^﻿/, ""));
const bad = list.filter((i) => !i.id || !MOTIFS.has(i.motif));
if (bad.length) {
  console.error(`${bad.length} entrées sans id ou au motif inconnu, arrêt.`);
  process.exit(1);
}
const wanted = new Map(list.map((i) => [i.id, i]));

// La migration doit être passée : sinon la colonne n'existe pas et rien ne serait masqué.
const probe = await db.from("commerces").select("id, masquee_at").limit(1);
if (probe.error) {
  console.error(`Colonne masquee_at absente : appliquez d'abord la migration. (${probe.error.message})`);
  process.exit(1);
}

const current = [];
const ids = [...wanted.keys()];
for (let i = 0; i < ids.length; i += BATCH) {
  const { data, error } = await db
    .from("commerces")
    .select("id, nom, trade, claimed, masquee_at, masquage_motif")
    .in("id", ids.slice(i, i + BATCH));
  if (error) throw error;
  current.push(...data);
}

const found = new Map(current.map((c) => [c.id, c]));
const missing = ids.filter((id) => !found.has(id));
const skipped = [];
const todo = [];
for (const c of current) {
  const w = wanted.get(c.id);
  if (c.claimed) skipped.push(`${c.nom} : revendiquée`);
  else if (w.nom && w.nom.trim() !== c.nom.trim()) skipped.push(`${c.nom} : nom changé depuis le contrôle (${w.nom})`);
  else if (UNDO ? c.masquee_at === null : c.masquage_motif === w.motif) continue; // déjà dans l'état voulu
  else todo.push(c);
}

const byMotif = {};
for (const c of todo) byMotif[wanted.get(c.id).motif] = (byMotif[wanted.get(c.id).motif] ?? 0) + 1;
console.log(`${UNDO ? "À réafficher" : "À masquer"} : ${todo.length}`, UNDO ? "" : byMotif);
console.log(`Déjà dans l'état voulu : ${current.length - todo.length - skipped.length}`);
console.log(`Introuvables en base : ${missing.length}`);
console.log(`Ignorées (garde-fous) : ${skipped.length}`);
for (const s of skipped) console.log(`  - ${s}`);

if (!APPLY) {
  console.log("\nEssai à blanc : aucune écriture. Relancer avec --apply pour écrire.");
  process.exit(0);
}

const undoPath = listPath.replace(/\.json$/, "") + ".annulation.json";
writeFileSync(
  undoPath,
  JSON.stringify(todo.map((c) => ({ id: c.id, nom: c.nom, masquee_at: c.masquee_at, masquage_motif: c.masquage_motif })), null, 1),
);
console.log(`État avant écriture sauvegardé : ${undoPath}`);

const now = new Date().toISOString();
let written = 0;
for (const motif of UNDO ? [null] : MOTIFS) {
  const group = todo.filter((c) => UNDO || wanted.get(c.id).motif === motif).map((c) => c.id);
  for (let i = 0; i < group.length; i += BATCH) {
    const { data, error } = await db
      .from("commerces")
      .update(UNDO ? { masquee_at: null, masquage_motif: null } : { masquee_at: now, masquage_motif: motif })
      .in("id", group.slice(i, i + BATCH))
      .eq("claimed", false)
      .select("id");
    if (error) throw error;
    written += data.length;
  }
}
console.log(`Écrit : ${written} fiche(s).`);
