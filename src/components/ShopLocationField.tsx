import { useState } from "react";
import { Crosshair, Loader2, MapPin, MapPinned } from "lucide-react";
import { toast } from "sonner";
import {
  GeoPositionError,
  getCurrentPositionOnce,
  positionErrorMessage,
  type LatLng,
} from "@/lib/geo";
import { geocodeAddress } from "@/lib/geocode";
import { supabase } from "@/lib/supabase";

// Une position enregistrée depuis la boutique doit être fiable : au-delà de cette précision (GPS
// pas verrouillé, position "réseau" d'un ordinateur) on la refuse plutôt que de fausser le rayon
// de 100 m des clients.
const MAX_ACCURACY_M = 50;

/**
 * Position GPS de la boutique, centre du rayon de 100 m utilisé pour valider l'activation d'une
 * promo en caisse. Enregistrée immédiatement (indépendamment du bouton « Enregistrer » du profil).
 */
export function ShopLocationField({
  commerceId,
  adresse,
  codePostal,
  latitude,
  longitude,
  onUpdated,
}: {
  commerceId: string;
  adresse: string;
  codePostal: string;
  latitude: number | null;
  longitude: number | null;
  onUpdated: () => void;
}) {
  const [pending, setPending] = useState<"gps" | "address" | null>(null);

  async function save(position: LatLng) {
    const { error } = await supabase
      .from("commerces")
      .update({ latitude: position.lat, longitude: position.lng })
      .eq("id", commerceId);
    if (error) throw new Error(error.message);
    onUpdated();
  }

  async function saveCurrentPosition() {
    setPending("gps");
    try {
      const position = await getCurrentPositionOnce();
      if (position.accuracyM > MAX_ACCURACY_M) {
        toast.error(
          `Position trop imprécise (± ${Math.round(position.accuracyM)} m). Placez-vous près d'une fenêtre, activez le GPS de votre téléphone et réessayez.`,
        );
        return;
      }
      await save(position);
      toast.success("Position de la boutique enregistrée.");
    } catch (error) {
      toast.error(
        error instanceof GeoPositionError
          ? positionErrorMessage(error.kind)
          : (error as Error).message,
      );
    } finally {
      setPending(null);
    }
  }

  async function saveFromAddress() {
    if (!adresse.trim()) {
      toast.error("Renseignez d'abord l'adresse de la boutique.");
      return;
    }
    setPending("address");
    try {
      const position = await geocodeAddress(adresse, codePostal);
      if (!position) {
        toast.error(
          "Adresse introuvable avec assez de précision. Vérifiez le numéro, la rue et le code postal, ou utilisez votre position actuelle depuis la boutique.",
        );
        return;
      }
      await save(position);
      toast.success("Position de la boutique déduite de votre adresse.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Position GPS de la boutique
      </span>
      <div className="mt-1 rounded-xl border border-input bg-card p-3">
        <p className="flex items-center gap-2 text-sm">
          {latitude !== null && longitude !== null ? (
            <>
              <MapPinned className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium text-foreground">
                Position enregistrée ({latitude.toFixed(5)}, {longitude.toFixed(5)})
              </span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=19/${latitude}/${longitude}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto shrink-0 text-xs font-semibold text-navy hover:underline"
              >
                Vérifier
              </a>
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 shrink-0 text-promo" />
              <span className="font-medium text-foreground">Position non renseignée</span>
            </>
          )}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Nécessaire au bouton « Profiter de cette offre en caisse » : vos clients doivent se
          trouver à moins de 100 m de ce point pour activer une promo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void saveCurrentPosition()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-navy-soft disabled:opacity-60"
          >
            {pending === "gps" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            Utiliser ma position actuelle (depuis la boutique)
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void saveFromAddress()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
          >
            {pending === "address" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Déduire de mon adresse
          </button>
        </div>
      </div>
    </div>
  );
}
