import { useState, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Clock,
  MapPin,
  Flame,
  Sparkles,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { CommerceListing, PromoItem } from "@/lib/placeducoin-data";
import { computeOpenStatus } from "@/lib/horaires";
import { THEME_STYLES, DEFAULT_THEME } from "@/lib/site-theme";
import { GoogleRatingStars } from "@/components/GoogleRatingStars";

function countdown(hours: number) {
  if (hours < 1) return "Dernières minutes";
  if (hours < 24) return `Fin dans ${hours}h`;
  return `Fin dans ${Math.round(hours / 24)}j`;
}

function eventDateLabel(iso: string) {
  return `Le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

function PromoKindBadge({ kind }: { kind: PromoItem["kind"] }) {
  if (kind === "promo") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-promo/10 px-2 py-1 text-promo">
        <Flame className="h-3.5 w-3.5" /> Promo
      </span>
    );
  }
  if (kind === "arrivage") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-mairie/10 px-2 py-1 text-mairie">
        <Sparkles className="h-3.5 w-3.5" /> Arrivage
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mairie/10 px-2 py-1 text-mairie">
      <CalendarDays className="h-3.5 w-3.5" /> Événement à venir
    </span>
  );
}

export function OfferCard({ commerce }: { commerce: CommerceListing }) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  const openStatus = computeOpenStatus(commerce.horaires ?? []);
  const styles = THEME_STYLES[commerce.themeVisuel ?? DEFAULT_THEME];
  const promos = commerce.promos;
  const hasPromos = promos.length > 0;
  const current = hasPromos ? (promos[activeIndex % promos.length] ?? promos[0]) : undefined;
  const isEvent = current?.kind === "evenement";
  const headerPhoto = current?.photoUrl ?? commerce.photoUrl;

  const destination = commerce.premium
    ? ({ to: "/site/$slug", params: { slug: commerce.slug } } as const)
    : ({ to: "/commerce/$slug", params: { slug: commerce.slug } } as const);

  function openFiche() {
    navigate(destination);
  }

  function goToPromo(e: MouseEvent, index: number) {
    e.stopPropagation();
    setActiveIndex(((index % promos.length) + promos.length) % promos.length);
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openFiche}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFiche();
        }
      }}
      className={`${styles.cardClass} hover-lift flex cursor-pointer flex-col overflow-hidden`}
    >
      {headerPhoto ? (
        <div className="relative">
          <img
            src={headerPhoto}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-32 w-full bg-slate-50 object-contain"
          />
          {commerce.logoUrl ? (
            <img
              src={commerce.logoUrl}
              alt=""
              className="absolute bottom-2 left-2 h-8 w-8 rounded-full border-2 border-white bg-slate-50 object-contain shadow-card"
            />
          ) : null}
          {openStatus ? (
            <span
              className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                openStatus === "ouvert" ? "bg-emerald-600 text-white" : "bg-black/60 text-white"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  openStatus === "ouvert" ? "bg-emerald-300" : "bg-white/60"
                }`}
              />
              {openStatus === "ouvert" ? "Ouvert" : "Fermé"}
            </span>
          ) : null}
          {promos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Offre précédente"
                onClick={(e) => goToPromo(e, activeIndex - 1)}
                className="absolute left-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Offre suivante"
                onClick={(e) => goToPromo(e, activeIndex + 1)}
                className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div
        className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${styles.divider}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {!headerPhoto && commerce.logoUrl ? (
            <img
              src={commerce.logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full bg-slate-50 object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <h3 className={`truncate text-base font-bold ${styles.heading}`}>{commerce.shop}</h3>
            <p className={`truncate text-xs ${styles.muted}`}>{commerce.trade}</p>
            <GoogleRatingStars
              rating={commerce.googleRating}
              reviewCount={commerce.googleReviewCount}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {commerce.sponsored ? (
            <span className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
              En Vedette
            </span>
          ) : null}
          {commerce.premium ? (
            <span className="rounded-full bg-mairie/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-mairie">
              Site pro
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {current ? <PromoKindBadge kind={current.kind} /> : null}
          <span className={`inline-flex items-center gap-1 ${styles.muted}`}>
            <MapPin className="h-3.5 w-3.5" /> {commerce.distanceKm} km
          </span>
        </div>

        {current ? (
          <>
            <p className={`text-sm font-medium leading-snug ${styles.heading}`}>{current.title}</p>

            <div className="mt-auto flex flex-wrap items-end gap-2">
              {current.priceBefore ? (
                <span className={`text-sm line-through ${styles.muted}`}>
                  {current.priceBefore.toFixed(2)} €
                </span>
              ) : null}
              {current.priceNow !== undefined ? (
                <span className="font-display text-2xl font-extrabold text-promo">
                  {current.priceNow === 0 ? "Offert" : `${current.priceNow.toFixed(2)} €`}
                </span>
              ) : null}
              <span
                className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                  styles.isDark ? "bg-white/10 text-white" : "bg-secondary text-navy"
                }`}
              >
                {isEvent ? (
                  <>
                    <CalendarDays className="h-3.5 w-3.5" />
                    {eventDateLabel(current.eventDate ?? new Date().toISOString())}
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" /> {countdown(current.endsInHours)}
                  </>
                )}
              </span>
            </div>

            {promos.length > 1 ? (
              <div className="flex items-center justify-center gap-1.5">
                {promos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={`Voir l'offre ${i + 1}`}
                    aria-current={i === activeIndex}
                    onClick={(e) => goToPromo(e, i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeIndex ? "w-4 bg-promo" : `w-1.5 ${styles.muted} bg-current/30`
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className={`text-sm leading-snug ${styles.muted}`}>
            {commerce.description || "Aucune offre en cours — consultez la fiche du commerce."}
          </p>
        )}

        <span className="mt-auto inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {commerce.premium ? "Voir le site sur-mesure" : "Voir la fiche"}
        </span>
      </div>
    </article>
  );
}
