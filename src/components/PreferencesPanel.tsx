import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, BellRing, BellOff, MailCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, type CategoryKey } from "@/lib/placeducoin-data";
import { useUserPrefs } from "@/lib/user-prefs";
import { supabase } from "@/lib/supabase";

const PREFERENCE_CATEGORIES = CATEGORIES.filter((c) => c.key !== "locale");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\s.-]{6,}$/;

export function PreferencesPanel() {
  const [open, setOpen] = useState(false);
  const { favoriteCategories, toggleCategory, pushPermission, requestPushPermission } =
    useUserPrefs();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [villeId, setVilleId] = useState("");
  const [saving, setSaving] = useState(false);

  const villesQuery = useQuery({
    queryKey: ["villes-signup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("villes").select("id, nom").order("nom");
      if (error) throw error;
      return data as { id: string; nom: string }[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const saveSignup = async () => {
    if (!nom.trim()) {
      toast.error("Entre ton nom.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      toast.error("Entre un e-mail valide.");
      return;
    }
    if (telephone.trim() && !PHONE_RE.test(telephone.trim())) {
      toast.error("Le numéro de téléphone n'est pas valide.");
      return;
    }
    if (!villeId) {
      toast.error("Choisis ta commune.");
      return;
    }

    const categories: CategoryKey[] =
      favoriteCategories.length > 0
        ? [...favoriteCategories, "locale"]
        : CATEGORIES.map((c) => c.key);

    setSaving(true);
    const { error } = await supabase.from("alert_subscriptions").insert({
      nom: nom.trim(),
      email: email.trim(),
      telephone: telephone.trim() || null,
      ville_id: villeId,
      categories,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("C'est noté, tu recevras les alertes des commerces et de la mairie.");
    setNom("");
    setEmail("");
    setTelephone("");
    setVilleId("");
  };

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
          <h3 className="text-sm font-semibold text-foreground">Inscription aux alertes</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Reçois les alertes des commerces et de la mairie de ta commune pour les catégories
            choisies ci-dessus, même hors ligne.
          </p>
          <form
            className="mt-3 space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void saveSignup();
            }}
          >
            <Input
              type="text"
              placeholder="Nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              disabled={saving}
              aria-label="Nom"
            />
            <Input
              type="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              aria-label="E-mail"
            />
            <Input
              type="tel"
              placeholder="06 12 34 56 78 (optionnel)"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              disabled={saving}
              aria-label="Téléphone"
            />
            <Select value={villeId} onValueChange={setVilleId} disabled={saving}>
              <SelectTrigger aria-label="Commune">
                <SelectValue placeholder="Ta commune" />
              </SelectTrigger>
              <SelectContent>
                {villesQuery.data?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="w-full" disabled={saving}>
              <MailCheck className="h-3.5 w-3.5" /> Enregistrer
            </Button>
          </form>
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
