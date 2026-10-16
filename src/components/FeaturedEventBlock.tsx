import { CalendarDays } from "lucide-react";
import { eventUrgencyLabel, formatEventDate } from "@/lib/event-date";

/**
 * Bloc "Événement à la Une" affiché dans l'en-tête sombre d'une fiche (page /commerce et Site
 * Pro) : le prochain événement à venir, visible dès l'arrivée sur la page.
 */
export function FeaturedEventBlock({
  title,
  date,
  description,
  photoUrl,
  showUrgency = false,
  className = "",
}: {
  title: string;
  date: string;
  description?: string | null | undefined;
  photoUrl?: string | null | undefined;
  showUrgency?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label="Événement à la Une"
      className={`flex gap-3 rounded-2xl bg-white/10 p-4 text-left text-white ring-1 ring-white/20 ${className}`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl bg-white/10 object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-promo px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-promo-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Événement à la Une
          </span>
          {showUrgency ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
              {eventUrgencyLabel(date)}
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 break-words font-display text-xl font-extrabold leading-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-sm font-semibold text-white/90">{formatEventDate(date)}</p>
        {description ? (
          <p className="mt-1 line-clamp-3 text-sm text-white/80">{description}</p>
        ) : null}
      </div>
    </section>
  );
}
