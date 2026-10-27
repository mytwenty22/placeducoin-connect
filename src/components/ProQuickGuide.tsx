import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  MapPin,
  PlayCircle,
  Store,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DEMO_VIDEOS, DemoVideos } from "@/components/DemoVideos";

type GuideCommerce = {
  id: string;
  slug: string;
  photo_url: string | null;
  logo_url: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  site_actif: boolean;
};

/**
 * Carte "Guide Rapide & Tutoriels" du tableau de bord /pro : une vidéo et 3 étapes pour publier sa
 * première annonce en 2 minutes. Chaque étape se coche d'elle-même quand elle est faite ; la carte
 * se replie (choix mémorisé sur l'appareil) et se replie d'office une fois les étapes faites.
 */
export function ProQuickGuide({
  commerce,
  isAssociation,
  onNavigate,
}: {
  commerce: GuideCommerce;
  isAssociation: boolean;
  onNavigate: (screen: "profil" | "promo") => void;
}) {
  const storageKey = `spotlocal:pro-guide-collapsed:${commerce.id}`;
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  // Sous la clé ["promos", id] : PromoScreen l'invalide après chaque publication.
  const promoCountQuery = useQuery({
    queryKey: ["promos", commerce.id, "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("promos")
        .select("id", { count: "exact", head: true })
        .eq("commerce_id", commerce.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Sans position GPS, la fiche n'apparaît pas sur la carte de l'accueil et les clients ne peuvent
  // pas valider leurs coupons sur place : l'étape 1 n'est cochée qu'une fois la position posée.
  const hasLocation = commerce.latitude != null && commerce.longitude != null;
  const profileDone = Boolean(
    (commerce.photo_url || commerce.logo_url) && commerce.description && hasLocation,
  );

  function goToLocation() {
    onNavigate("profil");
    // Laisse l'écran Mon Profil se monter avant de faire défiler jusqu'au champ.
    window.setTimeout(() => {
      document
        .getElementById("shop-location")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }
  const publishDone = (promoCountQuery.data ?? 0) > 0;
  const allDone = profileDone && publishDone;

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      // Stockage indisponible : on se base sur l'avancement.
    }
    setCollapsed(stored === null ? null : stored === "1");
  }, [storageKey]);

  const isCollapsed = collapsed ?? (promoCountQuery.isSuccess && allDone);

  function toggle() {
    const next = !isCollapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // Le choix ne sera simplement pas mémorisé.
    }
  }

  const doneCount = Number(profileDone) + Number(publishDone);
  const announce = isAssociation ? "votre premier événement" : "votre première offre";

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="pro-guide-title">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!isCollapsed}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-promo/10 text-promo">
          <PlayCircle className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            id="pro-guide-title"
            className="block font-display text-lg font-extrabold leading-tight text-foreground"
          >
            Guide Rapide & Tutoriels
          </span>
          <span className="block text-xs text-muted-foreground">
            {allDone
              ? "Bravo, votre fiche est en ligne avec une annonce !"
              : `Publiez ${announce} en 2 minutes · ${doneCount}/2 fait`}
          </span>
        </span>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Rappel affiché même carte repliée : c'est l'oubli le plus pénalisant. */}
      {!hasLocation ? (
        <div className="mx-4 mb-4 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 sm:flex-row sm:items-center">
          <MapPin className="hidden h-5 w-5 shrink-0 text-amber-600 sm:block" />
          <p className="min-w-0 flex-1 text-xs leading-snug">
            <strong>Position GPS non renseignée.</strong> Votre{" "}
            {isAssociation ? "association" : "boutique"} n'apparaît pas sur la carte de l'accueil et
            vos clients ne peuvent pas valider leurs coupons sur place.
          </p>
          <button
            type="button"
            onClick={goToLocation}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
          >
            <MapPin className="h-3.5 w-3.5" /> Renseigner ma position
          </button>
        </div>
      ) : null}

      {!isCollapsed ? (
        <div className="grid gap-4 border-t border-border p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {DEMO_VIDEOS.length > 0 ? (
            <DemoVideos />
          ) : (
            <div className="aspect-video overflow-hidden rounded-xl bg-gradient-navy">
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-primary-foreground">
                <PlayCircle className="h-10 w-10 opacity-80" />
                <p className="text-sm font-bold">Vidéo tutoriel bientôt disponible</p>
                <p className="text-xs text-primary-foreground/70">
                  En attendant, suivez les 3 étapes ci-contre.
                </p>
              </div>
            </div>
          )}

          <ol className="space-y-3">
            <GuideStep
              n={1}
              done={profileDone}
              title="Complétez votre fiche"
              text={
                hasLocation
                  ? "Photo ou logo, description, horaires et position de la boutique."
                  : "Photo ou logo, description, horaires — et surtout la position GPS de la boutique."
              }
              action={
                <StepButton onClick={hasLocation ? () => onNavigate("profil") : goToLocation}>
                  {hasLocation ? (
                    <Store className="h-3.5 w-3.5" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}{" "}
                  {hasLocation ? "Mon Profil" : "Ma position GPS"}
                </StepButton>
              }
            />
            <GuideStep
              n={2}
              done={publishDone}
              title={isAssociation ? "Publiez un événement" : "Publiez une offre flash"}
              text={
                isAssociation
                  ? "Un titre, la date et l'heure : les habitants abonnés sont prévenus."
                  : "Un titre accrocheur, le prix avant/après et la durée : c'est en ligne aussitôt."
              }
              action={
                <StepButton onClick={() => onNavigate("promo")}>
                  <Zap className="h-3.5 w-3.5" />{" "}
                  {isAssociation ? "Événement Flash" : "Promo Flash"}
                </StepButton>
              }
            />
            <GuideStep
              n={3}
              title="Vérifiez votre page"
              text="Voyez votre fiche comme vos clients, puis imprimez votre affiche vitrine (bouton plus haut)."
              action={
                commerce.site_actif ? (
                  <StepLink to="/site/$slug" slug={commerce.slug} />
                ) : (
                  <StepLink to="/commerce/$slug" slug={commerce.slug} />
                )
              }
            />
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function GuideStep({
  n,
  done = false,
  title,
  text,
  action,
}: {
  n: number;
  done?: boolean;
  title: string;
  text: string;
  action: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-label="Fait" />
      ) : (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-promo text-xs font-bold text-promo-foreground">
          {n}
        </span>
      )}
      <div className="min-w-0">
        <p
          className={`text-sm font-bold ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{text}</p>
        <div className="mt-1.5">{action}</div>
      </div>
    </li>
  );
}

function StepButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/70"
    >
      {children}
    </button>
  );
}

function StepLink({ to, slug }: { to: "/site/$slug" | "/commerce/$slug"; slug: string }) {
  return (
    <Link
      to={to}
      params={{ slug }}
      target="_blank"
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/70"
    >
      <Eye className="h-3.5 w-3.5" /> Voir ma page
    </Link>
  );
}
