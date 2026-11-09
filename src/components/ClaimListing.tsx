import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";

const FIELD_CLASS =
  "mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy";

/** Encart des fiches sans gérant : envoie une demande de revendication, examinée par un admin. */
export function ClaimListing({
  commerceId,
  slug,
  shop,
}: {
  commerceId: string;
  slug: string;
  shop: string;
}) {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [siret, setSiret] = useState("");
  const [message, setMessage] = useState("");

  const queryKey = ["claim-request", commerceId, userId];
  const pendingQuery = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claim_requests")
        .select("id")
        .eq("commerce_id", commerceId)
        .eq("user_id", userId!)
        .eq("status", "pending")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_claim_request", {
        p_commerce_id: commerceId,
        p_contact_name: contactName,
        p_phone: phone,
        p_siret: siret,
        p_message: message,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Demande envoyée : nous revenons vers vous après vérification.");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface-card mt-8 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Store className="h-5 w-5 shrink-0 text-navy" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {pendingQuery.data
            ? "Votre demande de revendication est en cours d'examen."
            : `Cette fiche n'a pas encore de gérant.`}
        </p>
        {pendingQuery.data ? null : userId ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Vous êtes le gérant ? Revendiquer cette fiche
          </button>
        ) : (
          <Link
            to="/compte"
            search={{ redirect: `/commerce/${slug}` }}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Vous êtes le gérant ? Revendiquer cette fiche
          </Link>
        )}
      </div>

      {open && !pendingQuery.data ? (
        <form
          className="mt-4 space-y-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitMutation.mutate();
          }}
        >
          <p className="text-xs text-muted-foreground">
            Ces informations nous servent à vérifier que vous gérez bien {shop}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-muted-foreground">
              Nom et prénom *
              <input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Téléphone *
              <input
                required
                type="tel"
                minLength={6}
                maxLength={30}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-muted-foreground">
            SIRET de l'établissement *
            <input
              required
              inputMode="numeric"
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Message (facultatif)
            <textarea
              rows={3}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitMutation.isPending ? "Envoi…" : "Envoyer ma demande"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
