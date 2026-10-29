import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Phone,
  Navigation,
  Clock,
  MapPin,
  Instagram,
  Package,
  BadgeCheck,
  Search,
  ArrowUpRight,
  Tag,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GoogleRatingStars } from "@/components/GoogleRatingStars";
import { ActivateOfferButton } from "@/components/ActivateOfferButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { FeaturedEventBlock } from "@/components/FeaturedEventBlock";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { PosterClientDemoCard } from "@/components/ClientDemoCard";
import { supabase } from "@/lib/supabase";
import { useCommerceRefresh } from "@/hooks/use-commerce-refresh";
import { computeOpenStatus, type Horaire } from "@/lib/horaires";
import type { Prestation } from "@/lib/prestations";
import { getSiteTheme, siteThemeVars } from "@/lib/site-theme";
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
  prestations_visibles: boolean;
  instagram: string | null;
  galerie_urls: string[];
  video_url: string | null;
  theme_visuel: string;
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

function euros(value: number) {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

export const Route = createFileRoute("/site/$slug")({
  validateSearch: validateOfferSearch,
  loader: async ({ params }) => {
    const { data: commerce } = await supabase
      .from("commerces")
      .select(
        "id, slug, nom, trade, adresse, telephone, photo_url, logo_url, description, horaires, prestations, prestations_visibles, instagram, galerie_urls, video_url, theme_visuel, site_actif, google_rating, google_review_count, latitude, longitude",
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
      // Serif des titres pour les thèmes Terracotta, Noir & Or et Bordeaux (src/lib/site-theme.ts).
      links: [
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap",
        },
      ],
    };
  },
  component: StandaloneSite,
});

/**
 * Apparition douce au défilement. Un bloc déjà à l'écran au chargement n'est jamais masqué : la
 * page reste lisible avant l'hydratation et sans JavaScript.
 */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.setAttribute("data-reveal", "hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          node.setAttribute("data-reveal", "shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--st-accent)">
          {eyebrow}
        </p>
        <h2 className="font-site mt-2 text-3xl font-semibold text-(--st-text) sm:text-4xl">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

/**
 * Photo affichée en entier (jamais rognée, comme partout dans l'app) mais sans bandes vides : le
 * cadre est rempli par la même photo, agrandie et floutée.
 */
function FullImage({
  src,
  alt = "",
  className = "",
  zoomOnHover = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  zoomOnHover?: boolean;
}) {
  return (
    <div className={`relative isolate overflow-hidden bg-(--st-surface-2) ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-70 blur-2xl saturate-150"
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-contain transition-transform duration-700 ease-out ${
          zoomOnHover ? "group-hover:scale-105" : ""
        }`}
      />
    </div>
  );
}

const surfaceClass = "rounded-3xl border border-(--st-border) bg-(--st-surface)";

function DescriptionBlock({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="space-y-2">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--st-accent)" />
            <span>{item}</span>
          </li>
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

  // Premier paragraphe en chapeau, plus grand.
  return (
    <div className="space-y-4 text-base leading-relaxed text-(--st-muted) [&>p:first-child]:text-lg [&>p:first-child]:text-(--st-text) sm:[&>p:first-child]:text-xl">
      {blocks}
    </div>
  );
}

// Fenêtres rendues hors de la page (portail) : elles reçoivent les variables du thème elles-mêmes.
// Le bouton de fermeture de DialogContent est son dernier enfant.
const dialogCloseClass =
  "[&>button:last-child]:z-10 [&>button:last-child]:rounded-full [&>button:last-child]:bg-black/55 [&>button:last-child]:p-2 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:backdrop-blur-md";

