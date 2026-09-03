import { createContext, useContext, useState, type ReactNode } from "react";
import type { CategoryKey } from "@/lib/placeducoin-data";
import { useGeolocation, type GeoStatus } from "@/hooks/use-geolocation";
import type { LatLng } from "@/lib/geo";

const RADIUS_KEY = "pdc:radiusKm";
const CATEGORIES_KEY = "pdc:favoriteCategories";

export const RADIUS_OPTIONS = [2, 5, 10] as const;

function readRadius(): number {
  if (typeof window === "undefined") return 5;
  const raw = Number(window.localStorage.getItem(RADIUS_KEY));
  return (RADIUS_OPTIONS as readonly number[]).includes(raw) ? raw : 5;
}

function readFavoriteCategories(): CategoryKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CATEGORIES_KEY);
    return raw ? (JSON.parse(raw) as CategoryKey[]) : [];
  } catch {
    return [];
  }
}

type PushPermission = "default" | "granted" | "denied" | "unsupported";

type UserPrefsContextValue = {
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  favoriteCategories: CategoryKey[];
  toggleCategory: (key: CategoryKey) => void;
  geoStatus: GeoStatus;
  position: LatLng | null;
  geoError: string | null;
  requestLocation: () => void;
  pushPermission: PushPermission;
  requestPushPermission: () => void;
};

const UserPrefsContext = createContext<UserPrefsContextValue | null>(null);

export function UserPrefsProvider({ children }: { children: ReactNode }) {
  const [radiusKm, setRadiusKmState] = useState<number>(() => readRadius());
  const [favoriteCategories, setFavoriteCategories] = useState<CategoryKey[]>(() =>
    readFavoriteCategories(),
  );
  const [pushPermission, setPushPermission] = useState<PushPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });
  const { status: geoStatus, position, error: geoError, requestLocation } = useGeolocation();

  const setRadiusKm = (km: number) => {
    setRadiusKmState(km);
    if (typeof window !== "undefined") window.localStorage.setItem(RADIUS_KEY, String(km));
  };

  const toggleCategory = (key: CategoryKey) => {
    setFavoriteCategories((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const requestPushPermission = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushPermission("unsupported");
      return;
    }
    Notification.requestPermission().then((permission) => {
      setPushPermission(permission as PushPermission);
    });
  };

  return (
    <UserPrefsContext.Provider
      value={{
        radiusKm,
        setRadiusKm,
        favoriteCategories,
        toggleCategory,
        geoStatus,
        position,
        geoError,
        requestLocation,
        pushPermission,
        requestPushPermission,
      }}
    >
      {children}
    </UserPrefsContext.Provider>
  );
}

export function useUserPrefs(): UserPrefsContextValue {
  const ctx = useContext(UserPrefsContext);
  if (!ctx) throw new Error("useUserPrefs must be used within UserPrefsProvider");
  return ctx;
}
