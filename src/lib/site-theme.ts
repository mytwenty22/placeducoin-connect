/**
 * Charte unique des Site Pro (/site/$slug) et des cartes de la marketplace, identique pour tous les
 * commerces : fond de page clair, en-tête ardoise, blocs blancs aux contours doux, accents
 * SpotLocal. À modifier ici seulement, jamais commerce par commerce. L'ancien choix « Style du
 * site » (colonne commerces.theme_visuel) est conservé en base mais n'a plus d'effet.
 */
export const PRO_CHARTE = {
  /** En-tête du site (sous la photo de couverture sur mobile). */
  headerBg: "bg-[#1e293b]",
  pageBg: "bg-slate-50",
  /** Tous les blocs : même rayon, même bordure discrète, même ombre légère. */
  cardClass:
    "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]",
  heading: "text-slate-900",
  muted: "text-slate-500",
  divider: "border-slate-200/80",
  /** Bouton d'action principal (Appeler). */
  primaryButton: "bg-promo text-promo-foreground",
  /** Bouton secondaire sur l'en-tête sombre (Itinéraire, Favori). */
  headerButton: "border-2 border-white/25 bg-white/5 text-white hover:bg-white/10",
} as const;
