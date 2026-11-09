import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, ExternalLink, FileCheck2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ClaimRow = {
  request_id: string;
  commerce_id: string;
  commerce_nom: string;
  commerce_slug: string;
  commerce_adresse: string | null;
  ville_nom: string | null;
  user_email: string | null;
  contact_name: string;
  phone: string;
  siret: string;
  message: string | null;
  created_at: string;
};

const LIST_KEY = ["admin-claims"];

/** Demandes de revendication en attente : l'approbation rattache le compte demandeur à la fiche. */
export function AdminClaims() {
  const queryClient = useQueryClient();

  const claimsQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_claim_requests");
      if (error) throw new Error(error.message);
      return (data ?? []) as ClaimRow[];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc(
        approve ? "admin_approve_claim_request" : "admin_reject_claim_request",
        { p_request_id: id },
      );
      if (error) throw new Error(error.message);
      return approve;
    },
    onSuccess: (approve) => {
      toast.success(approve ? "Revendication approuvée" : "Revendication refusée");
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: ["admin-fiches"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const claims = claimsQuery.data ?? [];
  const busy = resolveMutation.isPending;

  return (
    <section>
      <div className="flex items-center gap-2">
        <FileCheck2 className="h-5 w-5 text-navy" />
        <h2 className="font-display text-lg font-extrabold text-foreground">
          Revendications de fiches
        </h2>
        {claimsQuery.data ? (
          <span className="ml-auto text-xs text-muted-foreground">{claims.length} en attente</span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {claimsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : null}
        {claimsQuery.isError ? (
          <p className="text-sm text-destructive">{(claimsQuery.error as Error).message}</p>
        ) : null}
        {claimsQuery.data && claims.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
        ) : null}

        {claims.map((c) => (
          <article key={c.request_id} className="surface-card p-3 text-sm">
            <p className="truncate font-semibold text-foreground">{c.commerce_nom}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[c.commerce_adresse, c.ville_nom].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 text-xs text-foreground">
              {c.contact_name} · {c.phone}
              {c.user_email ? ` · ${c.user_email}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              SIRET {c.siret} · demande du {new Date(c.created_at).toLocaleDateString("fr-FR")}
            </p>
            {c.message ? (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-secondary px-2 py-1 text-xs text-foreground">
                {c.message}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Rattacher « ${c.commerce_nom} » au compte ${c.user_email ?? c.contact_name} ?`,
                    )
                  ) {
                    resolveMutation.mutate({ id: c.request_id, approve: true });
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <BadgeCheck className="h-3.5 w-3.5" /> Approuver la revendication
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => resolveMutation.mutate({ id: c.request_id, approve: false })}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Refuser
              </button>
              <Link
                to="/commerce/$slug"
                params={{ slug: c.commerce_slug }}
                target="_blank"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-navy hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Voir
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
