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

const departmentCodeSchema = z
  .string()
  .trim()
  .regex(
    /^(0[1-9]|[1-8][0-9]|9[0-5]|2[ab]|97[1-6])$/i,
    "Code département invalide (ex : 74, 2A, 971).",
  )
  .transform((value) => value.toUpperCase());

const createMairieAccountSchema = z.object({
  accessToken: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  villeNom: z.string().min(1),
  departmentCode: departmentCodeSchema,
});

export const createMairieAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => createMairieAccountSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    await requireAdmin(admin, data.accessToken);

    const villeNom = data.villeNom.trim();
    const { data: existingVille } = await admin
      .from("villes")
      .select("id, department_code")
      .ilike("nom", villeNom)
      .maybeSingle();

    let villeId = existingVille?.id as string | undefined;
    if (!villeId) {
      const { data: newVille, error: villeError } = await admin
        .from("villes")
        .insert({ nom: villeNom, slug: slugify(villeNom), department_code: data.departmentCode })
        .select("id")
        .single();
      if (villeError) throw new Error(villeError.message);
      villeId = newVille.id;
    } else if (!existingVille?.department_code) {
      const { error: updateError } = await admin
        .from("villes")
        .update({ department_code: data.departmentCode })
        .eq("id", villeId);
      if (updateError) throw new Error(updateError.message);
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
      .select("id, created_at, villes(nom, department_code)")
      .eq("role", "mairie")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const accounts = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const { data: userData } = await admin.auth.admin.getUserById(profile.id);
        const villes = profile.villes as unknown as
          | { nom: string; department_code: string | null }[]
          | { nom: string; department_code: string | null }
          | null;
        const ville = Array.isArray(villes) ? villes[0] : villes;
        return {
          id: profile.id,
          email: userData.user?.email ?? "—",
          villeNom: ville?.nom ?? "—",
          departmentCode: ville?.department_code ?? null,
          createdAt: profile.created_at as string,
        };
      }),
    );

    return accounts;
  });
