import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, ChevronDown, Megaphone, Building2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SponsorBanner } from "@/components/SponsorBanner";
import { BottomSponsorBanner } from "@/components/BottomSponsorBanner";
import { OfferCard } from "@/components/OfferCard";
import { RadiusSelector } from "@/components/RadiusSelector";
import { CATEGORIES, type CategoryKey, type Offer } from "@/lib/placeducoin-data";
import { supabase } from "@/lib/supabase";
import { normalizeSearch } from "@/lib/utils";
import { withComputedDistance } from "@/lib/geo";
import { useUserPrefs } from "@/lib/user-prefs";
import { useVedetteAlerts } from "@/hooks/use-vedette-alerts";
import type { Horaire } from "@/lib/horaires";
import type { ThemeVisuel } from "@/lib/site-theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlaceDuCoin — La marketplace des commerces de votre quartier" },
      {
        name: "description",
        content:
          "Promos flash, arrivages et infos mairie des commerçants près de chez vous : boucher, coiffeur, fleuriste et plus.",
      },
      { property: "og:title", content: "PlaceDuCoin — Marketplace de quartier" },
      {
        property: "og:description",
        content: "Découvrez les offres du moment des commerces de votre ville, en direct.",
      },
    ],
  }),
  component: Marketplace,
});

type Ville = { id: string; nom: string; slug: string };
type PublicNotice = {
  id: string;
  titre: string;
  corps: string | null;
  type: "Événement" | "Travaux" | "Information";
  date_info: string | null;
};

type CommerceEmbed = {
  nom: string;
  trade: string;
  category: CategoryKey;
  adresse: string | null;
  telephone: string | null;
  slug: string;
  photo_url: string | null;
  logo_url: string | null;
  description: string | null;
  horaires: Horaire[];
  theme_visuel: ThemeVisuel;
  site_actif: boolean;
  boost_actif: boolean;
  google_rating: number | null;
  google_review_count: number | null;
  villes?: { nom: string } | { nom: string }[] | null;
};
type PromoRow = {
  id: string;
  titre: string;
  kind: "promo" | "arrivage" | "evenement";
  photo_url: string | null;
  prix_avant: number | null;
  prix_maintenant: number | null;
  valide_jusqu_a: string;
  created_at: string;
  commerces: CommerceEmbed | CommerceEmbed[];
};

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function mapPromoToOffer(row: PromoRow, fallbackCity: string): (Offer & { id: string }) | null {
  const commerce = unwrap(row.commerces);
  if (!commerce) return null;
  const villeEmbed = unwrap(commerce.villes);
  const photoUrl = row.photo_url ?? commerce.photo_url;
  const endsInHours = Math.max(
    0,
    Math.round((new Date(row.valide_jusqu_a).getTime() - Date.now()) / 3_600_000),
  );
  return {
    id: row.id,
    slug: commerce.slug,
    shop: commerce.nom,
    trade: commerce.trade,
    category: commerce.category,
    city: villeEmbed?.nom ?? fallbackCity,
    distanceKm: 0,
    title: row.titre,
    kind: row.kind,
    ...(row.prix_avant != null ? { priceBefore: row.prix_avant } : {}),
    ...(row.prix_maintenant != null ? { priceNow: row.prix_maintenant } : {}),
    endsInHours,
    sponsored: commerce.boost_actif,
    address: commerce.adresse ?? "",
    phone: commerce.telephone ?? "",
    hours: [],
    services: [],
    premium: commerce.site_actif,
    ...(photoUrl ? { photoUrl } : {}),
    ...(commerce.logo_url ? { logoUrl: commerce.logo_url } : {}),
    ...(commerce.description ? { description: commerce.description } : {}),
    ...(row.kind === "evenement" ? { eventDate: row.valide_jusqu_a } : {}),
    createdAt: row.created_at,
    horaires: commerce.horaires,
    themeVisuel: commerce.theme_visuel,
    ...(commerce.google_rating != null ? { googleRating: commerce.google_rating } : {}),
    ...(commerce.google_review_count != null
      ? { googleReviewCount: commerce.google_review_count }
      : {}),
  };
}

function sortActiveOffersFirst<
  T extends { kind: string; sponsored?: boolean; endsInHours: number },
