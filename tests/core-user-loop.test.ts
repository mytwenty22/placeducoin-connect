import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Loads SUPABASE_SERVICE_ROLE_KEY (and any other secrets) from .env.local for this test run only
// — .env.local is gitignored, never committed. Node 20.6+ supports loadEnvFile natively.
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  process.loadEnvFile(envLocalPath);
}

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? "https://qerntkgpddlfiarmsyya.supabase.co";
const SUPABASE_ANON_KEY =
  process.env["VITE_SUPABASE_ANON_KEY"] ?? "sb_publishable__K7WoxDdqz1JTxmLyoME6A_oNgQKLV8";
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

// This app's "core user loop" has no generic user-review/avis feature (google_rating is an
// admin-set static field, not something a visitor submits). The real core loop is: a Pro signs
// up, logs in, and publishes an offer (commerce + promo) — that's what this test exercises.
const describeIfServiceRole = SERVICE_ROLE_KEY ? describe : describe.skip;

describeIfServiceRole(
  "Core user loop: Pro signup -> login -> publish an offer -> persists on reload",
  () => {
    const stamp = Date.now();
    const testEmail = `qa-loop-${stamp}@placeducoin-test.local`;
    const testPassword = `QaLoop!${stamp}`;
    const slug = `qa-loop-test-${stamp}`;

    let admin: SupabaseClient;
    let userId: string;
    let villeId: string;
    let commerceId: string;
    let promoId: string;

    beforeAll(async () => {
      admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Admin-provision a confirmed test user, mirroring the "Connexion Demo Pro" pattern already
      // used in src/routes/pro.tsx, so the test never depends on a real inbox for email
      // confirmation.
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });
      if (createError || !created.user) {
        throw new Error(`Test setup failed creating the QA user: ${createError?.message}`);
      }
      userId = created.user.id;

      const { data: villes, error: villesError } = await admin.from("villes").select("id").limit(1);
      if (villesError || !villes?.[0]) {
        throw new Error(`Test setup failed: no ville available (${villesError?.message})`);
      }
      villeId = villes[0]["id"] as string;
    });

    afterAll(async () => {
      if (promoId) await admin.from("promos").delete().eq("id", promoId);
      if (commerceId) await admin.from("commerces").delete().eq("id", commerceId);
      if (userId) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
    });

    it("logs in with the real anon-key client and writes an offer to the DB", async () => {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      expect(signInError).toBeNull();
      expect(signIn.session).not.toBeNull();

      // Mirrors ensureProfileMutation in src/routes/pro.tsx.
      const { error: profileError } = await client
        .from("profiles")
        .upsert({ id: userId, role: "pro" }, { onConflict: "id" });
      expect(profileError).toBeNull();

      const { data: commerce, error: commerceError } = await client
        .from("commerces")
        .insert({
          owner_id: userId,
          ville_id: villeId,
          slug,
          nom: "QA Loop Test Commerce",
          trade: "Test automatisé",
          category: "bouche",
        })
        .select("id")
        .single();
      expect(commerceError).toBeNull();
      commerceId = commerce!["id"] as string;

      const validUntil = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
      const { data: promo, error: promoError } = await client
        .from("promos")
        .insert({
          commerce_id: commerceId,
          titre: "QA Loop Promo",
          kind: "promo",
          prix_avant: 10,
          prix_maintenant: 5,
          valide_jusqu_a: validUntil,
        })
        .select("id")
        .single();
      expect(promoError).toBeNull();
      promoId = promo!["id"] as string;
    });

    it("persists the write after a simulated page reload (fresh client, fresh query)", async () => {
      // A page reload re-runs the route loader with a brand new client/query — never reusing the
      // in-memory result from the write above. A fresh client instance reproduces that shape.
      const freshClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const { data: commerce, error: commerceError } = await freshClient
        .from("commerces")
        .select("nom, trade, category, slug")
        .eq("id", commerceId)
        .maybeSingle();
      expect(commerceError).toBeNull();
      expect(commerce?.["nom"]).toBe("QA Loop Test Commerce");
      expect(commerce?.["slug"]).toBe(slug);

      const { data: promo, error: promoError } = await freshClient
        .from("promos")
        .select("titre, prix_maintenant")
        .eq("id", promoId)
        .maybeSingle();
      expect(promoError).toBeNull();
      expect(promo?.["titre"]).toBe("QA Loop Promo");
      expect(promo?.["prix_maintenant"]).toBe(5);
    });
  },
);
