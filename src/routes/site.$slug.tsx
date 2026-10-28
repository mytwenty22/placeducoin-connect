import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Phone,
  Navigation,
  Clock,
  MapPin,
  CalendarDays,
  Instagram,
  Package,
  BadgeCheck,
  ChevronRight,
  Search,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoogleRatingStars } from "@/components/GoogleRatingStars";
import { ActivateOfferButton } from "@/components/ActivateOfferButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { FeaturedEventBlock } from "@/components/FeaturedEventBlock";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { PosterClientDemoCard } from "@/components/ClientDemoCard";
import { supabase } from "@/lib/supabase";
import { computeOpenStatus, type Horaire } from "@/lib/horaires";
import type { Prestation } from "@/lib/prestations";
import { getReadableTextColor } from "@/lib/color";
import { THEME_STYLES, type ThemeVisuel } from "@/lib/site-theme";
import { logStatEvent, isFromGoogleReferrer } from "@/lib/stats-tracking";
import { validateOfferSearch } from "@/lib/offer-search";
import { LEGAL_DOCS } from "@/lib/legal";

type SiteCommerce = {
  id: string;
  slug: string;
  nom: string;
  trade: string;
  adresse: string | null;
  telephone: string | null;
  photo_url: string | null;
  logo_url: string | null;
  description: string | null;
  horaires: Horaire[];
  prestations: Prestation[];
  instagram: string | null;
  galerie_urls: string[];
  video_url: string | null;
  theme_visuel: ThemeVisuel;
  site_actif: boolean;
  google_rating: number | null;
  google_review_count: number | null;
  latitude: number | null;
  longitude: number | null;
};

type SitePromo = {
  id: string;
  titre: string;
  photo_url: string | null;
  prix_avant: number | null;
  prix_maintenant: number | null;
  valide_jusqu_a: string;
};

type SiteEvent = {
  titre: string;
  description: string | null;
  photo_url: string | null;
  valide_jusqu_a: string;
} | null;

type SiteProduit = {
  id: string;
  nom: string;
  prix: number | null;
  description: string | null;
  photo_url: string | null;
};

function instagramHref(value: string) {
  if (value.startsWith("http")) return value;
  const handle = value.startsWith("@") ? value.slice(1) : value;
  return `https://instagram.com/${handle}`;
}

export const Route = createFileRoute("/site/$slug")({
  validateSearch: validateOfferSearch,
  loader: async ({ params }) => {
    const { data: commerce } = await supabase
      .from("commerces")
      .select(
        "id, slug, nom, trade, adresse, telephone, photo_url, logo_url, description, horaires, prestations, instagram, galerie_urls, video_url, theme_visuel, site_actif, google_rating, google_review_count, latitude, longitude",
      )
      .eq("slug", params.slug)
      .maybeSingle();
    if (!commerce) throw notFound();

    const { data: promos } = await supabase
      .from("promos")
      .select("id, titre, photo_url, prix_avant, prix_maintenant, valide_jusqu_a")
      .eq("commerce_id", commerce.id)
      .in("kind", ["promo", "arrivage"])
      .gt("valide_jusqu_a", new Date().toISOString())
      .order("valide_jusqu_a", { ascending: true });

    const { data: event } = await supabase
      .from("promos")
      .select("titre, description, photo_url, valide_jusqu_a")
      .eq("commerce_id", commerce.id)
      .eq("kind", "evenement")
      .gt("valide_jusqu_a", new Date().toISOString())
      .order("valide_jusqu_a", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Catalogue réservé au Site Pro : une fiche gratuite n'affiche que ses promos/actus. La base
    // applique la même règle (20261028100000_catalogue_site_pro_only.sql).
    const { data: produits } = commerce.site_actif
      ? await supabase
          .from("produits")
          .select("id, nom, prix, description, photo_url")
          .eq("commerce_id", commerce.id)
          .order("created_at", { ascending: false })
      : { data: [] };

    return {
      commerce: commerce as SiteCommerce,
      promos: (promos ?? []) as SitePromo[],
      event: event as SiteEvent,
      produits: (produits ?? []) as SiteProduit[],
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Site introuvable — SpotLocal" }] };
    }
    const { commerce } = loaderData;
    return {
      meta: [
        { title: `${commerce.nom} — ${commerce.trade}` },
        {
          name: "description",
          content: `${commerce.nom}, ${commerce.trade} à ${commerce.adresse ?? ""}.`,
        },
      ],
    };
  },
  component: StandaloneSite,
});

function DescriptionBlock({ text, mutedClass }: { text: string; mutedClass: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-1.5 pl-5">
        {bulletBuffer.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const bulletMatch = /^[-•*]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]!);
    } else {
      flushBullets();
      blocks.push(<p key={blocks.length}>{line}</p>);
    }
  }
  flushBullets();

  return <div className={`space-y-3 text-sm leading-relaxed ${mutedClass}`}>{blocks}</div>;
}

