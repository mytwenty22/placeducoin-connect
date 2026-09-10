// vite-plugin-pwa's generateSW strategy writes sw.js/workbox-*.js by resolving Vite's root
// build.outDir ("dist"), but this project's TanStack Start + Nitro (vercel preset) pipeline
// never materializes a plain "dist" as the deployed output -- the real static assets Vercel
// serves end up in .vercel/output/static (confirmed: manifest.webmanifest and /icons already
// land there correctly, since those go through Vite's own asset graph, unlike the service
// worker files which workbox-build writes directly to disk after the fact). This script runs
// as an npm "postbuild" step, once .vercel/output/static is final, to copy the stray sw.js and
// workbox-*.js into the directory that actually gets deployed.
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const staleDistDir = path.join(projectRoot, "dist");
const deployStaticDir = path.join(projectRoot, ".vercel", "output", "static");

if (!fs.existsSync(staleDistDir) || !fs.existsSync(deployStaticDir)) {
  console.log("[copy-pwa-sw] dist/ or .vercel/output/static missing, skipping.");
  process.exit(0);
}

const filesToCopy = fs
  .readdirSync(staleDistDir)
  .filter((name) => name === "sw.js" || /^workbox-.*\.js$/.test(name));

for (const name of filesToCopy) {
  fs.copyFileSync(path.join(staleDistDir, name), path.join(deployStaticDir, name));
  console.log(`[copy-pwa-sw] copied ${name} -> .vercel/output/static/`);
}
// Note: dist/ itself is left in place -- TanStack Start's own `vite preview` reads dist/server
// for local previewing, independently of the .vercel/output this project actually deploys.
