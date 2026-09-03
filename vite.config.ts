// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Default build target stays Cloudflare (Lovable's default). The build automatically switches
// to the Vercel-compatible Nitro preset when running on Vercel's own build infrastructure
// (Vercel always sets the VERCEL env var), or when DEPLOY_TARGET=vercel is set explicitly
// (used for one-off `vercel deploy` pushes from a non-Vercel CI environment).
const isVercelBuild = process.env["DEPLOY_TARGET"] === "vercel" || Boolean(process.env["VERCEL"]);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(isVercelBuild ? { nitro: { preset: "vercel" } } : {}),
});
