import { useQuery } from "@tanstack/react-query";
import { Sprout } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { supportLevel } from "@/lib/local-support";

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Compteur global des montants déclarés après validation de coupons (sans mention de ville). */
export function LocalSupportCard({ userId }: { userId: string }) {
  const totalQuery = useQuery({
    queryKey: ["soutien-local-total", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("soutiens_locaux")
        .select("montant")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return (data ?? []).reduce((sum, row) => sum + Number(row.montant), 0);
    },
  });

  // Table absente (migration pas encore appliquée) ou erreur réseau : on n'affiche rien plutôt
  // qu'un message d'erreur sur la page du compte.
  if (totalQuery.isError) return null;
  const total = totalQuery.data ?? 0;

  return (
    <section className="surface-card mt-8 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <Sprout className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-foreground">
            Vous avez fait vivre les petits commerces à hauteur de{" "}
            <strong className="font-display text-lg font-extrabold">
              {totalQuery.isLoading ? "…" : euros.format(total)}
            </strong>
          </p>
          <p className="mt-1 inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
            {supportLevel(total)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Sachez qu'un petit commerce indépendant consacre en moyenne 65 à 75 % de chaque achat à ses
        matières premières, producteurs, loyers, énergie et cotisations locales : votre passage fait
        vivre toute une chaîne de proximité.
      </p>
    </section>
  );
}
