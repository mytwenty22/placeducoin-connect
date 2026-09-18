// L'option Vedette dure 24h : un commerce reste boosté tant que boost_actif est vrai ET que
// boost_expires_at n'est pas dépassé. Partagé entre la marketplace (affichage) et l'espace Pro
// (statut du bouton "Annuler") pour que les deux ne divergent jamais sur ce qui compte comme actif.
export function isBoostActive(commerce: {
  boost_actif: boolean;
  boost_expires_at: string | null;
}): boolean {
  if (!commerce.boost_actif) return false;
  if (!commerce.boost_expires_at) return true;
  return new Date(commerce.boost_expires_at).getTime() > Date.now();
}
