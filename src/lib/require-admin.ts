import type { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function requireAdmin(
  admin: ReturnType<typeof getSupabaseAdmin>,
  accessToken: string,
) {
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
