import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

const listProAccountsSchema = z.object({
  accessToken: z.string().min(1),
});

export const listProAccounts = createServerFn({ method: "POST" })
  .validator((input: unknown) => listProAccountsSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    await requireAdmin(admin, data.accessToken);

    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, created_at")
      .eq("role", "pro")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const profileIds = (profiles ?? []).map((profile) => profile.id as string);

    // commerces.owner_id references auth.users, not public.profiles, so PostgREST can't
    // auto-embed it from profiles -- fetch commerces separately and match by owner_id.
    const { data: commerces, error: commercesError } = await admin
      .from("commerces")
      .select("owner_id, nom, villes(nom)")
      .in("owner_id", profileIds.length > 0 ? profileIds : [""]);
    if (commercesError) throw new Error(commercesError.message);

    const commerceByOwnerId = new Map(
      (commerces ?? []).map((commerce) => {
        const villes = commerce.villes as unknown as { nom: string }[] | { nom: string } | null;
        const ville = Array.isArray(villes) ? villes[0] : villes;
        return [commerce.owner_id as string, { nom: commerce.nom as string, villeNom: ville?.nom }];
      }),
    );

    const accounts = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const { data: userData } = await admin.auth.admin.getUserById(profile.id);
        const commerce = commerceByOwnerId.get(profile.id as string);
        return {
          id: profile.id,
          email: userData.user?.email ?? "—",
          commerceNom: commerce?.nom ?? "— (fiche commerce non créée)",
          villeNom: commerce?.villeNom ?? "—",
          createdAt: profile.created_at as string,
        };
      }),
    );

    return accounts;
  });