function TopBar({
  nom,
  logoUrl,
  phoneHref,
}: {
  nom: string;
  logoUrl: string | null;
  phoneHref: string | null;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? "border-b border-(--st-border) bg-[color-mix(in_srgb,var(--st-bg)_82%,transparent)] shadow-[0_8px_30px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-8">
        <BackButton
          className={`rounded-full px-3 py-2 backdrop-blur-md ${
            scrolled
              ? "bg-(--st-surface-2) text-(--st-text) hover:opacity-80"
              : "bg-black/35 text-white hover:bg-black/55"
          }`}
        />
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 transition-all duration-300 ${
            scrolled ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
          }`}
          aria-hidden={!scrolled}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5"
            />
          ) : null}
          <span className="font-site truncate text-base font-semibold text-(--st-text)">{nom}</span>
        </div>
        {phoneHref ? (
          <a
            href={phoneHref}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--st-accent) px-4 py-2 text-sm font-semibold text-(--st-accent-fg) shadow-lg transition-all duration-300 hover:brightness-110 ${
              scrolled ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            tabIndex={scrolled ? 0 : -1}
          >
            <Phone className="h-4 w-4" /> Appeler
          </a>
        ) : null}
      </div>
    </div>
  );
}

function OffersSection({
  promos,
  preselectedId,
  commerce,
}: {
  promos: SitePromo[];
  preselectedId: string | undefined;
  commerce: SiteCommerce;
}) {
  return (
    <section aria-labelledby="offres">
      <Reveal>
        <SectionHeading eyebrow="En ce moment" title="Offres & promotions" />
      </Reveal>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {promos.map((p, i) => {
          const discount =
            p.prix_avant != null && p.prix_maintenant != null && p.prix_avant > p.prix_maintenant
              ? Math.round((1 - p.prix_maintenant / p.prix_avant) * 100)
              : null;
          return (
            <Reveal key={p.id} delay={(i % 3) * 90}>
              <article
                id={`offre-${p.id}`}
                className={`${surfaceClass} flex h-full flex-col overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)] ${
                  p.id === preselectedId ? "ring-2 ring-(--st-accent)" : ""
                }`}
              >
                <div className="group relative aspect-[4/3] overflow-hidden bg-(--st-surface-2)">
                  {p.photo_url ? (
                    <FullImage src={p.photo_url} className="h-full w-full" zoomOnHover />
                  ) : (
                    <div className="bg-site-band grid h-full w-full place-items-center">
                      <Tag className="h-10 w-10 text-white/70" />
                    </div>
                  )}
                  {discount ? (
                    <span className="absolute left-4 top-4 rounded-full bg-(--st-accent) px-3 py-1 text-sm font-bold text-(--st-accent-fg) shadow-lg">
                      −{discount} %
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                  <div>
                    <h3 className="font-site text-xl font-semibold leading-snug text-(--st-text)">
                      {p.titre}
                    </h3>
                    <p className="mt-1 text-xs text-(--st-muted)">
                      Jusqu'au{" "}
                      {new Date(p.valide_jusqu_a).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {p.prix_maintenant != null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="font-site text-3xl font-semibold text-(--st-accent)">
                        {p.prix_maintenant === 0 ? "Offert" : euros(p.prix_maintenant)}
                      </span>
                      {p.prix_avant != null ? (
                        <span className="text-sm text-(--st-muted) line-through">
                          {euros(p.prix_avant)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {/* Sans position GPS du commerce : validation directe par code commerçant. */}
                  <ActivateOfferButton
                    promoId={p.id}
                    shopName={commerce.nom}
                    promoTitle={p.titre}
                    commerceId={commerce.id}
                    pinOnly={commerce.latitude == null || commerce.longitude == null}
                    className="mt-auto pt-1"
                  />
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// Catalogue complet du Site Pro : chaque produit s'ouvre sur sa fiche détaillée (grande photo,
// description entière, prix).
function ProductCatalogue({
  produits,
  themeVars,
  phoneHref,
}: {
  produits: SiteProduit[];
  themeVars: CSSProperties;
  phoneHref: string | null;
}) {
  const [selected, setSelected] = useState<SiteProduit | null>(null);
  const [query, setQuery] = useState("");
  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = normalize(query.trim());
  const visible = q
    ? produits.filter((p) => normalize(`${p.nom} ${p.description ?? ""}`).includes(q))
    : produits;

  return (
    <section aria-label="Catalogue">
      <Reveal>
        <SectionHeading
          eyebrow={`${produits.length} produit${produits.length > 1 ? "s" : ""}`}
          title="Le catalogue"
          aside={
            // Recherche utile dès que le catalogue dépasse un écran.
            produits.length > 6 ? (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--st-muted)" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un produit"
                  aria-label="Rechercher un produit"
                  className="w-full rounded-full border border-(--st-border) bg-(--st-surface) py-2.5 pl-10 pr-4 text-sm text-(--st-text) outline-none transition-shadow placeholder:text-(--st-muted) focus:ring-2 focus:ring-(--st-accent)"
                />
              </div>
            ) : null
          }
        />
      </Reveal>
      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-(--st-muted)">Aucun produit ne correspond à « {query} ».</p>
      ) : null}
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
        {visible.map((p, i) => (
          <Reveal key={p.id} delay={(i % 4) * 70}>
            <button
              type="button"
              onClick={() => setSelected(p)}
              className="group block w-full text-left outline-none"
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-(--st-surface-2) ring-(--st-accent) transition-shadow group-focus-visible:ring-2">
                {p.photo_url ? (
                  <FullImage src={p.photo_url} className="h-full w-full" zoomOnHover />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Package className="h-8 w-8 text-(--st-muted)" />
                  </div>
                )}
                <span className="absolute bottom-3 right-3 grid h-9 w-9 translate-y-2 place-items-center rounded-full bg-(--st-surface) text-(--st-text) opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-(--st-text) sm:text-base">
                {p.nom}
              </p>
              {p.prix != null ? (
                <p className="mt-1 text-sm font-semibold text-(--st-accent)">{euros(p.prix)}</p>
              ) : null}
            </button>
          </Reveal>
        ))}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          style={themeVars}
          className={`max-h-[90svh] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-y-auto rounded-3xl border-(--st-border) bg-(--st-surface) p-0 text-(--st-text) sm:grid-cols-2 sm:rounded-3xl ${dialogCloseClass}`}
        >
          {selected ? (
            <>
              <div className="aspect-square bg-(--st-surface-2) sm:aspect-auto sm:min-h-[26rem]">
                {selected.photo_url ? (
                  <FullImage
                    src={selected.photo_url}
                    alt={selected.nom}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Package className="h-12 w-12 text-(--st-muted)" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4 p-6 sm:p-8">
                <DialogTitle className="font-site text-2xl font-semibold leading-tight text-(--st-text) sm:text-3xl">
                  {selected.nom}
                </DialogTitle>
                {selected.prix != null ? (
                  <p className="font-site text-2xl font-semibold text-(--st-accent)">
                    {euros(selected.prix)}
                  </p>
                ) : null}
                <DialogDescription className="whitespace-pre-line text-sm leading-relaxed text-(--st-muted)">
                  {selected.description || "Pas de description pour ce produit."}
                </DialogDescription>
                {phoneHref ? (
                  <a
                    href={phoneHref}
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-(--st-accent) px-5 py-3 text-sm font-semibold text-(--st-accent-fg) transition hover:brightness-110"
                  >
                    <Phone className="h-4 w-4" /> Appeler pour ce produit
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Gallery({
  urls,
  nom,
  instagram,
}: {
  urls: string[];
  nom: string;
  instagram: string | null;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openUrl = openIndex !== null ? urls[openIndex] : undefined;

  return (
    <section aria-label="Galerie">
      <Reveal>
        <SectionHeading
          eyebrow="En images"
          title="Galerie"
          aside={
            instagram ? (
              <a
                href={instagramHref(instagram)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-(--st-border) bg-(--st-surface) px-4 py-2.5 text-sm font-semibold text-(--st-text) transition hover:border-(--st-accent)"
              >
                <Instagram className="h-4 w-4" /> Suivez-nous sur Instagram
              </a>
            ) : null
          }
        />
      </Reveal>
      {urls.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {urls.map((url, i) => (
            <Reveal
              key={`${url}-${i}`}
              delay={(i % 4) * 70}
              className={i === 0 && urls.length > 2 ? "col-span-2 row-span-2" : ""}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                aria-label={`Agrandir la photo ${i + 1}`}
                className="group block aspect-square w-full overflow-hidden rounded-2xl bg-(--st-surface-2)"
              >
                <FullImage
                  src={url}
                  alt={`Photo ${i + 1} de ${nom}`}
                  className="h-full w-full"
                  zoomOnHover
                />
              </button>
            </Reveal>
          ))}
        </div>
      ) : null}

      <Dialog open={openUrl !== undefined} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent
          className={`w-[calc(100%-2rem)] max-w-4xl border-0 bg-transparent p-0 shadow-none ${dialogCloseClass}`}
        >
          <DialogTitle className="sr-only">Photo de {nom}</DialogTitle>
          <DialogDescription className="sr-only">Photo agrandie de la galerie.</DialogDescription>
          {openUrl ? (
            <img src={openUrl} alt="" className="max-h-[85svh] w-full rounded-2xl object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StandaloneSite() {
  const { commerce, promos, event, produits } = Route.useLoaderData();
  useCommerceRefresh(commerce.slug);
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

  const phoneHref = commerce.telephone ? `tel:${commerce.telephone.replace(/\s/g, "")}` : null;
  const mapsHref = commerce.adresse
    ? `https://maps.google.com/?q=${encodeURIComponent(commerce.adresse)}`
    : null;
  const openStatus = computeOpenStatus(commerce.horaires);
  // Couleurs choisies par le commerçant (Espace Pro → Mon profil), voir src/lib/site-theme.ts.
  const theme = getSiteTheme(commerce.theme_visuel);
  const themeVars = siteThemeVars(theme);

  const quickInfos = [
    ...(openStatus || commerce.horaires.length > 0
      ? [
          {
            icon: Clock,
            label: "Horaires",
            value:
              openStatus === "ouvert"
                ? "Ouvert maintenant"
                : openStatus === "ferme"
                  ? "Fermé actuellement"
                  : "Voir les horaires",
            href: "#infos",
          },
        ]
      : []),
    ...(commerce.adresse && mapsHref
      ? [{ icon: MapPin, label: "Adresse", value: commerce.adresse, href: mapsHref }]
      : []),
    ...(commerce.telephone && phoneHref
      ? [{ icon: Phone, label: "Téléphone", value: commerce.telephone, href: phoneHref }]
      : []),
  ];

  return (
    <div style={themeVars} className="flex min-h-screen flex-col bg-(--st-bg) text-(--st-text)">
      <TopBar nom={commerce.nom} logoUrl={commerce.logo_url} phoneHref={phoneHref} />

      {/* Héros plein écran : photo de couverture (ou dégradé du thème), texte toujours blanc. */}
      <header className="relative isolate overflow-hidden">
        {commerce.photo_url ? (
          <>
            <img
              src={commerce.photo_url}
              alt=""
              className="animate-site-hero-zoom absolute inset-0 -z-20 h-full w-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/30 to-black/80" />
          </>
        ) : (
          <div className="bg-site-band absolute inset-0 -z-20">
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-(--st-accent) opacity-25 blur-3xl" />
            <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white opacity-10 blur-3xl" />
          </div>
        )}

        <div className="mx-auto flex min-h-[min(86svh,780px)] max-w-6xl flex-col justify-end px-5 pb-24 pt-28 text-white sm:px-8 sm:pb-32">
          <div className="animate-site-fade-up flex items-center gap-3">
            {commerce.logo_url ? (
              <img
                src={commerce.logo_url}
                alt={commerce.nom}
                className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-2xl sm:h-16 sm:w-16"
              />
            ) : (
              <div className="font-site grid h-14 w-14 place-items-center rounded-2xl bg-(--st-accent) text-2xl font-semibold text-(--st-accent-fg) shadow-2xl sm:h-16 sm:w-16">
                {commerce.nom.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-md">
              <BadgeCheck className="h-3.5 w-3.5" /> Site Pro
            </span>
          </div>

          <p
            className="animate-site-fade-up mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-white/75 sm:text-sm"
            style={{ animationDelay: "80ms" }}
          >
            {commerce.trade}
          </p>
          <h1
            className="animate-site-fade-up font-site mt-3 max-w-4xl text-[2.6rem] font-semibold leading-[1.02] [text-wrap:balance] sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "160ms" }}
          >
            {commerce.nom}
          </h1>

          <div
            className="animate-site-fade-up mt-5 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            {openStatus ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                <span
                  className={`h-2 w-2 rounded-full ${
                    openStatus === "ouvert"
                      ? "bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400"
                      : "bg-white/40"
                  }`}
                />
                {openStatus === "ouvert" ? "Ouvert" : "Fermé"}
              </span>
            ) : null}
            <GoogleRatingStars
              rating={commerce.google_rating ?? undefined}
              reviewCount={commerce.google_review_count ?? undefined}
              textClassName="text-white"
              mutedTextClassName="text-white/70"
            />
          </div>

          <div
            className="animate-site-fade-up mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "320ms" }}
          >
            {phoneHref ? (
              <a
                href={phoneHref}
                className="inline-flex items-center gap-2 rounded-full bg-(--st-accent) px-6 py-3.5 text-sm font-semibold text-(--st-accent-fg) shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <Phone className="h-4 w-4" /> Appeler
              </a>
            ) : null}
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
              >
                <Navigation className="h-4 w-4" /> Itinéraire
              </a>
            ) : null}
            <FavoriteButton
              commerceId={commerce.id}
              className="rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-white backdrop-blur-md hover:bg-white/20"
            />
          </div>

          {event ? (
            <FeaturedEventBlock
              title={event.titre}
              date={event.valide_jusqu_a}
              description={event.description}
              photoUrl={event.photo_url}
              showUrgency
              className="animate-site-fade-up mt-8 max-w-xl backdrop-blur-md"
            />
          ) : null}
        </div>
      </header>

      {/* Bandeau d'infos pratiques, à cheval sur le héros. */}
      {quickInfos.length > 0 ? (
        <div className="relative z-10 mx-auto -mt-12 w-full max-w-6xl px-5 sm:px-8">
          <div
            className={`${surfaceClass} grid divide-y divide-(--st-border) shadow-[0_30px_70px_-35px_rgba(0,0,0,0.5)] sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0`}
          >
            {quickInfos.map(({ icon: Icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                className="group flex min-w-0 items-center gap-4 p-5 transition-colors first:rounded-t-3xl last:rounded-b-3xl hover:bg-(--st-surface-2) sm:first:rounded-l-3xl sm:first:rounded-tr-none sm:last:rounded-r-3xl sm:last:rounded-bl-none"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--st-accent)_14%,transparent)] text-(--st-accent)">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-(--st-muted)">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-(--st-text)">
                    {value}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-20 px-5 py-16 sm:space-y-28 sm:px-8 sm:py-24">
        {/* Offres & Promotions : toutes les offres actives, chacune avec son coupon */}
        {promos.length > 0 ? (
          <OffersSection promos={promos} preselectedId={preselectedId} commerce={commerce} />
        ) : null}

        {/* Visiteurs arrivés via le QR code de l'affiche vitrine : la vidéo client. */}
        <div className="mx-auto max-w-2xl empty:hidden">
          <PosterClientDemoCard />
        </div>

        {/* Présentation */}
        {commerce.description ? (
          <section className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <Reveal>
              <SectionHeading eyebrow="Notre maison" title="Présentation" />
            </Reveal>
            <Reveal delay={100}>
              <DescriptionBlock text={commerce.description} />
            </Reveal>
          </section>
        ) : null}

        {/* Catalogue de produits (Site Pro uniquement, voir le loader) */}
        {produits.length > 0 ? (
          <ProductCatalogue produits={produits} themeVars={themeVars} phoneHref={phoneHref} />
        ) : null}

        {/* Tarifs & prestations, façon carte de restaurant (masquable depuis l'Espace Pro) */}
        {commerce.prestations_visibles && commerce.prestations.length > 0 ? (
          <section>
            <Reveal>
              <SectionHeading eyebrow="La carte" title="Tarifs & prestations" />
            </Reveal>
            <Reveal delay={80}>
              <ul className={`${surfaceClass} mt-8 grid gap-x-12 p-6 sm:grid-cols-2 sm:p-10`}>
                {commerce.prestations.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-3">
                    <span className="min-w-0 text-base text-(--st-text)">{p.nom}</span>
                    <span
                      aria-hidden
                      className="min-w-6 flex-1 -translate-y-1 border-b border-dotted border-(--st-muted) opacity-40"
                    />
                    {p.prix ? (
                      <span className="font-site shrink-0 text-base font-semibold text-(--st-accent)">
                        {p.prix}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Reveal>
          </section>
        ) : null}

        {/* Vidéo de présentation */}
        {commerce.video_url ? (
          <section>
            <Reveal>
              <SectionHeading eyebrow="Découvrir" title="En vidéo" />
            </Reveal>
            <Reveal delay={80}>
              <video
                src={commerce.video_url}
                controls
                playsInline
                className="mt-8 aspect-video w-full overflow-hidden rounded-3xl bg-black"
                poster={commerce.photo_url ?? undefined}
              />
            </Reveal>
          </section>
        ) : null}

        {/* Galerie photos & Instagram */}
        {commerce.galerie_urls.length > 0 || commerce.instagram ? (
          <Gallery urls={commerce.galerie_urls} nom={commerce.nom} instagram={commerce.instagram} />
        ) : null}

        {/* Infos pratiques : carte, horaires et coordonnées */}
        <section id="infos" className="scroll-mt-24">
          <Reveal>
            <SectionHeading eyebrow="Nous rendre visite" title="Infos pratiques" />
          </Reveal>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {commerce.adresse ? (
              <Reveal className="min-h-72">
                <div className={`${surfaceClass} h-full min-h-72 overflow-hidden`}>
                  <iframe
                    src={`https://www.google.com/maps?q=${encodeURIComponent(commerce.adresse)}&output=embed`}
                    // Carte assombrie pour les thèmes sombres.
                    className={`h-full min-h-72 w-full border-0 ${
                      theme.isDark ? "[filter:invert(0.92)_hue-rotate(180deg)_contrast(0.9)]" : ""
                    }`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Carte — ${commerce.nom}`}
                  />
                </div>
              </Reveal>
            ) : null}

            <Reveal delay={80}>
              <div className={`${surfaceClass} h-full p-6 sm:p-8`}>
                <h3 className="font-site text-xl font-semibold text-(--st-text)">Horaires</h3>
                {commerce.horaires.length > 0 ? (
                  <ul className="mt-4 divide-y divide-(--st-border)">
                    {commerce.horaires.map((h, i) => (
                      <li key={i} className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-(--st-muted)">{h.jour}</span>
                        <span className="text-right font-semibold text-(--st-text)">
                          {h.valeur}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-(--st-muted)">Horaires non renseignés.</p>
                )}

                <div className="mt-6 space-y-3 border-t border-(--st-border) pt-6">
                  {phoneHref ? (
                    <a
                      href={phoneHref}
                      className="flex items-center gap-3 text-sm font-semibold text-(--st-text) transition-colors hover:text-(--st-accent)"
                    >
                      <Phone className="h-4 w-4 shrink-0 text-(--st-accent)" /> {commerce.telephone}
                    </a>
                  ) : null}
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 text-sm font-semibold text-(--st-text) transition-colors hover:text-(--st-accent)"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-(--st-accent)" /> {commerce.adresse}
                    </a>
                  ) : null}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-(--st-border) bg-(--st-surface)">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-(--st-muted) sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="font-site text-xl font-semibold text-(--st-text)">{commerce.nom}</p>
            <p className="mt-1">{commerce.trade}</p>
          </div>
          <div className="sm:text-right">
            <p>
              Propulsé par{" "}
              <Link to="/" className="font-semibold text-(--st-text) hover:underline">
                SpotLocal
              </Link>
            </p>
            <nav
              aria-label="Informations légales"
              className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:justify-end"
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
          </div>
        </div>
      </footer>

      <InstallAppBanner />
    </div>
  );
}
