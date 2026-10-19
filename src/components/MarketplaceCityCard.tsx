import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CitySelect } from "@/components/CitySelect";
import { useSelectedVille } from "@/hooks/use-villes";

// Ville de la Marketplace depuis l'Espace Pro : même préférence que le menu de l'accueil (choix
// mémorisé, sinon la ville du commerce). Le commerçant peut consulter les bons plans de n'importe
// quelle commune, pas seulement la sienne.
export function MarketplaceCityCard() {
  const { villes, villesLoading, ville, selectVille } = useSelectedVille();

  return (
    <section className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-foreground">Bons plans de la Marketplace</h2>
        <p className="text-xs text-muted-foreground">
          Choisissez la commune affichée sur la Marketplace.
        </p>
      </div>
      <CitySelect
        villes={villes}
        loading={villesLoading}
        selected={ville}
        onSelect={(v) => selectVille(v.id)}
        className="sm:w-56"
        buttonClassName="border border-border py-2.5 shadow-none"
      />
      <Link
        to="/"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Voir {ville ? `les bons plans de ${ville.nom}` : "les bons plans"}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
