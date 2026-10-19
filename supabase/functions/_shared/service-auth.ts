// Authentification des appels "serveur à serveur" (triggers Postgres via pg_net, avec la clé
// service_role stockée dans Vault).
//
// Depuis le passage aux nouvelles clés API Supabase, SUPABASE_SERVICE_ROLE_KEY (variable
// d'environnement des fonctions) peut contenir la nouvelle clé secrète `sb_secret_…` alors que
// Vault contient le JWT service_role historique : la comparaison stricte des deux échouait et
// rejetait tous les appels des triggers. On accepte donc aussi un JWT de rôle service_role.
//
// N'utiliser QUE dans une fonction déployée avec verify_jwt = true (valeur par défaut) : c'est la
// passerelle Supabase qui vérifie la signature du JWT avant d'exécuter la fonction ; ici on ne fait
// que lire le rôle d'un jeton déjà authentifié.

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function jwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      role?: unknown;
    };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function isServiceRoleRequest(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  if (SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY) return true;
  return jwtRole(token) === "service_role";
}
