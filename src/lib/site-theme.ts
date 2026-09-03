export type ThemeVisuel = "luxe_or" | "dark_spotify" | "artisanal" | "saas_bleu" | "neo_brasserie";

export const THEME_OPTIONS: { key: ThemeVisuel; label: string }[] = [
  { key: "luxe_or", label: "Luxe Or" },
  { key: "dark_spotify", label: "Dark Spotify" },
  { key: "artisanal", label: "Artisanal" },
  { key: "saas_bleu", label: "SaaS Bleu" },
  { key: "neo_brasserie", label: "Néo-Brasserie" },
];

export const THEME_STYLES: Record<
  ThemeVisuel,
  {
    /** Couleur réelle de la marque : fond du grand bandeau héros. */
    bandColor: string;
    /** Couleur d'accent pour les prix / libellés mis en avant dans les cartes. */
    priceColor: string;
    pageBg: string;
    cardClass: string;
    heading: string;
    muted: string;
    divider: string;
    /** Fond sombre : sert à adapter les petits badges (ex. décompte) qui ne
     * suivent pas déjà heading/muted. */
    isDark: boolean;
  }
> = {
  luxe_or: {
    bandColor: "#111111",
    priceColor: "#D4AF37",
    pageBg: "bg-neutral-950",
    cardClass: "bg-neutral-900 border border-[#D4AF37]/20 shadow-lg rounded-2xl",
    heading: "text-white",
    muted: "text-neutral-400",
    divider: "border-neutral-800",
    isDark: true,
  },
  dark_spotify: {
    bandColor: "#1DB954",
    priceColor: "#1DB954",
    pageBg: "bg-[#121212]",
    cardClass: "bg-neutral-900 border border-neutral-800 shadow-lg rounded-2xl",
    heading: "text-white",
    muted: "text-neutral-400",
    divider: "border-neutral-800",
    isDark: true,
  },
  artisanal: {
    bandColor: "#C85A32",
    priceColor: "#C85A32",
    pageBg: "bg-amber-50",
    cardClass: "bg-white border border-amber-100 shadow-sm rounded-2xl",
    heading: "text-amber-950",
    muted: "text-amber-900/60",
    divider: "border-amber-100",
    isDark: false,
  },
  saas_bleu: {
    bandColor: "#2563EB",
    priceColor: "#2563EB",
    pageBg: "bg-slate-50",
    cardClass: "bg-white border border-slate-200 shadow-sm rounded-2xl",
    heading: "text-slate-900",
    muted: "text-slate-500",
    divider: "border-slate-200",
    isDark: false,
  },
  neo_brasserie: {
    bandColor: "#7A1C2E",
    priceColor: "#C8385A",
    pageBg: "bg-stone-950",
    cardClass: "bg-stone-900 border border-[#7A1C2E]/30 shadow-lg rounded-2xl",
    heading: "text-white",
    muted: "text-stone-400",
    divider: "border-stone-800",
    isDark: true,
  },
};

export const DEFAULT_THEME: ThemeVisuel = "saas_bleu";
