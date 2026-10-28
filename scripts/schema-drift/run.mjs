// Détecte les écarts entre la base de production et supabase/migrations (objets créés ou modifiés
// hors migrations, par ex. depuis Lovable ou le SQL editor).
//
//   npm run db:drift              compare la production (projet lié via `supabase link`) au dépôt
//   npm run db:drift -- --local   rejoue seulement les migrations et les vérifications de checks.sql
//   npm run db:drift -- --json rapport.json   écrit aussi le rapport détaillé
//
// Les migrations sont rejouées dans PGlite (Postgres embarqué, pas de Docker), installé à la
// demande dans node_modules/.cache/schema-drift pour ne pas alourdir les dépendances du projet.
// Code de sortie 1 s'il reste un écart, une migration en échec ou une vérification en échec.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { diffInventories } from "./diff.mjs";
import { replayMigrations } from "./replay.mjs";

const PGLITE_VERSION = "0.2.17";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..", "..");
const args = process.argv.slice(2);
const localOnly = args.includes("--local");
const jsonIndex = args.indexOf("--json");
const jsonOut = jsonIndex !== -1 ? args[jsonIndex + 1] : null;

// npm/npx sont des scripts .cmd sous Windows : il faut passer par le shell, qui ne protège pas les
// arguments contenant des espaces (chemin du projet) sans guillemets.
function runTool(command, toolArgs, options) {
  if (process.platform !== "win32") return spawnSync(command, toolArgs, options);
  const quoted = toolArgs.map((a) => (/\s/.test(a) ? `"${a}"` : a));
  return spawnSync([command, ...quoted].join(" "), { ...options, shell: true });
}

async function loadPGlite() {
  const cacheDir = path.join(projectRoot, "node_modules", ".cache", "schema-drift");
  const require = createRequire(path.join(cacheDir, "package.json"));
  try {
    return (await import(pathToFileURL(require.resolve("@electric-sql/pglite")).href)).PGlite;
  } catch {
    console.log(`Installation de PGlite ${PGLITE_VERSION} dans ${cacheDir}…`);
    fs.mkdirSync(cacheDir, { recursive: true });
    const install = runTool(
      "npm",
      ["install", "--prefix", cacheDir, "--no-save", `@electric-sql/pglite@${PGLITE_VERSION}`],
      { stdio: "inherit" },
    );
    if (install.status !== 0) throw new Error("Échec de l'installation de PGlite.");
    return (await import(pathToFileURL(require.resolve("@electric-sql/pglite")).href)).PGlite;
  }
}

function readProductionInventory(inventoryPath) {
  const result = runTool(
    "npx",
    ["--no-install", "supabase", "db", "query", "--linked", "-o", "json", "-f", inventoryPath],
    { cwd: projectRoot, encoding: "utf8", maxBuffer: 64 << 20 },
  );
  const start = result.stdout?.indexOf("{") ?? -1;
  if (result.status !== 0 || start === -1) {
    throw new Error(`Lecture de la production impossible :\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout.slice(start)).rows[0].inventory;
}

const inventoryPath = path.join(here, "inventory.sql");
const PGlite = await loadPGlite();
const {
  failures,
  inventory: repoInventory,
  checks,
} = await replayMigrations({
  PGlite,
  migrationsDir: path.join(projectRoot, "supabase", "migrations"),
  inventorySql: fs.readFileSync(inventoryPath, "utf8"),
  checksSql: fs.readFileSync(path.join(here, "checks.sql"), "utf8"),
});

let problems = failures.length + checks.filter((c) => !c.ok).length;
console.log(
  `\nMigrations rejouées : ${failures.length === 0 ? "toutes OK" : `${failures.length} en échec`}`,
);
for (const f of failures) console.log(`  ÉCHEC ${f.file} : ${f.error}`);
console.log("\nVérifications de comportement :");
for (const c of checks)
  console.log(`  ${c.ok ? "OK   " : "ÉCHEC"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);

let report = null;
if (!localOnly) {
  report = diffInventories(readProductionInventory(inventoryPath), repoInventory);
  console.log("\nÉcarts production / dépôt :");
  for (const [section, { onlyProd, onlyRepo, changed }] of Object.entries(report)) {
    for (const x of onlyProd) console.log(`  ${section} · seulement en production : ${x.key}`);
    for (const x of onlyRepo) console.log(`  ${section} · seulement dans le dépôt : ${x.key}`);
    for (const x of changed) {
      console.log(`  ${section} · différent : ${x.key} (${Object.keys(x.fields).join(", ")})`);
    }
    problems += onlyProd.length + onlyRepo.length + changed.length;
  }
}

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ failures, checks, report }, null, 2));
  console.log(`\nRapport détaillé : ${jsonOut}`);
}
console.log(problems === 0 ? "\nAucun écart." : `\n${problems} point(s) à examiner.`);
process.exitCode = problems === 0 ? 0 : 1;
