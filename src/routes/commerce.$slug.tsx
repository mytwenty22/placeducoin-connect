import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, Navigation, Clock, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { GoogleRatingStars } from "@/components/GoogleRatingStars";
import { CouponButton } from "@/components/CouponButton";
import { ActivateOfferButton } from "@/components/ActivateOfferButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { FeaturedEventBlock } from "@/components/FeaturedEventBlock";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { getOffer, type CategoryKey, type Offer, type PromoItem } from "@/lib/placeducoin-data";
import { validateOfferSearch } from "@/lib/offer-search";
import { supabase } from "@/lib/supabase";
import { logStatEvent, isFromGoogleReferrer } from "@/lib/stats-tracking";
import type { Horaire } from "@/lib/horaires";

async function loadRealOffer(slug: string): Promise<Offer | null> {
  const { data: commerce } = await supabase
    .from("commerces")
    .select(
      "id, nom, trade, category, adresse, telephone, photo_url, site_actif, google_rating, google_review_count, horaires, latitude, longitude, villes(nom)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!commerce) return null;

  const nowIso = new Date().toISOString();
  const [{ data: promoRows }, { data: event }] = await Promise.all([
    // Toutes les offres actives, la plus urgente (fin la plus proche) en premier -- même ordre que
    // le carrousel de la carte sur la marketplace.
    supabase
      .from("promos")
      .select("id, titre, kind, photo_url, prix_avant, prix_maintenant, valide_jusqu_a")
      .eq("commerce_id", commerce.id)
      .in("kind", ["promo", "arrivage"])
      .gt("valide_jusqu_a", nowIso)
      .order("valide_jusqu_a", { ascending: true }),
    // Pour un événement, valide_jusqu_a est sa date/heure : le plus proche à venir est "à la Une".
    supabase
      .from("promos")
      .select("titre, description, photo_url, valide_jusqu_a")
      .eq("commerce_id", commerce.id)
      .eq("kind", "evenement")
      .gt("valide_jusqu_a", nowIso)
      .order("valide_jusqu_a", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const villeEmbed = Array.isArray(commerce.villes) ? commerce.villes[0] : commerce.villes;
  const hoursLeft = (iso: string) =>
    Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
  const activePromos: PromoItem[] = (promoRows ?? []).map((p) => ({
    id: p.id,
    title: p.titre,
    kind: p.kind,
    ...(p.prix_avant != null ? { priceBefore: p.prix_avant } : {}),
    ...(p.prix_maintenant != null ? { priceNow: p.prix_maintenant } : {}),
    endsInHours: hoursLeft(p.valide_jusqu_a),
    ...(p.photo_url ? { photoUrl: p.photo_url } : {}),
  }));
  const promo = promoRows?.[0];
  const endsInHours = promo ? hoursLeft(promo.valide_jusqu_a) : 0;
  const photoUrl = promo?.photo_url ?? commerce.photo_url;

  return {
    slug,
    shop: commerce.nom,
    trade: commerce.trade,
    category: commerce.category as CategoryKey,
    city: villeEmbed?.nom ?? "",
    distanceKm: 0,
    title: promo?.titre ?? "",
    kind: promo?.kind ?? "promo",
    commerceId: commerce.id,
    hasLocation: commerce.latitude != null && commerce.longitude != null,
    ...(promo?.id ? { promoId: promo.id } : {}),
    ...(promo?.prix_avant != null ? { priceBefore: promo.prix_avant } : {}),
    ...(promo?.prix_maintenant != null ? { priceNow: promo.prix_maintenant } : {}),
    endsInHours,
    sponsored: false,
    address: commerce.adresse ?? "",
    phone: commerce.telephone ?? "",
    hours: ((commerce.horaires as Horaire[] | null) ?? []).map((h) => ({
      day: h.jour,
      value: h.valeur,
    })),
    services: [],
    premium: commerce.site_actif,
    ...(photoUrl ? { photoUrl } : {}),
    ...(commerce.google_rating != null ? { googleRating: commerce.google_rating } : {}),
    googleReviewCount: commerce.google_review_count,
    activePromos,
    ...(event
      ? {
          featuredEvent: {
            title: event.titre,
            date: event.valide_jusqu_a,
            ...(event.description ? { description: event.description } : {}),
            ...(event.photo_url ? { photoUrl: event.photo_url } : {}),
          },
        }
      : {}),
  };
}

export const Route = createFileRoute("/commerce/$slug")({
  validateSearch: validateOfferSearch,
  loader: async ({ params }) => {
    const offer = (await loadRealOffer(params.slug)) ?? getOffer(params.slug);
    if (!offer) throw notFound();
    return { offer };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Commerce introuvable — SpotLocal" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { offer } = loaderData;
    const title = `${offer.shop} — ${offer.trade} à ${offer.city}`;
    const highlight = offer.title || offer.featuredEvent?.title;
    const description = `${highlight ? `${highlight}. ` : ""}Horaires, tarifs et coordonnées de ${offer.shop} à ${offer.city}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ShopSite,
});

function countdown(hours: number) {
  if (hours < 1) return "Dernières minutes";
  if (hours < 24) return `Fin dans ${hours}h`;
  return `Fin dans ${Math.round(hours / 24)}j`;
}

// Toutes les offres actives du commerce, une carte (et un coupon) par offre, en carrousel
// horizontal. `initialId` : l'offre cliquée sur la marketplace, mise en avant à l'ouverture.
function OffersCarousel({
  promos,
  initialId,
  shop,
  commerceId,
  hasLocation,
}: {
  promos: PromoItem[];
  initialId: string | undefined;
  shop: string;
  commerceId: string | undefined;
  hasLocation: boolean;
}) {
  const initialIndex = Math.max(
    0,
    promos.findIndex((p) => p.id === initialId),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const trackRef = useRef<HTMLDivElement>(null);
  const preselected = initialId !== undefined && promos.some((p) => p.id === initialId);

  function scrollToIndex(index: number, behavior: ScrollBehavior = "smooth") {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;
    const padding = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft - padding, behavior });
  }

  // À l'ouverture : on amène l'offre pré-sélectionnée à l'écran, sans animation.
  useEffect(() => {
    if (!preselected) return;
    scrollToIndex(initialIndex, "auto");
    trackRef.current?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suit le défilement au doigt pour mettre à jour l'indicateur.
  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const padding = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const cards = Array.from(track.children) as HTMLElement[];
    let closest = 0;
    let best = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft - track.offsetLeft - padding - track.scrollLeft);
      if (d < best) {
        best = d;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }

  function go(index: number) {
    const next = Math.min(promos.length - 1, Math.max(0, index));
    setActiveIndex(next);
    scrollToIndex(next);
  }

  const multiple = promos.length > 1;

  return (
    <section aria-label="Offres du moment">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl font-extrabold text-foreground">
          🔥 {multiple ? `${promos.length} offres du moment` : "Offre du moment"}
        </h2>
        {multiple ? (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Offre précédente"
              disabled={activeIndex === 0}
              onClick={() => go(activeIndex - 1)}
              className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Offre suivante"
              disabled={activeIndex === promos.length - 1}
              onClick={() => go(activeIndex + 1)}
              className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={trackRef}
        onScroll={multiple ? onScroll : undefined}
        className="scrollbar-none -mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {promos.map((p, i) => {
          const highlighted = preselected && p.id === initialId;
          return (
            <article
              key={p.id}
              aria-label={`Offre ${i + 1} sur ${promos.length}`}
              className={`surface-card flex shrink-0 snap-start flex-col overflow-hidden ${
                multiple ? "w-[85%] sm:w-[calc(50%-0.5rem)]" : "w-full"
              } ${highlighted ? "ring-2 ring-promo" : "border-promo/40"}`}
            >
              {p.photoUrl ? (
                <img
                  src={p.photoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-36 w-full bg-slate-50 object-contain"
                />
              ) : null}
              <div className="bg-gradient-promo px-5 py-4 text-promo-foreground">
                <p className="text-xs font-bold uppercase tracking-widest">
                  {p.kind === "arrivage" ? "Arrivage" : "Promo"}
                  {highlighted ? " · Votre sélection" : ""}
                </p>
                <h3 className="mt-1 font-display text-xl font-extrabold">{p.title}</h3>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  {p.priceBefore ? (
                    <span className="text-sm line-through opacity-80">
                      {p.priceBefore.toFixed(2)} €
                    </span>
                  ) : null}
                  {p.priceNow !== undefined ? (
                    <span className="font-display text-3xl font-black">
                      {p.priceNow === 0 ? "Offert" : `${p.priceNow.toFixed(2)} €`}
                    </span>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 text-xs font-bold">
                    <Clock className="h-3.5 w-3.5" /> {countdown(p.endsInHours)}
                  </span>
                </div>
              </div>
              <div className="mt-auto flex flex-col items-start gap-3 px-5 py-4">
                {/* Sans position GPS du commerce, pas de validation sur place : coupon simple. */}
                {hasLocation ? (
                  <ActivateOfferButton
                    promoId={p.id}
                    shopName={shop}
                    promoTitle={p.title}
                    commerceId={commerceId}
                  />
                ) : (
                  <CouponButton commerceId={commerceId} />
                )}
              </div>
            </article>
          );
        })}
      </div>

      {multiple ? (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {promos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Voir l'offre ${i + 1}`}
              aria-current={i === activeIndex}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? "w-4 bg-promo" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const GALLERY = [
  "from-navy to-navy-soft",
  "from-promo/80 to-promo",
  "from-mairie/70 to-mairie",
  "from-navy-soft to-promo/70",
];

function ShopSite() {
  const { offer } = Route.useLoaderData();
  const { offre } = Route.useSearch();
  // Fiches de démonstration (données statiques) : une seule offre, reconstituée depuis l'Offer.
  const promos: PromoItem[] =
    offer.activePromos ??
    (offer.endsInHours > 0 && offer.kind !== "evenement"
      ? [
          {
            id: offer.promoId ?? offer.slug,
            title: offer.title,
            kind: offer.kind,
            ...(offer.priceBefore !== undefined ? { priceBefore: offer.priceBefore } : {}),
            ...(offer.priceNow !== undefined ? { priceNow: offer.priceNow } : {}),
            endsInHours: offer.endsInHours,
          },
        ]
      : []);

  useEffect(() => {
    void logStatEvent(offer.commerceId, "app_view");
    if (isFromGoogleReferrer()) void logStatEvent(offer.commerceId, "google_view");
  }, [offer.commerceId]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <header className="bg-gradient-navy pb-10 pt-8 text-primary-foreground">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{offer.shop}</h1>
          <p className="mt-1 text-primary-foreground/80">{offer.trade}</p>
          <GoogleRatingStars
            rating={offer.googleRating}
            reviewCount={offer.googleReviewCount}
            className="mt-2"
            textClassName="text-primary-foreground"
            mutedTextClassName="text-primary-foreground/60"
          />
          <p className="mt-1 text-sm text-primary-foreground/60">{offer.address}</p>
          {offer.featuredEvent ? (
            <FeaturedEventBlock
              title={offer.featuredEvent.title}
              date={offer.featuredEvent.date}
              description={offer.featuredEvent.description}
              photoUrl={offer.featuredEvent.photoUrl}
              className="mt-5"
            />
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`tel:${offer.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-2 rounded-xl bg-promo px-4 py-2.5 text-sm font-semibold text-promo-foreground transition-opacity hover:opacity-90"
            >
              <Phone className="h-4 w-4" /> {offer.phone}
            </a>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(offer.address)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary-foreground/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Navigation className="h-4 w-4" /> Itinéraire
            </a>
            <FavoriteButton
              commerceId={offer.commerceId}
              className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {promos.length > 0 ? (
          <OffersCarousel
            promos={promos}
            initialId={offre}
            shop={offer.shop}
            commerceId={offer.commerceId}
            hasLocation={offer.hasLocation === true}
          />
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold text-foreground">Galerie</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {offer.photoUrl ? (
              <img
                src={offer.photoUrl}
                alt={offer.shop}
                loading="lazy"
                decoding="async"
                className="aspect-square rounded-2xl bg-slate-50 object-contain shadow-card"
              />
            ) : null}
            {GALLERY.slice(offer.photoUrl ? 1 : 0).map((g, i) => (
              <div
                key={i}
                className={`aspect-square rounded-2xl bg-gradient-to-br ${g} shadow-card`}
                aria-label={`Photo ${i + 1} de ${offer.shop}`}
              />
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="surface-card p-5">
            <h2 className="font-display text-xl font-extrabold text-foreground">
              Tarifs & prestations
            </h2>
            {offer.services.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Aucune prestation renseignée.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {offer.services.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-4 py-3">
                    <span className="min-w-0 text-sm text-foreground">{s.name}</span>
                    <span className="shrink-0 text-sm font-bold text-navy">{s.price}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-extrabold text-foreground">Horaires</h2>
              <span className="ml-auto rounded-full bg-mairie/10 px-2 py-1 text-[11px] font-semibold text-mairie">
                Sync. Google Business
              </span>
            </div>
            {offer.hours.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Horaires non renseignés.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {offer.hours.map((h) => (
                  <li key={h.day} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{h.day}</span>
                    <span className="font-medium text-foreground">{h.value}</span>
                  </li>
                ))}
              </ul>
            )}
            {offer.premium ? (
              <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-navy">
                <Flame className="h-3.5 w-3.5 text-promo" /> Site sur-mesure SpotLocal
              </p>
            ) : null}
          </section>
        </div>
      </main>

      <InstallAppBanner />
    </div>
  );
}
