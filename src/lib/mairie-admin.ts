import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/slugify";

async function requireAdmin(admin: ReturnType<typeof getSupabaseAdmin>, accessToken: string) {
  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
  if (callerError || !callerData.user) {
    throw new Error("Session invalide, reconnectez-vous.");
  }

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    throw new Error("Accès réservé aux administrateurs.");
  }
}

const createMairieAccountSchema = z.object({
  accessToken: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  villeNom: z.string().min(1),
});

export const createMairieAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => createMairieAccountSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    await requireAdmin(admin, data.accessToken);

    const villeNom = data.villeNom.trim();
    const { data: existingVille } = await admin
      .from("villes")
      .select("id")
      .ilike("nom", villeNom)
      .maybeSingle();

    let villeId = existingVille?.id as string | undefined;
    if (!villeId) {
      const { data: newVille, error: villeError } = await admin
        .from("villes")
        .insert({ nom: villeNom, slug: slugify(villeNom) })
        .select("id")
        .single();
      if (villeError) throw new Error(villeError.message);
      villeId = newVille.id;
    }

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError || !newUser.user) {
      throw new Error(createError?.message ?? "Création du compte impossible.");
    }

    const { error: insertProfileError } = await admin.from("profiles").insert({
      id: newUser.user.id,
      role: "mairie",
      ville_id: villeId,
    });
    if (insertProfileError) {
      await admin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(insertProfileError.message);
    }

    return { ok: true as const };
  });

const listMairieAccountsSchema = z.object({
  accessToken: z.string().min(1),
});

export const listMairieAccounts = createServerFn({ method: "POST" })
  .validator((input: unknown) => listMairieAccountsSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    await requireAdmin(admin, data.accessToken);

    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, created_at, villes(nom)")
      .eq("role", "mairie")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const accounts = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const { data: userData } = await admin.auth.admin.getUserById(profile.id);
        const villes = profile.villes as unknown as { nom: string }[] | { nom: string } | null;
        const villeNom = Array.isArray(villes) ? villes[0]?.nom : villes?.nom;
        return {
          id: profile.id,
          email: userData.user?.email ?? "—",
          villeNom: villeNom ?? "—",
          createdAt: profile.created_at as string,
        };
      }),
    );

    return accounts;
  });
