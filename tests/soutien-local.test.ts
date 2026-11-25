import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Même principe que core-user-loop.test.ts : test d'intégration contre la base distante, ignoré
// sans SUPABASE_SERVICE_ROLE_KEY (.env.local), données de test supprimées à la fin.
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) process.loadEnvFile(envLocalPath);

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? "https://qerntkgpddlfiarmsyya.supabase.co";
const SUPABASE_ANON_KEY =
  process.env["VITE_SUPABASE_ANON_KEY"] ?? "sb_publishable__K7WoxDdqz1JTxmLyoME6A_oNgQKLV8";
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const describeIfServiceRole = SERVICE_ROLE_KEY ? describe : describe.skip;

const LAT = 44.84;
const LNG = -0.58;

describeIfServiceRole("Soutien local : coupon validé -> montant déclaré (declarer_soutien)", () => {
  const stamp = Date.now();
  const password = `QaSoutien!${stamp}`;
  const clientEmail = `qa-soutien-client-${stamp}@placeducoin-test.local`;
  let admin: SupabaseClient;
  let client: SupabaseClient;
  let proId: string;
  let clientId: string;
  let commerceId: string;
  let promoId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const pro = await admin.auth.admin.createUser({
      email: `qa-soutien-pro-${stamp}@placeducoin-test.local`,
      password,
      email_confirm: true,
    });
    const cli = await admin.auth.admin.createUser({
      email: clientEmail,
      password,
      email_confirm: true,
    });
    if (!pro.data.user || !cli.data.user) throw new Error("Création des comptes de test échouée");
    proId = pro.data.user.id;
    clientId = cli.data.user.id;

    const { data: villes } = await admin.from("villes").select("id").limit(1);
    await admin.from("profiles").insert({ id: proId, role: "pro" });
    const commerce = await admin
      .from("commerces")
      .insert({
        owner_id: proId,
        ville_id: villes![0]!["id"],
        slug: `qa-soutien-${stamp}`,
        nom: "QA Soutien",
        trade: "Test automatisé",
        category: "bouche",
        latitude: LAT,
        longitude: LNG,
        is_demo: true,
      })
      .select("id")
      .single();
    if (commerce.error) throw commerce.error;
    commerceId = commerce.data["id"] as string;
    const promo = await admin
      .from("promos")
      .insert({
        commerce_id: commerceId,
        titre: "QA Soutien",
        kind: "promo",
        valide_jusqu_a: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (promo.error) throw promo.error;
    promoId = promo.data["id"] as string;

    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: clientEmail, password });
    if (error) throw error;
  });

  afterAll(async () => {
    // Cascade : promos, promo_activations puis soutiens_locaux (activation_id/user_id).
    if (commerceId) await admin.from("commerces").delete().eq("id", commerceId);
    for (const id of [proId, clientId]) {
      if (!id) continue;
      await admin.from("profiles").delete().eq("id", id);
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("refuse un montant sans coupon validé", async () => {
    const { data, error } = await client.rpc("declarer_soutien", {
      p_promo_id: promoId,
      p_montant: 30,
    });
    expect(error).toBeNull();
    expect(data).toEqual({ status: "no_activation" });
  });

  it("enregistre le montant après validation, une seule fois, lisible par le client", async () => {
    const activation = await client.rpc("activate_promo", {
      p_promo_id: promoId,
      p_lat: LAT,
      p_lng: LNG,
    });
    expect(activation.error).toBeNull();
    expect(activation.data).toMatchObject({ status: "activated" });

    const tooMuch = await client.rpc("declarer_soutien", { p_promo_id: promoId, p_montant: 501 });
    expect(tooMuch.data).toEqual({ status: "invalid_amount" });

    const saved = await client.rpc("declarer_soutien", { p_promo_id: promoId, p_montant: 30 });
    expect(saved.error).toBeNull();
    expect(saved.data).toEqual({ status: "saved" });

    const again = await client.rpc("declarer_soutien", { p_promo_id: promoId, p_montant: 50 });
    expect(again.data).toEqual({ status: "already_declared" });

    const rows = await client.from("soutiens_locaux").select("montant, activation_id");
    expect(rows.error).toBeNull();
    expect(rows.data).toHaveLength(1);
    expect(Number(rows.data![0]!["montant"])).toBe(30);
  });
});
