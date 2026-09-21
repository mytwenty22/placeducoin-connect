import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MapPinOff, ShoppingBag, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ConversionRow = {
  promo_id: string | null;
  promo_titre: string;
  activations: number;
  activations_30j: number;
  montant_estime: number;
};

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/**
 * Conversions en boutique : promos activées par des clients présents dans le rayon de 100 m, et
 * estimation du volume d'activité qu'elles ont apporté.
 */
export function ConversionStats({
  commerceId,
  hasLocation,
  onGoToProfile,
}: {
  commerceId: string;
  hasLocation: boolean;
  onGoToProfile: () => void;
}) {
  const conversionsQuery = useQuery({
    queryKey: ["commerce-conversion-stats", commerceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("commerce_conversion_stats", {
        p_commerce_id: commerceId,
      });
      if (error) throw new Error(error.message);
      // Postgres renvoie bigint/numeric : selon le pilote ce sont des chaînes, on normalise.
      return ((data ?? []) as ConversionRow[]).map((row) => ({
        ...row,
        activations: Number(row.activations),
        activations_30j: Number(row.activations_30j),
        montant_estime: Number(row.montant_estime),
      }));
    },
  });

  const rows = conversionsQuery.data ?? [];
  const totalActivations = rows.reduce((sum, row) => sum + row.activations, 0);
  const total30d = rows.reduce((sum, row) => sum + row.activations_30j, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.montant_estime, 0);

  const tiles = [
    {
      label: "Promos activées en boutique",
      value: String(totalActivations),
      icon: ShoppingBag,
      tone: "text-emerald-600",
    },
    {
      label: "Volume d'activité estimé",
      value: euros.format(totalAmount),
      icon: TrendingUp,
      tone: "text-navy",
    },
    {
      label: "Activations sur 30 jours",
      value: String(total30d),
      icon: CalendarClock,
      tone: "text-promo",
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-display text-base font-extrabold text-foreground">
          Conversions en boutique
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Clients qui ont activé une promo depuis votre boutique (à moins de 100 m).
        </p>
      </div>

      {!hasLocation ? (
        <div className="flex items-start gap-2 rounded-xl border border-promo/40 bg-promo/5 p-3 text-xs text-foreground">
          <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-promo" />
          <p>
            Le bouton « Profiter de cette offre en caisse » est masqué sur votre fiche tant que la
            position GPS de votre boutique n'est pas renseignée.{" "}
            <button type="button" onClick={onGoToProfile} className="font-bold text-navy underline">
              Renseigner ma position
            </button>
          </p>
        </div>
      ) : null}

      {conversionsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : conversionsQuery.isError ? (
        <p className="text-sm text-foreground">
          Erreur lors du chargement des conversions : {(conversionsQuery.error as Error).message}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map(({ label, value, icon: Icon, tone }, index) => (
              <article
                key={label}
                className={`surface-card p-4 ${index === 0 ? "col-span-2" : ""}`}
              >
                <Icon className={`h-5 w-5 ${tone}`} />
                <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </article>
            ))}
          </div>

          {rows.length > 0 ? (
            <div className="surface-card divide-y divide-border">
              {rows.map((row) => (
                <div
                  key={row.promo_id ?? row.promo_titre}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {row.promo_titre}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.activations} activation{row.activations > 1 ? "s" : ""}
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm font-bold text-navy">
                    {euros.format(row.montant_estime)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune promo activée pour l'instant.</p>
          )}

          <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            Le volume estimé additionne le prix « maintenant » de chaque promo activée (une offre
            sans prix compte pour 0 €). C'est une estimation de l'activité générée, pas un chiffre
            d'affaires encaissé.
          </p>
        </>
      )}
    </section>
  );
}
