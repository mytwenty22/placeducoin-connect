import type { ReactNode } from "react";
import { Compass, Ellipsis, MoreVertical, Plus, Share, SquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpotLocalMark } from "@/components/SpotLocalLogo";
import { confirmInstalledManually, type InstallPlatform } from "@/lib/pwa-install";

/**
 * Modale d'aide à l'installation quand l'invite native n'existe pas : iPhone/iPad (Partager >
 * Sur l'écran d'accueil), Android sans beforeinstallprompt (menu du navigateur), ou navigateur
 * intégré à une appli (à rouvrir d'abord dans Safari / Chrome).
 */
export function InstallGuideDialog({
  open,
  onOpenChange,
  platform,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: InstallPlatform;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto rounded-2xl">
        <DialogHeader className="items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-promo text-promo-foreground shadow-card">
            <SpotLocalMark className="h-9 w-9" />
          </span>
          <DialogTitle className="font-display text-xl">Installer SpotLocal</DialogTitle>
          <DialogDescription>
            {platform === "in-app"
              ? "Cette page est ouverte dans une autre appli, qui ne permet pas l'installation."
              : "Ajoutez l'appli à votre écran d'accueil pour retrouver vos réductions en 1 clic."}
          </DialogDescription>
        </DialogHeader>

        {platform === "ios" ? (
          <ol className="space-y-3">
            <GuideStep n={1} visual={<ToolbarMock highlight={<Share className="h-5 w-5" />} />}>
              Touchez <strong>Partager</strong>{" "}
              <Share className="inline h-4 w-4 align-text-bottom" /> dans la barre de Safari.
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Vous ne le voyez pas ? Touchez d'abord{" "}
                <Ellipsis className="inline h-4 w-4 align-text-bottom" />.
              </span>
            </GuideStep>
            <GuideStep
              n={2}
              visual={
                <MenuRowMock
                  icon={<SquarePlus className="h-4 w-4" />}
                  label="Sur l'écran d'accueil"
                />
              }
            >
              Faites défiler et choisissez <strong>Sur l'écran d'accueil</strong>.
            </GuideStep>
            <GuideStep n={3} visual={<AddButtonMock />}>
              Validez avec <strong>Ajouter</strong>, en haut à droite.
            </GuideStep>
          </ol>
        ) : platform === "android" ? (
          <ol className="space-y-3">
            <GuideStep
              n={1}
              visual={<ToolbarMock highlight={<MoreVertical className="h-5 w-5" />} />}
            >
              Ouvrez le menu <MoreVertical className="inline h-4 w-4 align-text-bottom" /> du
              navigateur, en haut à droite.
            </GuideStep>
            <GuideStep
              n={2}
              visual={
                <MenuRowMock icon={<Plus className="h-4 w-4" />} label="Installer l'application" />
              }
            >
              Touchez <strong>Installer l'application</strong> ou{" "}
              <strong>Ajouter à l'écran d'accueil</strong>.
            </GuideStep>
            <GuideStep n={3} visual={<AddButtonMock label="Installer" />}>
              Confirmez avec <strong>Installer</strong>.
            </GuideStep>
          </ol>
        ) : (
          <ol className="space-y-3">
            <GuideStep n={1} visual={<ToolbarMock highlight={<Ellipsis className="h-5 w-5" />} />}>
              Touchez le menu <Ellipsis className="inline h-4 w-4 align-text-bottom" /> ou{" "}
              <MoreVertical className="inline h-4 w-4 align-text-bottom" /> de l'appli.
            </GuideStep>
            <GuideStep
              n={2}
              visual={
                <MenuRowMock
                  icon={<Compass className="h-4 w-4" />}
                  label="Ouvrir dans le navigateur"
                />
              }
            >
              Choisissez <strong>Ouvrir dans Safari</strong> (ou dans le navigateur), puis touchez à
              nouveau <strong>Installer</strong>.
            </GuideStep>
          </ol>
        )}

        {platform !== "in-app" ? (
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.6rem] bg-gradient-promo text-promo-foreground">
              <SpotLocalMark className="h-6 w-6" />
            </span>
            <p className="text-xs text-muted-foreground">
              L'icône <strong className="text-foreground">SpotLocal</strong> apparaît ensuite sur
              votre écran d'accueil, comme une appli.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (platform !== "in-app") confirmInstalledManually();
            onOpenChange(false);
          }}
          className="w-full rounded-xl bg-gradient-promo py-3 text-sm font-bold text-promo-foreground hover:opacity-90"
        >
          {platform === "in-app" ? "J'ai compris" : "C'est fait"}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function GuideStep({ n, visual, children }: { n: number; visual: ReactNode; children: ReactNode }) {
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-promo text-xs font-bold text-promo-foreground">
          {n}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug">{children}</p>
      </div>
      <div className="mt-2.5 pl-9">{visual}</div>
    </li>
  );
}

// ── Mini-maquettes de l'interface du navigateur ─────────────────────────────────────────────

function ToolbarMock({ highlight }: { highlight: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-muted-foreground">
      <span className="h-1.5 w-8 rounded-full bg-current opacity-30" />
      <span className="h-1.5 w-14 rounded-full bg-current opacity-30" />
      <span className="grid h-8 w-8 place-items-center rounded-full bg-background text-promo ring-2 ring-promo">
        {highlight}
      </span>
      <span className="h-1.5 w-8 rounded-full bg-current opacity-30" />
    </div>
  );
}

function MenuRowMock({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg bg-muted text-xs">
      <div className="px-3 py-1.5 text-muted-foreground opacity-60">Copier</div>
      <div className="flex items-center justify-between bg-background px-3 py-2 font-semibold ring-2 ring-inset ring-promo">
        {label}
        <span className="text-promo">{icon}</span>
      </div>
      <div className="px-3 py-1.5 text-muted-foreground opacity-60">Ajouter aux favoris</div>
    </div>
  );
}

function AddButtonMock({ label = "Ajouter" }: { label?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
      <span className="text-muted-foreground">Annuler</span>
      <span className="rounded-md bg-background px-2 py-1 font-bold text-promo ring-2 ring-promo">
        {label}
      </span>
    </div>
  );
}
