import { useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { DemoVideos } from "@/components/DemoVideos";
import { CLIENT_DEMO_VIDEO, embeddableVideos } from "@/lib/video-embed";

/**
 * Carte "Découvrir le fonctionnement en 30 sec" : la vidéo de première connexion client. Toujours
 * affichée sur /compte ; sur les fiches commerce, voir PosterClientDemoCard.
 */
export function ClientDemoCard({ onDismiss }: { onDismiss?: () => void }) {
  if (embeddableVideos([CLIENT_DEMO_VIDEO]).length === 0) return null;

  return (
    <section
      aria-labelledby="client-demo-title"
      className="relative rounded-2xl bg-navy p-5 text-primary-foreground shadow-lift"
    >
      {onDismiss ? (
        <button
          type="button"
          aria-label="Fermer"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-full p-1.5 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <PlayCircle className="mx-auto h-8 w-8 text-promo sm:mx-0" />
          <h2 id="client-demo-title" className="mt-2 font-display text-lg font-extrabold">
            Découvrir le fonctionnement en 30 sec
          </h2>
          <p className="mt-1 text-sm text-primary-foreground/70">
            Créez votre compte, enregistrez vos commerces favoris et activez leurs offres en caisse.
          </p>
        </div>
        <DemoVideos videos={[CLIENT_DEMO_VIDEO]} className="w-[200px] shrink-0" />
      </div>
    </section>
  );
}

/**
 * La même carte sur la fiche d'un commerce, pour les seuls visiteurs arrivés via le QR code de
 * l'affiche vitrine (`?app=1`) ; elle se ferme d'un clic.
 */
export function PosterClientDemoCard() {
  // Lecture de l'URL après le montage : le rendu serveur ne la connaît pas.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(new URLSearchParams(window.location.search).get("app") === "1");
  }, []);

  return visible ? <ClientDemoCard onDismiss={() => setVisible(false)} /> : null;
}
