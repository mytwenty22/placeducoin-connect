import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/cgv")({
  head: () => ({
    meta: [
      { title: "Conditions Générales de Vente & Mentions Légales — Bons Plans du Coin" },
      {
        name: "description",
        content:
          "Conditions générales de vente et mentions légales de Bons Plans du Coin : abonnement Site Pro, option Vedette, réservation de bannières publicitaires.",
      },
    ],
  }),
  component: CgvPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card space-y-3 p-5">
      <h2 className="font-display text-lg font-extrabold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function CgvPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Conditions Générales de Vente & Mentions Légales
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Applicables à toute souscription d'un abonnement Site Pro, d'une option Vedette ou d'une
            réservation de bannière publicitaire sur la plateforme Bons Plans du Coin.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-promo/30 bg-promo/5 p-4 text-xs text-foreground">
          <span className="font-bold text-promo">À compléter :</span>
          <span>
            Les mentions d'identification de l'éditeur ci-dessous (nom, SIRET, adresse) sont des
            emplacements à remplacer par les informations réelles de la micro-entreprise avant mise
            en ligne — cette page n'a pas valeur légale tant qu'elles ne sont pas renseignées.
          </span>
        </div>

        <Section title="1. Éditeur de la plateforme — Mentions légales">
          <p>
            La plateforme Bons Plans du Coin est éditée par :{" "}
            <strong className="text-foreground">[Nom et prénom du micro-entrepreneur]</strong>,
            exerçant sous le statut de micro-entreprise (entreprise individuelle), immatriculée sous
            le numéro SIRET <strong className="text-foreground">[Numéro SIRET]</strong>, dont le
            siège est situé au{" "}
            <strong className="text-foreground">[Adresse complète du siège]</strong>.
          </p>
          <p>
            Contact : <strong className="text-foreground">[Adresse e‑mail de contact]</strong> —{" "}
            <strong className="text-foreground">[Numéro de téléphone]</strong>.
          </p>
          <p>
            Directeur de la publication : <strong className="text-foreground">[Nom]</strong>.
          </p>
          <p>
            Hébergement de l'application : Vercel Inc. — hébergement de la base de données et des
            fichiers : Supabase Inc.
          </p>
          <p>
            En qualité de micro-entrepreneur, l'éditeur bénéficie de la franchise en base de TVA
            (article 293 B du Code général des impôts) : la TVA n'est pas applicable, prix nets
            indiqués en euros.
          </p>
        </Section>

        <Section title="2. Objet">
          <p>
            Bons Plans du Coin est une marketplace mettant en relation les commerces d'une commune
            avec leurs habitants. Elle propose aux commerçants et associations professionnels (B2B),
            à titre payant, les prestations suivantes :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              l'abonnement « Site Pro » (19 €/mois) : site vitrine sur-mesure et publication
              illimitée de promotions ;
            </li>
            <li>
              l'option « Vedette » (9 € / 24h) : mise en avant temporaire de la fiche dans le fil
              général de la Marketplace, et dans le carrousel VIP « À la Une » lorsqu'elle est
              cumulée avec l'abonnement Site Pro ;
            </li>
            <li>
              la réservation d'un emplacement de bannière publicitaire (Haut ou Bas de page), selon
              trois formules : Test (7 jours), Standard et Sponsor Exclusif (1 mois calendaire
              chacune).
            </li>
          </ul>
        </Section>

        <Section title="3. Durée des prestations">
          <p>
            Chaque emplacement souscrit (bannière, option Vedette) l'est pour une durée ferme et
            déterminée dès la commande :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>formule Test : 7 jours consécutifs à compter de l'activation ;</li>
            <li>
              formules Standard et Sponsor Exclusif : 1 mois calendaire (du premier au dernier jour
              du mois réservé), y compris pour une réservation effectuée jusqu'à 6 mois à l'avance ;
            </li>
            <li>option Vedette : 24 heures consécutives à compter de l'activation.</li>
          </ul>
          <p>
            L'abonnement Site Pro est un abonnement mensuel, reconduit tacitement à chaque échéance
            jusqu'à résiliation par le commerçant depuis son espace de gestion.
          </p>
        </Section>

        <Section title="4. Absence de rétractation et non-remboursement">
          <p>
            Les prestations décrites à l'article 2 sont exclusivement proposées à des professionnels
            (commerçants, associations) agissant pour les besoins de leur activité, à l'exclusion de
            toute vente à des consommateurs. La relation contractuelle est donc de nature
            strictement B2B (professionnel à professionnel).
          </p>
          <p>
            En conséquence, le droit de rétractation prévu par les articles L221-18 et suivants du
            Code de la consommation, réservé aux consommateurs, ne s'applique pas aux commandes
            passées sur Bons Plans du Coin.
          </p>
          <p>
            Toute commande validée et payée est ferme et définitive. Aucun remboursement, total ou
            partiel, ne sera effectué, y compris en cas d'annulation anticipée d'une réservation
            (bannière, option Vedette) à l'initiative du commerçant via le bouton « Annuler » de son
            espace de gestion : cette annulation libère l'emplacement pour un tiers mais n'ouvre
            droit à aucun remboursement ni avoir sur la période déjà engagée.
          </p>
        </Section>

        <Section title="5. Modération des visuels">
          <p>
            Bons Plans du Coin se réserve le droit de refuser la publication, ou de suspendre et
            retirer sans préavis tout visuel (bannière, logo, photo de couverture, image de
            promotion ou de produit) déjà publié dès lors qu'il :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              présente un caractère illicite, trompeur, discriminatoire, violent ou contraire à
              l'ordre public ou aux bonnes mœurs ;
            </li>
            <li>
              porte atteinte aux droits de tiers (droit à l'image, propriété intellectuelle) ;
            </li>
            <li>
              ne respecte pas le format technique requis pour l'emplacement concerné (ratio, poids,
              résolution) au point de nuire à l'affichage ou à la lisibilité de la Marketplace ;
            </li>
            <li>
              fait la promotion d'une activité concurrente non autorisée ou hors du champ de la
              fiche commerce concernée.
            </li>
          </ul>
          <p>
            Ce retrait ou refus ne donne lieu à aucun remboursement conformément à l'article 4
            ci-dessus. Le commerçant reste seul responsable des visuels qu'il importe et garantit
            disposer de tous les droits nécessaires à leur diffusion.
          </p>
        </Section>

        <Section title="6. Tarifs et paiement">
          <p>
            Les tarifs en vigueur sont affichés dans l'espace Pro au moment de la commande. Le
            paiement s'effectue par carte bancaire via un prestataire de paiement sécurisé tiers
            (Stripe). Toute commande n'est considérée comme définitive qu'après confirmation du
            paiement.
          </p>
        </Section>

        <Section title="7. Responsabilité">
          <p>
            Bons Plans du Coin agit en qualité d'intermédiaire technique mettant à disposition un
            emplacement d'affichage. Le commerçant demeure seul responsable du contenu de sa fiche,
            de ses offres, de ses visuels et de la conformité de son activité à la réglementation
            applicable (droit de la consommation, affichage des prix, etc.).
          </p>
        </Section>

        <Section title="8. Données personnelles">
          <p>
            Les données transmises lors de la création d'un compte ou d'une commande sont traitées
            par Bons Plans du Coin pour la gestion de la relation commerciale. Elles sont hébergées
            par Supabase Inc. Conformément au RGPD, chaque utilisateur dispose d'un droit d'accès,
            de rectification et de suppression de ses données, exerçable auprès de l'adresse de
            contact indiquée à l'article 1.
          </p>
        </Section>

        <Section title="9. Droit applicable et litiges">
          <p>
            Les présentes CGV sont soumises au droit français. À défaut de résolution amiable, tout
            litige relève de la compétence des tribunaux du ressort du siège de l'éditeur.
          </p>
        </Section>

        <Section title="10. Modification des CGV">
          <p>
            Bons Plans du Coin peut modifier les présentes CGV à tout moment. La version applicable
            à une commande est celle en vigueur sur la plateforme au moment de la validation de
            cette commande.
          </p>
        </Section>

        <p className="text-center text-xs text-muted-foreground">
          Dernière mise à jour : <strong className="text-foreground">[Date de mise à jour]</strong>.{" "}
          <Link to="/" className="font-semibold text-navy hover:underline">
            Retour à la Marketplace
          </Link>
        </p>
      </div>
    </div>
  );
}
