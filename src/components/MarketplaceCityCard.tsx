import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CitySelect } from "@/components/CitySelect";
import { useAllQuartiers, useSelectedVille } from "@/hooks/use-villes";

// Ville de la Marketplace depuis l'Espace Pro : même préférence que le menu de l'accueil (choix
// mémorisé, sinon la ville du commerce). Le commerçant peut consulter les bons plans de n'importe
// quelle commune, d'un code postal ou d'un quartier, pas seulement les siens.
export function MarketplaceCityCard() {
  const { villes, villesLoading, ville, quartierId, codePostal, chooseOption } = useSelectedVille();
  const quartiersQuery = useAllQuartiers();
  const quartierNom = quartiersQuery.data?.find((q) => q.id === quartierId)?.nom ?? null;
  const detail = codePostal ?? quartierNom;
  const zone = ville ? `${ville.nom}${detail ? ` ${detail}` : ""}` : null;

  return (
    <section className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-foreground">Bons plans de la Marketplace</h2>
        <p className="text-xs text-muted-foreground">
          Choisissez une commune, un code postal ou un quartier.
        </p>
      </div>
      <CitySelect
        villes={villes}
        loading={villesLoading}
        selected={ville}
        selectedDetail={detail}
        onChoose={chooseOption}
        className="sm:w-64"
        buttonClassName="border border-border py-2.5 shadow-none"
      />
      <Link
        to="/"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Voir {zone ? `les bons plans de ${zone}` : "les bons plans"}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
