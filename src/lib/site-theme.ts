import type { CSSProperties } from "react";

/**
 * Couleurs choisies par le commerçant (Espace Pro → Mon profil → Couleurs de la fiche), stockées
 * dans commerces.theme_visuel. Les clés restent celles autorisées par la contrainte en base
 * (20260830135030_site_theme_five_presets.sql).
 *
 * Chaque thème est une palette complète : fond de page, fond des blocs, bordures, textes et accent
 * vont ensemble. Un thème sombre a donc des blocs sombres (jamais de bloc blanc sur fond noir).
 */
export type ThemeVisuel = "saas_bleu" | "artisanal" | "luxe_or" | "dark_spotify" | "neo_brasserie";

type SiteTheme = {
  label: string;
  isDark: boolean;
  /** Bandeau d'en-tête (fiche gratuite, aperçu, carte marketplace) et héros sans photo. Toujours
   * assez foncé pour du texte blanc. */
  band: string;
  /** Accent lisible sur fond clair : prix et liens de la fiche gratuite et de la carte. */
  accentOnLight: string;
  /** Titres du Site Pro en serif (thèmes chaleureux / luxe) ou en grotesque (thèmes modernes). */
  serif: boolean;
  /** Palette complète du Site Pro, exposée en variables CSS --st-*. */
  palette: {
    bg: string;
    surface: string;
    surface2: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accentFg: string;
  };
};

export const SITE_THEMES: Record<ThemeVisuel, SiteTheme> = {
  saas_bleu: {
    label: "Bleu Océan",
    isDark: false,
    band: "linear-gradient(135deg, #0f1e4a 0%, #1d3fa8 55%, #2f6bff 100%)",
    accentOnLight: "#2563eb",
    serif: false,
    palette: {
      bg: "#f5f7fb",
      surface: "#ffffff",
      surface2: "#edf1f7",
      border: "rgba(15, 23, 42, 0.08)",
      text: "#0b1324",
      muted: "#5b6578",
      accent: "#2563eb",
      accentFg: "#ffffff",
    },
  },
  artisanal: {
    label: "Terracotta",
    isDark: false,
    band: "linear-gradient(135deg, #3b1a0c 0%, #7a3418 50%, #c2562f 100%)",
    accentOnLight: "#b44d29",
    serif: true,
    palette: {
      bg: "#f8f3ec",
      surface: "#fffdf9",
      surface2: "#f1e8dc",
      border: "rgba(92, 52, 26, 0.12)",
      text: "#2a1810",
      muted: "#7a6556",
      accent: "#b44d29",
      accentFg: "#ffffff",
    },
  },
  luxe_or: {
    label: "Noir & Or",
    isDark: true,
    band: "linear-gradient(135deg, #0b0b0c 0%, #1c1a15 55%, #3a2f12 100%)",
    accentOnLight: "#9a7b1c",
    serif: true,
    palette: {
      bg: "#0b0b0c",
      surface: "#151517",
      surface2: "#1e1e21",
      border: "rgba(212, 175, 55, 0.16)",
      text: "#f5f1e6",
      muted: "#a39e92",
      accent: "#d4af37",
      accentFg: "#171204",
    },
  },
  dark_spotify: {
    label: "Vert Nuit",
    isDark: true,
    band: "linear-gradient(135deg, #07110b 0%, #0b2a17 55%, #11683a 100%)",
    accentOnLight: "#15803d",
    serif: false,
    palette: {
      bg: "#0c110e",
      surface: "#141b17",
      surface2: "#1c2520",
      border: "rgba(255, 255, 255, 0.08)",
      text: "#eff5f1",
      muted: "#93a39a",
      accent: "#1ed760",
      accentFg: "#04140a",
    },
  },
  neo_brasserie: {
    label: "Bordeaux",
    isDark: true,
    band: "linear-gradient(135deg, #1a080d 0%, #4a1221 55%, #7a1c2e 100%)",
    accentOnLight: "#9f1d3a",
    serif: true,
    palette: {
      bg: "#130a0c",
      surface: "#1d1114",
      surface2: "#28181c",
      border: "rgba(226, 98, 127, 0.16)",
      text: "#f8eef0",
      muted: "#b49ba1",
      accent: "#e05a7a",
      accentFg: "#1a0508",
    },
  },
};

export const THEME_KEYS = Object.keys(SITE_THEMES) as ThemeVisuel[];

export const DEFAULT_THEME: ThemeVisuel = "saas_bleu";

export function getSiteTheme(key: string | null | undefined): SiteTheme {
  return SITE_THEMES[(key ?? "") as ThemeVisuel] ?? SITE_THEMES[DEFAULT_THEME];
}

/** Variables CSS --st-* du Site Pro, à poser sur la racine de la page (et sur les fenêtres
 * rendues hors de la page, comme la fiche produit). */
export function siteThemeVars(theme: SiteTheme): CSSProperties {
  const p = theme.palette;
  return {
    "--st-bg": p.bg,
    "--st-surface": p.surface,
    "--st-surface-2": p.surface2,
    "--st-border": p.border,
    "--st-text": p.text,
    "--st-muted": p.muted,
    "--st-accent": p.accent,
    "--st-accent-fg": p.accentFg,
    "--st-band": theme.band,
    "--st-font-display": theme.serif
      ? '"Fraunces", Georgia, serif'
      : '"Bricolage Grotesque", "Segoe UI", sans-serif',
    colorScheme: theme.isDark ? "dark" : "light",
  } as CSSProperties;
}
