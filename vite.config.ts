// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Default build target is Vercel (overrides Lovable's Cloudflare default from
  // @lovable.dev/vite-tanstack-config) — every build, everywhere, targets Vercel's Nitro preset.
  nitro: { preset: "vercel" },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        // TanStack Start has no static index.html for the plugin to auto-inject a registration
        // script into (the document is rendered per-request from __root.tsx) -- so injection is
        // off here, and the service worker is registered manually from __root.tsx instead.
        injectRegister: false,
        includeAssets: ["favicon.ico"],
        manifest: {
          name: "Bons Plans du Coin",
          short_name: "Bons Plans",
          description:
            "Les promotions de vos commerçants, les événements de votre quartier et les infos de votre mairie, en un clic.",
          lang: "fr",
          start_url: "/",
          display: "standalone",
          background_color: "#F8FAFC",
          theme_color: "#0F172A",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // App data (commerces, promos, stats) comes from Supabase's REST/Auth endpoints and
          // must always be fresh -- never served from the PWA cache. Only the app shell and
          // static assets are precached/cached; everything else falls through to the network.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
              handler: "NetworkOnly",
            },
          ],
        },
      }),
    ],
  },
});
