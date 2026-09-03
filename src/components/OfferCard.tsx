import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Flame, Sparkles, CalendarDays } from "lucide-react";
import type { Offer } from "@/lib/placeducoin-data";
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

export function OfferCard({
  offer,
  activeOffersCount = 1,
}: {
  offer: Offer;
  activeOffersCount?: number;
}) {
  const openStatus = computeOpenStatus(offer.horaires ?? []);
  const extraOffers = activeOffersCount - 1;
  const styles = THEME_STYLES[offer.themeVisuel ?? DEFAULT_THEME];
  const isEvent = offer.kind === "evenement";

  return (
    <article className={`${styles.cardClass} hover-lift flex flex-col overflow-hidden`}>
      {offer.photoUrl ? (
        <div className="relative">
          <img
            src={offer.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-32 w-full object-cover"
          />
          {offer.logoUrl ? (
            <img
              src={offer.logoUrl}
              alt=""
              className="absolute bottom-2 left-2 h-8 w-8 rounded-full border-2 border-white object-cover shadow-card"
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
        </div>
      ) : null}

      <div
        className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${styles.divider}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {!offer.photoUrl && offer.logoUrl ? (
            <img
              src={offer.logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <h3 className={`truncate text-base font-bold ${styles.heading}`}>{offer.shop}</h3>
            <p className={`truncate text-xs ${styles.muted}`}>{offer.trade}</p>
            <GoogleRatingStars
              rating={offer.googleRating}
              reviewCount={offer.googleReviewCount}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {offer.sponsored ? (
            <span className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
              En Vedette
            </span>
          ) : null}
          {offer.premium ? (
            <span className="rounded-full bg-mairie/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-mairie">
              Site pro
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {offer.kind === "promo" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-promo/10 px-2 py-1 text-promo">
              <Flame className="h-3.5 w-3.5" /> Promo
            </span>
          ) : offer.kind === "arrivage" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-mairie/10 px-2 py-1 text-mairie">
              <Sparkles className="h-3.5 w-3.5" /> Arrivage
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-mairie/10 px-2 py-1 text-mairie">
              <CalendarDays className="h-3.5 w-3.5" /> Événement à venir
            </span>
          )}
          {!isEvent && extraOffers > 0 ? (
            <span className="rounded-full bg-promo/10 px-2 py-1 text-[11px] font-bold text-promo">
              +{extraOffers} autre{extraOffers > 1 ? "s" : ""} offre{extraOffers > 1 ? "s" : ""}
            </span>
          ) : null}
          <span className={`inline-flex items-center gap-1 ${styles.muted}`}>
            <MapPin className="h-3.5 w-3.5" /> {offer.distanceKm} km
          </span>
        </div>

        <p className={`text-sm font-medium leading-snug ${styles.heading}`}>{offer.title}</p>

        <div className="mt-auto flex flex-wrap items-end gap-2">
          {offer.priceBefore ? (
            <span className={`text-sm line-through ${styles.muted}`}>
              {offer.priceBefore.toFixed(2)} €
            </span>
          ) : null}
          {offer.priceNow !== undefined ? (
            <span className="font-display text-2xl font-extrabold text-promo">
              {offer.priceNow === 0 ? "Offert" : `${offer.priceNow.toFixed(2)} €`}
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
                {eventDateLabel(offer.eventDate ?? new Date().toISOString())}
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" /> {countdown(offer.endsInHours)}
              </>
            )}
          </span>
        </div>

        {offer.premium ? (
          <Link
            to="/site/$slug"
            params={{ slug: offer.slug }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-navy-soft"
          >
            Voir le site sur-mesure
          </Link>
        ) : (
          <Link
            to="/commerce/$slug"
            params={{ slug: offer.slug }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-navy-soft"
          >
            Voir le site
          </Link>
        )}
      </div>
    </article>
  );
}
