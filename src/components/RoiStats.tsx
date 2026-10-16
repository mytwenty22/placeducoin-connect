import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BadgeCheck, Eye, Megaphone, Ticket, TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { supabase } from "@/lib/supabase";

type Counters = {
  fiche_views: number;
  offer_views: number;
  coupons_generated: number;
  coupons_redeemed: number;
  estimated_revenue: number;
};

type RoiStats = {
  days: number;
  totals: Counters & { google_views: number; onsite_redeemed: number };
  period: Counters;
  daily: (Omit<Counters, "estimated_revenue"> & { day: string })[];
};

type Series = "views" | "coupons";

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("fr-FR");

const chartConfig = {
  fiche_views: { label: "Vues de la fiche", color: "var(--navy)" },
  offer_views: { label: "Vues des offres", color: "var(--chart-2)" },
  coupons_generated: { label: "Coupons générés", color: "var(--promo)" },
  coupons_redeemed: { label: "Validés en caisse", color: "var(--mairie)" },
} satisfies ChartConfig;

// Postgres renvoie bigint/numeric en chaînes selon le pilote : on normalise tout en nombres.
function toNumbers<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, k === "day" ? v : Number(v ?? 0)]),
  ) as T;
}

function rate(part: number, whole: number) {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)} %`;
}

/**
 * Widget "Statistiques ROI" de l'Espace Pro : vues de la fiche et des offres, coupons générés et
 * validés en caisse, chiffre d'affaires estimé, et courbe des 30 derniers jours.
 */
export function RoiStats({ commerceId }: { commerceId: string }) {
  const [series, setSeries] = useState<Series>("views");

  const statsQuery = useQuery({
    queryKey: ["commerce-roi-stats", commerceId],
    queryFn: async (): Promise<RoiStats> => {
      const { data, error } = await supabase.rpc("commerce_roi_stats", {
        p_commerce_id: commerceId,
        p_days: 30,
      });
      if (error) throw new Error(error.message);
      const raw = data as RoiStats;
      return {
        days: Number(raw.days),
        totals: toNumbers(raw.totals),
        period: toNumbers(raw.period),
        daily: (raw.daily ?? []).map(toNumbers),
      };
    },
    refetchInterval: 60_000,
  });

  const chartData = useMemo(
    () =>
      (statsQuery.data?.daily ?? []).map((d) => ({
        ...d,
        label: new Date(`${d.day}T12:00:00`).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        }),
      })),
    [statsQuery.data],
  );

  if (statsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement des statistiques…</p>;
  }
  if (statsQuery.isError || !statsQuery.data) {
    return (
      <p className="text-sm text-foreground">
        Erreur lors du chargement des statistiques : {(statsQuery.error as Error)?.message}
      </p>
    );
  }

  const { totals, period } = statsQuery.data;
  const tiles = [
    {
      label: "Vues de la fiche",
      value: totals.fiche_views,
      sub: `${integer.format(period.fiche_views)} sur 30 j · dont ${integer.format(totals.google_views)} via Google`,
      icon: Eye,
      tone: "text-navy",
    },
    {
      label: "Vues des offres",
      value: totals.offer_views,
      sub: `${integer.format(period.offer_views)} sur 30 j · sur l'accueil SpotLocal`,
      icon: Megaphone,
      tone: "text-chart-2",
    },
    {
      label: "Coupons générés",
      value: totals.coupons_generated,
      sub: `${integer.format(period.coupons_generated)} sur 30 j`,
      icon: Ticket,
      tone: "text-promo",
    },
    {
      label: "Validés en caisse",
      value: totals.coupons_redeemed,
      sub: `${integer.format(period.coupons_redeemed)} sur 30 j · ${rate(totals.coupons_redeemed, totals.coupons_generated)} des coupons générés`,
      icon: BadgeCheck,
      tone: "text-mairie",
    },
  ];

  const keys =
    series === "views"
      ? (["fiche_views", "offer_views"] as const)
      : (["coupons_generated", "coupons_redeemed"] as const);
  const empty = chartData.every((d) => keys.every((k) => d[k] === 0));

  return (
    <section className="space-y-3" aria-labelledby="roi-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 id="roi-title" className="font-display text-base font-extrabold text-foreground">
            Statistiques ROI
          </h3>
          <p className="text-xs text-muted-foreground">Depuis la création de votre fiche</p>
        </div>
        <div className="text-right">
          <p className="inline-flex items-center gap-1 font-display text-lg font-extrabold text-emerald-600">
            <TrendingUp className="h-4 w-4" /> {euros.format(totals.estimated_revenue)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            CA estimé · {euros.format(period.estimated_revenue)} sur 30 j
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
          <article key={label} className="surface-card p-4">
            <Icon className={`h-5 w-5 ${tone}`} />
            <p className="mt-2 font-display text-2xl font-extrabold text-foreground">
              {integer.format(value)}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-foreground">{label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>
          </article>
        ))}
      </div>

      <article className="surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-foreground">30 derniers jours</h4>
          <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs font-semibold">
            {(
              [
                ["views", "Vues"],
                ["coupons", "Coupons"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSeries(key)}
                aria-pressed={series === key}
                className={`rounded-full px-3 py-1 transition-colors ${
                  series === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-3">
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <defs>
                {keys.map((k) => (
                  <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                fontSize={11}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {keys.map((k) => (
                <Area
                  key={k}
                  dataKey={k}
                  type="monotone"
                  stroke={`var(--color-${k})`}
                  fill={`url(#fill-${k})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ChartContainer>
          {empty ? (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-xs font-medium text-muted-foreground">
              Pas encore d'activité sur cette période.
            </p>
          ) : null}
        </div>
      </article>

      <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
        <strong>Vues de la fiche</strong> : chaque visite de votre fiche ou de votre Site Pro.{" "}
        <strong>Vues des offres</strong> : votre carte avec une offre en cours affichée à l'écran
        sur l'accueil (une fois par visiteur et par visite). <strong>Coupons générés</strong> : un
        client a demandé à utiliser votre coupon. <strong>Validés en caisse</strong> : coupons
        validés sur place (position GPS vérifiée) ou confirmés par vous depuis l'onglet Promo Flash.{" "}
        <strong>CA estimé</strong> : somme des prix promo des coupons validés sur place.
      </p>
    </section>
  );
}
