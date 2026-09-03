import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unsupported" | "error";

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        setError(err.message);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (!("permissions" in navigator) || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") requestLocation();
        result.onchange = () => {
          if (result.state === "denied") setStatus("denied");
        };
      })
      .catch(() => {
        // Certains navigateurs ne supportent pas Permissions.query("geolocation") :
        // l'utilisateur devra alors déclencher la demande manuellement.
      });
  }, [requestLocation]);

  return { status, position, error, requestLocation };
}