// Catalogue complet du Site Pro : chaque produit s'ouvre sur sa fiche détaillée (grande photo,
// description entière, prix).
function ProductCatalogue({
  produits,
  cardClass,
  headingClass,
  mutedClass,
  dividerClass,
}: {
  produits: SiteProduit[];
  cardClass: string;
  headingClass: string;
  mutedClass: string;
  dividerClass: string;
}) {
  const [selected, setSelected] = useState<SiteProduit | null>(null);
  const [query, setQuery] = useState("");
  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = normalize(query.trim());
  const visible = q
    ? produits.filter((p) => normalize(`${p.nom} ${p.description ?? ""}`).includes(q))
    : produits;

  return (
    <section className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>Catalogue</h2>
        <span className={`text-xs ${mutedClass}`}>
          {produits.length} produit{produits.length > 1 ? "s" : ""}
        </span>
      </div>
      {/* Recherche utile dès que le catalogue dépasse un écran. */}
      {produits.length > 6 ? (
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit"
            aria-label="Rechercher un produit"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className={`mt-3 text-sm ${mutedClass}`}>Aucun produit ne correspond à « {query} ».</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {visible.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-slate-50 ${dividerClass}`}
          >
            {p.photo_url ? (
              <img
                src={p.photo_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-16 w-16 shrink-0 rounded-xl bg-slate-50 object-contain"
              />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-100">
                <Package className="h-5 w-5 text-slate-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${headingClass}`}>{p.nom}</p>
              {p.description ? (
                <p className={`line-clamp-2 text-xs ${mutedClass}`}>{p.description}</p>
              ) : null}
              {p.prix != null ? (
                <p className="mt-1 font-display text-sm font-extrabold text-promo">
                  {p.prix.toFixed(2)} €
                </p>
              ) : null}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ))}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected ? (
            <>
              {selected.photo_url ? (
                <img
                  src={selected.photo_url}
                  alt={selected.nom}
                  className="max-h-80 w-full rounded-xl bg-slate-50 object-contain"
                />
              ) : null}
              <DialogHeader>
                <DialogTitle>{selected.nom}</DialogTitle>
                {selected.prix != null ? (
                  <p className="font-display text-2xl font-extrabold text-promo">
                    {selected.prix.toFixed(2)} €
                  </p>
                ) : null}
                <DialogDescription className="whitespace-pre-line text-sm leading-relaxed">
                  {selected.description || "Pas de description pour ce produit."}
                </DialogDescription>
              </DialogHeader>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StandaloneSite() {
  const { commerce, promos, event, produits } = Route.useLoaderData();
  const { offre } = Route.useSearch();
  const preselectedId = promos.some((p) => p.id === offre) ? offre : undefined;

  // Offre cliquée sur la marketplace : on l'amène à l'écran dès l'ouverture du site.
  useEffect(() => {
    if (!preselectedId) return;
    document.getElementById(`offre-${preselectedId}`)?.scrollIntoView({ block: "center" });
  }, [preselectedId]);

  useEffect(() => {
    if (!commerce.site_actif) return;
    void logStatEvent(commerce.id, "app_view");
    if (isFromGoogleReferrer()) void logStatEvent(commerce.id, "google_view");
  }, [commerce.id, commerce.site_actif]);

  if (!commerce.site_actif) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm text-slate-500">
          Ce site n'est pas (encore) activé par son propriétaire.
        </p>
        <Link to="/" className="text-sm font-semibold text-navy hover:underline">
          Retour à la marketplace
        </Link>
      </div>
    );
  }

  const theme = THEME_STYLES[commerce.theme_visuel];
  const phoneHref = commerce.telephone ? `tel:${commerce.telephone.replace(/\s/g, "")}` : null;
  const mapsHref = commerce.adresse
    ? `https://maps.google.com/?q=${encodeURIComponent(commerce.adresse)}`
    : null;
  const openStatus = computeOpenStatus(commerce.horaires);
  // Fond de bannière fixe et sobre : la couleur de marque du thème ne sert
  // plus qu'à teinter les boutons d'action (Appeler / Itinéraire).
  const callButtonTextColor = getReadableTextColor(theme.bandColor);
  const cardClass = "rounded-2xl border border-slate-200 bg-white shadow-md";
  const headingClass = "text-slate-900";
  const mutedClass = "text-slate-500";
  const dividerClass = "border-slate-200";
  // Fond de page très doux (#f8fafc) ou sombre pour les thèmes sombres : les
  // sections restent toujours en blanc pur pour un bon contraste.
  const pageBgClass = theme.isDark ? "bg-slate-950" : "bg-slate-50";

  return (
    <div className={`flex min-h-screen flex-col ${pageBgClass}`}>
      <div
        className="fixed left-3 z-50"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <BackButton className="rounded-full bg-black/40 px-3 py-2 text-white shadow-lift backdrop-blur-sm hover:bg-black/60" />
      </div>

      <header className="relative overflow-hidden">
        {/* Photo de couverture : bandeau au-dessus de la bannière sur mobile,
            devient le fond plein du header sur desktop (Option A). */}
        {commerce.photo_url ? (
          <img
            src={commerce.photo_url}
            alt=""
            className="h-40 w-full object-cover sm:h-56 lg:absolute lg:inset-0 lg:h-full"
          />
        ) : null}

        {/* Dégradé sombre pour garder le texte lisible par-dessus la photo (desktop uniquement) */}
        {commerce.photo_url ? (
          <div className="hidden lg:absolute lg:inset-0 lg:block lg:bg-gradient-to-t lg:from-black/85 lg:via-black/50 lg:to-black/10" />
        ) : null}

        {/* Bannière d'en-tête : fond sombre élégant fixe, sobre et lisible.
            Sur desktop avec photo, elle devient transparente et flotte en bas du hero. */}
        <div
          className={`relative px-6 py-10 text-center text-white lg:flex lg:min-h-[320px] lg:flex-col lg:items-center lg:justify-end lg:px-10 lg:py-10 ${
            commerce.photo_url ? "bg-[#1e293b] lg:bg-transparent" : "bg-[#1e293b]"
          }`}
        >
          {commerce.logo_url ? (
            <img
              src={commerce.logo_url}
              alt={commerce.nom}
              className="mx-auto h-16 w-16 rounded-full border-2 border-white/30 bg-slate-50 object-contain shadow-lift"
            />
          ) : (
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-white/30 bg-white/10 text-2xl font-black text-white">
              {commerce.nom.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="mt-4 font-display text-3xl font-extrabold">{commerce.nom}</h1>
          <p className="mt-1 text-white/70">{commerce.trade}</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/85">
            <BadgeCheck className="h-3.5 w-3.5" /> Site Pro
          </span>
          <div className="mt-2 flex justify-center">
            <GoogleRatingStars
              rating={commerce.google_rating ?? undefined}
              reviewCount={commerce.google_review_count ?? undefined}
              textClassName="text-white"
              mutedTextClassName="text-white/60"
            />
          </div>

          {openStatus ? (
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                openStatus === "ouvert" ? "bg-white text-emerald-700" : "bg-white/10 text-white/70"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  openStatus === "ouvert" ? "bg-emerald-500" : "bg-white/40"
                }`}
              />
              {openStatus === "ouvert" ? "Ouvert" : "Fermé"}
            </span>
          ) : null}

          {event ? (
            <FeaturedEventBlock
              title={event.titre}
              date={event.valide_jusqu_a}
              description={event.description}
              photoUrl={event.photo_url}
              showUrgency
              className="mx-auto mt-5 max-w-xl backdrop-blur-sm"
            />
          ) : null}

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {phoneHref ? (
              <a
                href={phoneHref}
                style={{ backgroundColor: theme.bandColor, color: callButtonTextColor }}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold shadow-lift transition-transform hover:scale-[1.03]"
              >
                <Phone className="h-4 w-4" /> Appeler
              </a>
            ) : null}
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                style={{ borderColor: theme.bandColor }}
                className="inline-flex items-center gap-1.5 rounded-full border-2 bg-white/5 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <Navigation className="h-4 w-4" /> Itinéraire
              </a>
            ) : null}
            <FavoriteButton
              commerceId={commerce.id}
              className="border-2 border-white/30 bg-white/5 rounded-full font-bold text-white backdrop-blur-sm hover:bg-white/10"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="space-y-6 lg:col-span-2">
            {/* Offres & Promotions : toutes les offres actives, chacune avec son coupon */}
            {promos.length > 0 ? (
              <section className={`${cardClass} p-5`}>
                <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>
                  Offres & Promotions
                </h2>
                <div className={`mt-3 divide-y ${dividerClass}`}>
                  {promos.map((p) => (
                    <div
                      key={p.id}
                      id={`offre-${p.id}`}
                      className={`py-3 first:pt-0 last:pb-0 ${
                        p.id === preselectedId
                          ? "-mx-2 rounded-xl px-2 ring-2 ring-promo first:pt-3 last:pb-3"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {p.photo_url ? (
                          <img
                            src={p.photo_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-14 w-14 shrink-0 rounded-xl bg-slate-50 object-contain"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${headingClass}`}>
                            {p.titre}
                          </p>
                          <p className={`text-xs ${mutedClass}`}>
                            Jusqu'au{" "}
                            {new Date(p.valide_jusqu_a).toLocaleString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {p.prix_maintenant != null ? (
                          <div className="shrink-0 text-right">
                            <p className="font-display text-lg font-extrabold text-promo">
                              {p.prix_maintenant.toFixed(2)} €
                            </p>
                            {p.prix_avant != null ? (
                              <p className={`text-xs line-through ${mutedClass}`}>
                                {p.prix_avant.toFixed(2)} €
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {/* Sans position GPS du commerce : validation directe par code commerçant. */}
                      <ActivateOfferButton
                        promoId={p.id}
                        shopName={commerce.nom}
                        promoTitle={p.titre}
                        commerceId={commerce.id}
                        pinOnly={commerce.latitude == null || commerce.longitude == null}
                        compact
                        className="mt-2"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Visiteurs arrivés via le QR code de l'affiche vitrine : la vidéo client. */}
            <PosterClientDemoCard />

            {/* Présentation */}
            {commerce.description ? (
              <section className={`${cardClass} p-5`}>
                <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>
                  Présentation
                </h2>
                <div className="mt-3">
                  <DescriptionBlock text={commerce.description} mutedClass={mutedClass} />
                </div>
              </section>
            ) : null}

            {/* Tarifs & prestations */}
            {commerce.prestations.length > 0 ? (
              <section className={`${cardClass} p-5`}>
                <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>
                  Tarifs & prestations
                </h2>
                <ul className={`mt-3 divide-y ${dividerClass}`}>
                  {commerce.prestations.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 py-2.5">
                      <span className={`min-w-0 text-sm ${headingClass}`}>{p.nom}</span>
                      {p.prix ? (
                        <span className="shrink-0 font-display text-sm font-extrabold text-promo">
                          {p.prix}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Catalogue de produits (Site Pro uniquement, voir le loader) */}
            {produits.length > 0 ? (
              <ProductCatalogue
                produits={produits}
                cardClass={cardClass}
                headingClass={headingClass}
                mutedClass={mutedClass}
                dividerClass={dividerClass}
              />
            ) : null}

            {/* Vidéo de présentation */}
            {commerce.video_url ? (
              <section className={`${cardClass} overflow-hidden p-5`}>
                <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>
                  Vidéo de présentation
                </h2>
                <video
                  src={commerce.video_url}
                  controls
                  className="mt-3 w-full rounded-2xl bg-black"
                  poster={commerce.photo_url ?? undefined}
                />
              </section>
            ) : null}

            {/* Galerie photos & Instagram */}
            {commerce.galerie_urls.length > 0 || commerce.instagram ? (
              <section className={`${cardClass} p-5`}>
                <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>Galerie</h2>
                {commerce.galerie_urls.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {commerce.galerie_urls.map((url, i) => (
                      <div
                        key={i}
                        className="aspect-square overflow-hidden rounded-2xl shadow-card"
                      >
                        <img
                          src={url}
                          alt={`Photo ${i + 1} de ${commerce.nom}`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full bg-slate-50 object-contain transition-transform duration-300 hover:scale-110"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                {commerce.instagram ? (
                  <a
                    href={instagramHref(commerce.instagram)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] py-3 text-sm font-bold text-white shadow-lift transition-transform hover:scale-[1.02]"
                  >
                    <Instagram className="h-4 w-4" /> Suivez-nous sur Instagram
                  </a>
                ) : null}
              </section>
            ) : null}
          </div>

          {/* Bloc ancré (sticky) : itinéraire, horaires et coordonnées */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:col-span-1">
            {commerce.adresse ? (
              <section className={`${cardClass} overflow-hidden !shadow-xl`}>
                <iframe
                  src={`https://www.google.com/maps?q=${encodeURIComponent(commerce.adresse)}&output=embed`}
                  className="h-48 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Carte — ${commerce.nom}`}
                />
              </section>
            ) : null}

            {/* Horaires & coordonnées */}
            <section className={`${cardClass} space-y-4 p-5 !shadow-xl`}>
              <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>
                Horaires & Coordonnées
              </h2>

              {commerce.horaires.length > 0 ? (
                <ul className="space-y-2">
                  {commerce.horaires.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className={`flex items-center gap-1.5 ${mutedClass}`}>
                        <Clock className="h-3.5 w-3.5 shrink-0" /> {h.jour}
                      </span>
                      <span className={`font-medium ${headingClass}`}>{h.valeur}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className={`space-y-2 border-t pt-3 ${dividerClass}`}>
                {phoneHref ? (
                  <a
                    href={phoneHref}
                    className={`flex items-center gap-1.5 text-sm transition-colors hover:text-slate-900 ${mutedClass}`}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {commerce.telephone}
                  </a>
                ) : null}
                {mapsHref ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-1.5 text-sm transition-colors hover:text-slate-900 ${mutedClass}`}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {commerce.adresse}
                  </a>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className={`border-t py-4 text-center text-xs ${dividerClass} ${mutedClass}`}>
        <p>
          Propulsé par{" "}
          <Link to="/" className="font-semibold hover:underline">
            SpotLocal
          </Link>
        </p>
        <nav
          aria-label="Informations légales"
          className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 px-4"
        >
          {LEGAL_DOCS.map((doc) => (
            <Link
              key={doc.key}
              to="/legal"
              search={{ doc: doc.key }}
              className="underline hover:no-underline"
            >
              {doc.short}
            </Link>
          ))}
        </nav>
      </footer>

      <InstallAppBanner />
    </div>
  );
}
