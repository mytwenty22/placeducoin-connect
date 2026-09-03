import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Phone, Navigation, Clock, MapPin, CalendarDays, Instagram, Package } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { GoogleRatingStars } from "@/components/GoogleRatingStars";
import { supabase } from "@/lib/supabase";
import { computeOpenStatus, type Horaire } from "@/lib/horaires";
import { getReadableTextColor } from "@/lib/color";
import { THEME_STYLES, type ThemeVisuel } from "@/lib/site-theme";

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
  instagram: string | null;
  galerie_urls: string[];
  video_url: string | null;
  theme_visuel: ThemeVisuel;
  site_actif: boolean;
  google_rating: number | null;
  google_review_count: number | null;
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
  loader: async ({ params }) => {
    const { data: commerce } = await supabase
      .from("commerces")
      .select(
        "id, slug, nom, trade, adresse, telephone, photo_url, logo_url, description, horaires, instagram, galerie_urls, video_url, theme_visuel, site_actif, google_rating, google_review_count",
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
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: event } = await supabase
      .from("promos")
      .select("titre, description, valide_jusqu_a")
      .eq("commerce_id", commerce.id)
      .eq("kind", "evenement")
      .gt("valide_jusqu_a", new Date().toISOString())
      .order("valide_jusqu_a", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: produits } = await supabase
      .from("produits")
      .select("id, nom, prix, description, photo_url")
      .eq("commerce_id", commerce.id)
      .order("created_at", { ascending: false });

    return {
      commerce: commerce as SiteCommerce,
      promos: (promos ?? []) as SitePromo[],
      event: event as SiteEvent,
      produits: (produits ?? []) as SiteProduit[],
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Site introuvable — PlaceDuCoin" }] };
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

function StandaloneSite() {
  const { commerce, promos, event, produits } = Route.useLoaderData();

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

  const eventDate = event ? new Date(event.valide_jusqu_a) : null;
  const eventDaysLeft = eventDate
    ? Math.ceil((eventDate.getTime() - Date.now()) / (24 * 3600 * 1000))
    : null;
  const eventUrgencyLabel =
    eventDaysLeft === null
      ? ""
      : eventDaysLeft <= 0
        ? "Aujourd'hui"
        : eventDaysLeft === 1
          ? "Demain"
          : `Dans ${eventDaysLeft} jours`;

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
              className="mx-auto h-16 w-16 rounded-full border-2 border-white/30 object-cover shadow-lift"
            />
          ) : (
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-white/30 bg-white/10 text-2xl font-black text-white">
              {commerce.nom.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="mt-4 font-display text-3xl font-extrabold">{commerce.nom}</h1>
          <p className="mt-1 text-white/70">{commerce.trade}</p>
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
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Bannière événement premium : mise en avant tout en haut, avec badge d'urgence */}
        {event && eventDate ? (
          <section className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1e293b] to-[#334155] p-6 text-white shadow-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-promo px-3 py-1 text-xs font-bold uppercase tracking-wide text-promo-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Événement à venir
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                {eventUrgencyLabel}
              </span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-extrabold">{event.titre}</h2>
            <p className="mt-1 text-sm font-medium text-white/70">
              {eventDate.toLocaleString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {event.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-white/80">{event.description}</p>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="space-y-6 lg:col-span-2">
            {/* Offres & Promotions : jusqu'à 3, en liste verticale */}
            {promos.length > 0 ? (
              <section className={`${cardClass} p-5`}>
                <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>
                  Offres & Promotions
                </h2>
                <div className={`mt-3 divide-y ${dividerClass}`}>
                  {promos.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 shrink-0 rounded-xl object-cover"
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
                  ))}
                </div>
              </section>
            ) : null}

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

            {/* Catalogue de produits */}
            {produits.length > 0 ? (
              <section className={`${cardClass} p-5`}>
                <h2 className={`font-display text-lg font-extrabold ${headingClass}`}>Catalogue</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {produits.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 ${dividerClass}`}
                    >
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100">
                          <Package className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${headingClass}`}>{p.nom}</p>
                        {p.description ? (
                          <p className={`truncate text-xs ${mutedClass}`}>{p.description}</p>
                        ) : null}
                      </div>
                      {p.prix != null ? (
                        <p className="shrink-0 font-display text-sm font-extrabold text-promo">
                          {p.prix.toFixed(2)} €
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
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
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
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
        Propulsé par{" "}
        <Link to="/" className="font-semibold hover:underline">
          PlaceDuCoin
        </Link>
      </footer>
    </div>
  );
}
