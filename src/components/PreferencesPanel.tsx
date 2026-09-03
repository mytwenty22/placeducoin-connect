import { useState } from "react";
import { Settings, BellRing, BellOff } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIES } from "@/lib/placeducoin-data";
import { useUserPrefs } from "@/lib/user-prefs";

const PREFERENCE_CATEGORIES = CATEGORIES.filter((c) => c.key !== "locale");

export function PreferencesPanel() {
  const [open, setOpen] = useState(false);
  const { favoriteCategories, toggleCategory, pushPermission, requestPushPermission } =
    useUserPrefs();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Settings className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Mes préférences</SheetTitle>
          <SheetDescription>
            Reçois une alerte uniquement pour les offres en vedette qui t'intéressent.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground">Catégories préférées</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Aucune sélection = toutes les catégories.
          </p>
          <div className="mt-3 space-y-3">
            {PREFERENCE_CATEGORIES.map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
              >
                <Checkbox
                  checked={favoriteCategories.includes(c.key)}
                  onCheckedChange={() => toggleCategory(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Notifications du navigateur</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {pushPermission === "granted"
              ? "Activées sur cet appareil."
              : pushPermission === "denied"
                ? "Refusées — modifie-le dans les réglages du navigateur."
                : pushPermission === "unsupported"
                  ? "Non prises en charge par ce navigateur."
                  : "Pas encore activées."}
          </p>
          {pushPermission === "granted" ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <BellRing className="h-3.5 w-3.5" /> Notifications activées
            </p>
          ) : pushPermission === "unsupported" ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <BellOff className="h-3.5 w-3.5" /> Indisponible
            </p>
          ) : (
            <button
              type="button"
              onClick={requestPushPermission}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-navy-soft"
            >
              <BellRing className="h-3.5 w-3.5" /> Activer les notifications
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
