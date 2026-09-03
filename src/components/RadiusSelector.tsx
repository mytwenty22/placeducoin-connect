import { MapPin, Loader2 } from "lucide-react";
import { useUserPrefs, RADIUS_OPTIONS } from "@/lib/user-prefs";

export function RadiusSelector() {
  const { radiusKm, setRadiusKm, geoStatus, requestLocation } = useUserPrefs();

  const handleSelect = (km: number) => {
    setRadiusKm(km);
    if (geoStatus === "idle" || geoStatus === "denied" || geoStatus === "error") {
      requestLocation();
    }
  };

  const title =
    geoStatus === "denied"
      ? "Localisation refusée — autorise-la dans les réglages du navigateur"
      : geoStatus === "granted"
        ? "Offres filtrées autour de ta position"
        : "Filtrer les offres autour de ma position";

  return (
    <div
      className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-1.5 py-1"
      title={title}
    >
      {geoStatus === "locating" ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-foreground/70" />
      ) : (
        <MapPin
          className={`h-3.5 w-3.5 shrink-0 ${
            geoStatus === "granted" ? "text-emerald-300" : "text-primary-foreground/50"
          }`}
        />
      )}
      {RADIUS_OPTIONS.map((km) => (
        <button
          key={km}
          type="button"
          onClick={() => handleSelect(km)}
          className={`rounded-full px-2 py-1 text-xs font-semibold transition-colors ${
            radiusKm === km
              ? "bg-promo text-promo-foreground"
              : "text-primary-foreground/70 hover:bg-primary-foreground/10"
          }`}
        >
          {km} km
        </button>
      ))}
    </div>
  );
}