>(offers: T[]): T[] {
  return [...offers].sort((a, b) => {
    const aEvent = a.kind === "evenement" ? 1 : 0;
    const bEvent = b.kind === "evenement" ? 1 : 0;
    if (aEvent !== bEvent) return aEvent - bEvent;

    const aFeatured = a.sponsored ? 0 : 1;
    const bFeatured = b.sponsored ? 0 : 1;
    if (aFeatured !== bFeatured) return aFeatured - bFeatured;

    // Tri chronologique : expire/a lieu le plus tôt en premier.
    return a.endsInHours - b.endsInHours;
  });
}

// Second passage de tri, appliqué juste avant le .map() d'affichage : garantit que
// les cartes "En Vedette" (is_featured / sponsored) sont TOUJOURS en tête, quoi qu'il
// arrive en amont. Le tri étant stable, l'ordre chronologique déjà calculé par
// sortActiveOffersFirst est conservé entre les cartes de même statut "vedette".
function featuredFirst<T extends { sponsored?: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aFeatured = Boolean(a.sponsored);
    const bFeatured = Boolean(b.sponsored);
    if (aFeatured && !bFeatured) return -1;
    if (!aFeatured && bFeatured) return 1;
    return 0;
  });
}

function Marketplace() {
  const [selectedVille, setSelectedVille] = useState<Ville | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const { radiusKm, favoriteCategories, position } = useUserPrefs();
  const hasPosition = position !== null;

  const villesQuery = useQuery({
    queryKey: ["villes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("villes").select("id, nom, slug").order("nom");
      if (error) throw error;
      return data as Ville[];
    },
  });

  useEffect(() => {
    const first = villesQuery.data?.[0];
    if (!selectedVille && first) {
      setSelectedVille(first);
    }
  }, [selectedVille, villesQuery.data]);

  const citySuggestions = useMemo(
    () =>
      (villesQuery.data ?? [])
        .filter((v) => v.nom.toLowerCase().includes(cityQuery.toLowerCase()))
        .slice(0, 6),
    [villesQuery.data, cityQuery],
  );

  const city = selectedVille?.nom ?? "";

  const featuredQuery = useQuery({
    queryKey: ["promos-featured", selectedVille?.id, category],
    queryFn: async () => {
      let queryBuilder = supabase
        .from("promos")
        .select(
          "id, titre, kind, photo_url, prix_avant, prix_maintenant, valide_jusqu_a, created_at, commerces!inner(nom, trade, category, adresse, telephone, slug, photo_url, logo_url, description, horaires, theme_visuel, site_actif, boost_actif, google_rating, google_review_count, ville_id, villes(nom))",
        )
        .eq("commerces.ville_id", selectedVille?.id)
        .in("kind", ["promo", "arrivage", "evenement"])
        .gt("valide_jusqu_a", new Date().toISOString());
      if (category) {
        queryBuilder = queryBuilder.eq("commerces.category", category);
      }
      const { data, error } = await queryBuilder.order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return (data as unknown as PromoRow[])
        .map((row) => mapPromoToOffer(row, city))
        .filter((o): o is Offer & { id: string } => o !== null);
    },
    enabled: !!selectedVille,
  });

  const sponsoredAll = sortActiveOffersFirst(featuredQuery.data ?? []);
  const sponsoredWithDistance = withComputedDistance(sponsoredAll, position);
  const sponsored = hasPosition
    ? sponsoredWithDistance.filter((o) => o.distanceKm <= radiusKm)
    : sponsoredWithDistance;

  useVedetteAlerts(sponsoredWithDistance, { radiusKm, favoriteCategories, hasPosition });

  const offersQuery = useQuery({
    queryKey: ["promos-marketplace", selectedVille?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promos")
        .select(
          "id, titre, kind, photo_url, prix_avant, prix_maintenant, valide_jusqu_a, created_at, commerces!inner(nom, trade, category, adresse, telephone, slug, photo_url, logo_url, description, horaires, theme_visuel, site_actif, boost_actif, google_rating, google_review_count, ville_id)",
        )
        .eq("commerces.ville_id", selectedVille?.id)
        .in("kind", ["promo", "arrivage", "evenement"])
        .gt("valide_jusqu_a", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as PromoRow[])
        .map((row) => mapPromoToOffer(row, city))
        .filter((o): o is Offer & { id: string } => o !== null);
    },
    enabled: !!selectedVille,
  });

  const searchQuery = normalizeSearch(query);
  const isSearching = searchQuery.length > 0;

  const filtered = useMemo(() => {
    const data = offersQuery.data ?? [];
    if (isSearching) {
      return sortActiveOffersFirst(
        data.filter((o) => {
          const categoryLabel = CATEGORIES.find((c) => c.key === o.category)?.label ?? "";
          const fields = [o.shop, o.trade, categoryLabel, o.title, o.description ?? ""];
          return fields.some((f) => normalizeSearch(f).includes(searchQuery));
        }),
      );
    }
    if (category === null) return sortActiveOffersFirst(data);
    return sortActiveOffersFirst(data.filter((o) => o.category === category));
  }, [offersQuery.data, isSearching, searchQuery, category]);

  const filteredWithDistance = withComputedDistance(filtered, position);
  const visibleOffers = hasPosition
    ? filteredWithDistance.filter((o) => o.distanceKm <= radiusKm)
    : filteredWithDistance;

  const activeOffersCountBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of offersQuery.data ?? []) {
      if (o.kind === "evenement") continue;
      map.set(o.slug, (map.get(o.slug) ?? 0) + 1);
    }
    return map;
  }, [offersQuery.data]);

  const noticesQuery = useQuery({
    queryKey: ["infos-mairie-public", selectedVille?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Infos_Mairie")
        .select("id, titre, corps, type, date_info")
        .eq("ville_id", selectedVille?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PublicNotice[];
    },
    enabled: !!selectedVille,
  });

  const notices = noticesQuery.data ?? [];

  const bannerQuery = useQuery({
    queryKey: ["sponsor-banner", "top", selectedVille?.slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("image_url, target_url")
        .eq("city_slug", selectedVille?.slug)
        .eq("position", "top")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVille,
  });

  const bottomBannerQuery = useQuery({
    queryKey: ["sponsor-banner", "bottom", selectedVille?.slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("image_url, target_url")
        .eq("city_slug", selectedVille?.slug)
        .eq("position", "bottom")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVille,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Barre supérieure de recherche */}
      <section className="w-full overflow-hidden border-b border-border/60 bg-gradient-navy pb-8 pt-6 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="break-words font-display text-xl font-extrabold sm:text-2xl lg:text-3xl">
            {city
              ? `Les bons plans de ${city}, en direct de vos commerçants`
              : "Les bons plans de vos commerçants, en direct"}
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/70">
            Promos flash, arrivages du jour et informations officielles de la commune.
          </p>

          <div className="mt-3 sm:hidden">
            <RadiusSelector />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCityOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-xl bg-card px-3 py-3 text-left text-sm font-semibold text-foreground shadow-card"
              >
                <MapPin className="h-4 w-4 shrink-0 text-promo" />
                <span className="min-w-0 flex-1 truncate">{city || "Choisir une ville"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              {cityOpen ? (
                <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
                  <input
                    autoFocus
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder="Ville ou village…"
                    className="w-full border-b border-border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
                  />
                  <ul className="max-h-56 overflow-auto py-1">
                    {citySuggestions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVille(v);
                            setCityOpen(false);
                            setCityQuery("");
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-secondary"
                        >
                          {v.nom}
                        </button>
                      </li>
                    ))}
                    {villesQuery.isLoading ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">Chargement…</li>
                    ) : null}
                    {!villesQuery.isLoading && citySuggestions.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">Aucune commune</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                (document.activeElement as HTMLElement | null)?.blur();
                document
                  .getElementById("resultats")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex items-center gap-2 rounded-xl bg-card px-3 py-3 shadow-card"
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Boucherie, coiffeur, nom de commerce, mot-clé…"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </form>
          </div>
        </div>
      </section>

      {/* Bannière sponsorisée par commune : bannière-modèle tant qu'aucune vraie pub n'est configurée */}
      <SponsorBanner banner={bannerQuery.data} />

      {/* Onglets catégories : juste sous la barre de recherche */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              category === null
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            Tous
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory((prev) => (prev === c.key ? null : c.key))}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                category === c.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {category === null
            ? "Tous les commerces, toutes catégories confondues."
            : CATEGORIES.find((c) => c.key === category)?.sub.join(" · ")}
          {hasPosition ? ` · Dans un rayon de ${radiusKm} km autour de vous` : ""}
        </p>
      </section>

      {isSearching ? (
        /* Résultats de recherche : remplace tout le reste de la page, juste sous la barre */
        <section id="resultats" className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-extrabold text-foreground">
              Résultats pour « {query.trim()} »
            </h2>
            <span className="rounded-full bg-promo/10 px-2 py-1 text-[11px] font-bold uppercase text-promo">
              {visibleOffers.length} résultat{visibleOffers.length > 1 ? "s" : ""}
            </span>
          </div>

          {offersQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
          ) : visibleOffers.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun commerce trouvé.</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Réinitialiser la recherche
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredFirst(visibleOffers).map((o) => (
                <OfferCard
                  key={o.id}
                  offer={o}
                  activeOffersCount={activeOffersCountBySlug.get(o.slug) ?? 1}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* À la une / sponsorisé */}
          <section className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-extrabold text-foreground">À la Une</h2>
              <span className="rounded-full bg-promo/10 px-2 py-1 text-[11px] font-bold uppercase text-promo">
                Nouveautés
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredFirst(sponsored).map((o) => (
                <OfferCard
                  key={o.id}
                  offer={o}
                  activeOffersCount={activeOffersCountBySlug.get(o.slug) ?? 1}
                />
              ))}
              {!featuredQuery.isLoading && sponsored.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune promo active pour le moment.</p>
              ) : null}
            </div>
          </section>

          {/* Liste des commerces de la catégorie sélectionnée */}
          <section className="mx-auto max-w-6xl px-4 pb-12">
            {category === "locale" && notices.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {notices.map((n) => (
                  <NoticeCard
                    key={n.id}
                    title={n.titre}
                    body={n.corps ?? ""}
                    date={n.date_info ?? ""}
                    type={n.type}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredFirst(visibleOffers).map((o) => (
                <OfferCard
                  key={o.id}
                  offer={o}
                  activeOffersCount={activeOffersCountBySlug.get(o.slug) ?? 1}
                />
              ))}
              {offersQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : null}
              {!offersQuery.isLoading &&
              visibleOffers.length === 0 &&
              !(category === "locale" && notices.length > 0) ? (
                <p className="col-span-full text-sm text-muted-foreground">
                  {category === null
                    ? hasPosition
                      ? `Aucun commerce à moins de ${radiusKm} km à ${city}.`
                      : `Aucun commerce à ${city} pour le moment.`
                    : "Aucun commerce dans cette catégorie pour le moment."}
                </p>
              ) : null}
            </div>
          </section>
        </>
      )}

      {/* Bloc Mairie */}
      <section className="border-t border-border/60 bg-card py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-5 w-5 shrink-0 text-mairie" />
            <h2 className="truncate font-display text-xl font-extrabold text-foreground">
              Mairie & Événements — {city}
            </h2>
            <span className="ml-auto shrink-0 rounded-full bg-mairie px-2 py-1 text-[11px] font-bold uppercase text-mairie-foreground">
              Info Officielle
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {notices.map((n) => (
              <NoticeCard
                key={n.id}
                title={n.titre}
                body={n.corps ?? ""}
                date={n.date_info ?? ""}
                type={n.type}
              />
            ))}
            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas d'information municipale publiée pour le moment.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Bannière sponsorisée : deuxième emplacement, tout en bas juste au-dessus du footer */}
      <BottomSponsorBanner banner={bottomBannerQuery.data} />

      <footer className="bg-gradient-navy py-8 text-center text-sm text-primary-foreground/70">
        PlaceDuCoin — le commerce local, à portée de rue.
      </footer>
    </div>
  );
}

function NoticeCard({
  title,
  body,
  date,
  type,
}: {
  title: string;
  body: string;
  date: string;
  type: string;
}) {
  return (
    <article className="surface-card border-l-4 border-l-mairie p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 shrink-0 text-mairie" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-mairie">{type}</span>
        <span className="ml-auto text-xs text-muted-foreground">{date}</span>
      </div>
      <h3 className="mt-2 text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </article>
  );
}
