import { createFileRoute, notFound } from "@tanstack/react-router";
import { Phone, Navigation, Clock, Flame } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { GoogleRatingStars } from "@/components/GoogleRatingStars";
import { getOffer, type CategoryKey, type Offer } from "@/lib/placeducoin-data";
import { supabase } from "@/lib/supabase";

async function loadRealOffer(slug: string): Promise<Offer | null> {
  const { data: commerce } = await supabase
    .from("commerces")
    .select(
      "id, nom, trade, category, adresse, telephone, photo_url, site_actif, google_rating, google_review_count, villes(nom)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!commerce) return null;

  const { data: promo } = await supabase
    .from("promos")
    .select("titre, kind, photo_url, prix_avant, prix_maintenant, valide_jusqu_a")
    .eq("commerce_id", commerce.id)
    .in("kind", ["promo", "arrivage"])
    .gt("valide_jusqu_a", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const villeEmbed = Array.isArray(commerce.villes) ? commerce.villes[0] : commerce.villes;
  const endsInHours = promo
    ? Math.max(0, Math.round((new Date(promo.valide_jusqu_a).getTime() - Date.now()) / 3_600_000))
    : 0;
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
    ...(promo?.prix_avant != null ? { priceBefore: promo.prix_avant } : {}),
    ...(promo?.prix_maintenant != null ? { priceNow: promo.prix_maintenant } : {}),
    endsInHours,
    sponsored: false,
    address: commerce.adresse ?? "",
    phone: commerce.telephone ?? "",
    hours: [],
    services: [],
    premium: commerce.site_actif,
    ...(photoUrl ? { photoUrl } : {}),
    ...(commerce.google_rating != null ? { googleRating: commerce.google_rating } : {}),
    googleReviewCount: commerce.google_review_count,
  };
}

export const Route = createFileRoute("/commerce/$slug")({
  loader: async ({ params }) => {
    const offer = (await loadRealOffer(params.slug)) ?? getOffer(params.slug);
    if (!offer) throw notFound();
    return { offer };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Commerce introuvable — PlaceDuCoin" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { offer } = loaderData;
    const title = `${offer.shop} — ${offer.trade} à ${offer.city}`;
    const description = `${offer.title}. Horaires, tarifs et coordonnées de ${offer.shop} à ${offer.city}.`;
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

const GALLERY = [
  "from-navy to-navy-soft",
  "from-promo/80 to-promo",
  "from-mairie/70 to-mairie",
  "from-navy-soft to-promo/70",
];

function ShopSite() {
  const { offer } = Route.useLoaderData();
  const hasPromo = offer.endsInHours > 0;

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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {hasPromo ? (
          <section className="surface-card animate-pulse-none overflow-hidden border-promo/40">
            <div className="bg-gradient-promo px-5 py-4 text-promo-foreground">
              <p className="text-xs font-bold uppercase tracking-widest">🔥 Offre du moment</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold">{offer.title}</h2>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                {offer.priceBefore ? (
                  <span className="text-sm line-through opacity-80">
                    {offer.priceBefore.toFixed(2)} €
                  </span>
                ) : null}
                {offer.priceNow !== undefined ? (
                  <span className="font-display text-3xl font-black">
                    {offer.priceNow === 0 ? "Offert" : `${offer.priceNow.toFixed(2)} €`}
                  </span>
                ) : null}
                <span className="ml-auto inline-flex animate-pulse items-center gap-1 rounded-full bg-black/20 px-3 py-1 text-xs font-bold">
                  <Clock className="h-3.5 w-3.5" />
                  {offer.endsInHours < 24
                    ? `Fin dans ${offer.endsInHours}h`
                    : `Fin dans ${Math.round(offer.endsInHours / 24)}j`}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold text-foreground">Galerie</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {offer.photoUrl ? (
              <img
                src={offer.photoUrl}
                alt={offer.shop}
                className="aspect-square rounded-2xl object-cover shadow-card"
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
                <Flame className="h-3.5 w-3.5 text-promo" /> Site sur-mesure PlaceDuCoin
              </p>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
