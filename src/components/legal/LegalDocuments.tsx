import type { ReactNode } from "react";
import { isPlaceholder, LEGAL_IDENTITY as ID, type LegalDocKey } from "@/lib/legal";
import { getSiteUrl } from "@/lib/site-url";

// Textes juridiques complets de SpotLocal. Les informations de l'éditeur viennent de
// LEGAL_IDENTITY (lib/legal.ts) : une valeur encore entre crochets y est surlignée.

/** Valeur d'identification de l'éditeur, surlignée tant qu'elle n'est pas renseignée. */
function V({ children }: { children: string }) {
  return isPlaceholder(children) ? (
    <mark className="rounded bg-promo/15 px-1 font-semibold text-promo">{children}</mark>
  ) : (
    <strong className="font-semibold text-foreground">{children}</strong>
  );
}

function Art({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="font-display text-base font-extrabold text-foreground">
        Article {n} — {title}
      </h3>
      {children}
    </section>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <h2 className="border-b border-border pb-2 font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="sm:text-justify">{children}</p>;
}

function Editeur() {
  return (
    <>
      la société <V>{ID.nomSociete}</V>, <V>{ID.formeJuridique}</V> au capital de{" "}
      <V>{ID.capital}</V> euros, immatriculée au Registre du commerce et des sociétés de{" "}
      <V>{ID.rcsVille}</V> sous le numéro <V>{ID.siren}</V>, dont le siège social est situé{" "}
      <V>{ID.adresse}</V>
    </>
  );
}

function Updated() {
  return (
    <p className="text-xs text-muted-foreground">
      Dernière mise à jour : <V>{ID.dateMiseAJour}</V>.
    </p>
  );
}

// ── Mentions légales ────────────────────────────────────────────────────────────────────────

export function MentionsLegales() {
  const site = getSiteUrl().replace(/^https?:\/\//, "");
  return (
    <>
      <P>
        Conformément aux dispositions de l'article 6, III de la loi n° 2004-575 du 21 juin 2004 pour
        la confiance dans l'économie numérique, il est porté à la connaissance des utilisateurs et
        visiteurs de la plateforme SpotLocal les présentes mentions légales. L'accès à la plateforme
        et son utilisation emportent l'acceptation sans réserve des présentes mentions légales ainsi
        que des conditions générales applicables à chaque catégorie d'utilisateurs.
      </P>

      <Art n="1" title="Éditeur de la plateforme">
        <P>
          La plateforme SpotLocal, accessible à l'adresse <V>{site}</V> ainsi que sous la forme
          d'une application web progressive installable sur les terminaux mobiles et fixes (ci-après
          la «&nbsp;Plateforme&nbsp;»), est éditée par <Editeur />.
        </P>
        <P>
          Le numéro d'identification intracommunautaire à la taxe sur la valeur ajoutée de la
          société est le <V>{ID.numTva}</V>. La société peut être contactée par courrier
          électronique à l'adresse <V>{ID.emailContact}</V>, par téléphone au <V>{ID.telephone}</V>{" "}
          ou par voie postale à l'adresse de son siège social.
        </P>
      </Art>

      <Art n="2" title="Directeur de la publication">
        <P>
          Le directeur de la publication de la Plateforme, au sens de l'article 93-2 de la loi n°
          82-652 du 29 juillet 1982 sur la communication audiovisuelle, est{" "}
          <V>{ID.directeurPublication}</V>, en sa qualité de représentant légal de la société
          éditrice. Il peut être joint à l'adresse électronique <V>{ID.emailContact}</V>.
        </P>
        <P>
          Les contenus publiés par les commerçants, associations et collectivités territoriales
          depuis leurs espaces respectifs le sont sous la seule responsabilité de leurs auteurs, la
          société éditrice n'intervenant à leur égard qu'en qualité de fournisseur de services
          d'hébergement dans les conditions précisées à l'article 5 ci-après.
        </P>
      </Art>

      <Art n="3" title="Hébergement">
        <P>
          L'application et ses ressources statiques sont hébergées par la société Vercel Inc.,
          société de droit de l'État du Delaware dont le siège est situé 440 N Barranca Avenue
          #4133, Covina, CA 91723, États-Unis d'Amérique, joignable via le site https://vercel.com.
        </P>
        <P>
          La base de données, les services d'authentification et le stockage des fichiers importés
          par les utilisateurs sont hébergés par la société Supabase, Inc., dont l'adresse est
          située 970 Toa Payoh North #07-04, Singapour 318992, joignable via le site
          https://supabase.com.
        </P>
      </Art>

      <Art n="4" title="Propriété intellectuelle">
        <P>
          La Plateforme, prise dans son ensemble comme dans chacun de ses éléments, et notamment sa
          structure, son architecture, ses bases de données, ses codes sources et objets, sa charte
          graphique, ses textes, la dénomination SpotLocal, son logotype et ses icônes, est la
          propriété exclusive de la société éditrice ou fait l'objet d'une autorisation
          d'utilisation à son profit. Ces éléments sont protégés par les dispositions du Code de la
          propriété intellectuelle et par les conventions internationales applicables.
        </P>
        <P>
          Toute reproduction, représentation, adaptation, traduction, extraction ou réutilisation,
          totale ou partielle, de tout ou partie de la Plateforme ou de son contenu, par quelque
          procédé et sur quelque support que ce soit, sans l'autorisation préalable et écrite de la
          société éditrice, est strictement interdite et constitue une contrefaçon sanctionnée par
          les articles L. 335-2 et suivants du Code de la propriété intellectuelle, ainsi qu'une
          atteinte aux droits du producteur de bases de données au sens des articles L. 341-1 et
          suivants du même code.
        </P>
        <P>
          Les marques, logos, photographies et visuels des établissements référencés demeurent la
          propriété de leurs titulaires respectifs, qui en ont concédé l'usage à la société éditrice
          pour les seuls besoins de leur diffusion sur la Plateforme.
        </P>
      </Art>

      <Art n="5" title="Contenus de tiers et procédure de notification">
        <P>
          En sa qualité de fournisseur de services d'hébergement au sens de l'article 6 du règlement
          (UE) 2022/2065 du 19 octobre 2022 relatif à un marché unique des services numériques et de
          la loi n° 2004-575 du 21 juin 2004, la société éditrice ne saurait voir sa responsabilité
          engagée du fait des informations stockées à la demande des utilisateurs si elle n'a pas
          effectivement connaissance de leur caractère illicite ou si, dès le moment où elle en a eu
          connaissance, elle a agi promptement pour retirer ces informations ou en rendre l'accès
          impossible.
        </P>
        <P>
          Toute personne souhaitant signaler un contenu qu'elle estime illicite peut adresser une
          notification à l'adresse <V>{ID.emailContact}</V>. Conformément à l'article 16 du
          règlement précité, la notification comporte une explication suffisamment étayée des
          raisons pour lesquelles le contenu est considéré comme illicite, l'indication claire de
          son emplacement électronique exact, notamment par la mention de l'adresse URL de la page
          concernée, le nom et l'adresse électronique de son auteur, sauf lorsque l'infraction
          alléguée relève des articles 3 à 7 de la directive 2011/93/UE, ainsi qu'une déclaration
          confirmant que l'auteur de la notification pense, de bonne foi, que les informations et
          allégations qu'elle contient sont exactes et complètes. Il est rappelé que le fait de
          présenter un contenu comme illicite dans le but d'en obtenir le retrait ou d'en faire
          cesser la diffusion, en sachant cette information inexacte, est puni d'une peine d'un an
          d'emprisonnement et de 15 000 euros d'amende.
        </P>
        <P>
          La société éditrice accuse réception de toute notification, l'examine dans les meilleurs
          délais, de manière diligente et objective, et informe son auteur ainsi que l'utilisateur à
          l'origine du contenu concerné de la décision prise et des voies de recours disponibles.
        </P>
      </Art>

      <Art n="6" title="Point de contact unique">
        <P>
          En application des articles 11 et 12 du règlement (UE) 2022/2065, le point de contact
          unique permettant aux autorités des États membres, à la Commission européenne, au comité
          européen des services numériques ainsi qu'aux destinataires du service de communiquer
          directement et rapidement avec la société éditrice est l'adresse électronique{" "}
          <V>{ID.emailContact}</V>. Les communications peuvent être adressées en langue française ou
          en langue anglaise.
        </P>
      </Art>

      <Art n="7" title="Données personnelles">
        <P>
          Les conditions dans lesquelles la société éditrice collecte et traite les données à
          caractère personnel des utilisateurs, ainsi que les modalités d'exercice des droits dont
          ceux-ci disposent, sont décrites dans la politique de confidentialité figurant au sein des
          conditions générales d'utilisation applicables aux particuliers. Toute demande relative à
          la protection des données personnelles peut être adressée à l'adresse{" "}
          <V>{ID.emailRgpd}</V>.
        </P>
      </Art>

      <Art n="8" title="Crédits">
        <P>
          Les fonds cartographiques affichés sur la Plateforme sont issus du projet OpenStreetMap et
          sont mis à disposition sous licence Open Database License (ODbL), © les contributeurs
          d'OpenStreetMap. Les polices de caractères employées sont distribuées par le service
          Google Fonts sous licence SIL Open Font License.
        </P>
      </Art>

      <Art n="9" title="Droit applicable">
        <P>
          Les présentes mentions légales sont régies par le droit français. Elles sont rédigées en
          langue française, seule la version française faisant foi.
        </P>
      </Art>

      <Updated />
    </>
  );
}

// ── CGU Particuliers & Politique de confidentialité ─────────────────────────────────────────

export function CguParticuliers() {
  return (
    <>
      <P>
        Les présentes conditions générales d'utilisation (ci-après les «&nbsp;CGU&nbsp;») ont pour
        objet de définir les modalités et conditions dans lesquelles <Editeur /> (ci-après
        «&nbsp;SpotLocal&nbsp;») met à la disposition des personnes physiques agissant à des fins
        n'entrant pas dans le cadre de leur activité commerciale, industrielle, artisanale, libérale
        ou agricole (ci-après l'«&nbsp;Utilisateur&nbsp;») la plateforme SpotLocal, ainsi que les
        conditions dans lesquelles SpotLocal traite les données à caractère personnel des
        Utilisateurs.
      </P>

      <Part title="Titre I — Conditions générales d'utilisation">
        <Art n="1" title="Définitions">
          <P>
            Au sens des présentes, le terme «&nbsp;Plateforme&nbsp;» désigne le service accessible à
            l'adresse du site SpotLocal et sous la forme d'une application web progressive,
            permettant de consulter les établissements, offres, promotions, événements et
            informations publiés à l'échelle d'une commune. Le terme «&nbsp;Commerçant&nbsp;»
            désigne tout professionnel, toute association ou tout organisme disposant d'un espace
            dédié sur la Plateforme et y publiant une fiche, des offres ou des contenus. Le terme
            «&nbsp;Collectivité&nbsp;» désigne toute commune ou collectivité territoriale publiant
            des informations depuis l'Espace Mairie. Le terme «&nbsp;Offre&nbsp;» désigne toute
            promotion, réduction, coupon, avantage ou proposition commerciale publié par un
            Commerçant. Le terme «&nbsp;Coupon&nbsp;» désigne l'Offre dont le bénéfice est
            subordonné à une validation effectuée depuis la Plateforme au sein de l'établissement du
            Commerçant. Le terme «&nbsp;Compte&nbsp;» désigne l'espace personnel créé par
            l'Utilisateur au moyen d'une adresse électronique et d'un mot de passe.
          </P>
        </Art>

        <Art n="2" title="Acceptation et opposabilité des CGU">
          <P>
            L'accès à la Plateforme et son utilisation, avec ou sans création d'un Compte, emportent
            l'acceptation pleine et entière des présentes CGU, que l'Utilisateur reconnaît avoir
            lues et comprises. Les CGU sont accessibles à tout moment depuis le pied de page de la
            Plateforme et peuvent être sauvegardées ou imprimées par l'Utilisateur. L'Utilisateur
            qui n'accepte pas les CGU doit renoncer à tout usage de la Plateforme.
          </P>
        </Art>

        <Art n="3" title="Conditions d'accès au service">
          <P>
            L'accès à la Plateforme est gratuit pour l'Utilisateur, à l'exception des frais de
            connexion et d'équipement, qui demeurent à sa charge exclusive. La Plateforme est
            accessible depuis tout terminal disposant d'un navigateur internet récent et d'une
            connexion au réseau internet. Certaines fonctionnalités, telles que l'enregistrement de
            commerces favoris ou la validation de Coupons, sont réservées aux Utilisateurs
            titulaires d'un Compte. Certaines fonctionnalités, telles que le tri des établissements
            par proximité ou la validation d'un Coupon, nécessitent l'autorisation préalable d'accès
            à la position du terminal, que l'Utilisateur demeure libre de refuser ou de retirer à
            tout moment, ces fonctionnalités étant alors indisponibles.
          </P>
          <P>
            SpotLocal met en œuvre les moyens raisonnables à sa disposition pour assurer un accès
            continu à la Plateforme, sans être tenue à aucune obligation de résultat à cet égard.
            SpotLocal se réserve la faculté de suspendre, d'interrompre ou de limiter, sans préavis,
            l'accès à tout ou partie de la Plateforme, notamment pour des raisons de maintenance, de
            mise à jour, de sécurité ou en cas de force majeure, sans que cette suspension ouvre
            droit à une quelconque indemnité au profit de l'Utilisateur.
          </P>
        </Art>

        <Art n="4" title="Création et gestion du Compte">
          <P>
            La création d'un Compte est réservée aux personnes physiques âgées d'au moins quinze
            ans. L'Utilisateur âgé de moins de quinze ans ne peut créer un Compte qu'avec le
            consentement conjoint du ou des titulaires de l'autorité parentale, conformément à
            l'article 45 de la loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux
            fichiers et aux libertés.
          </P>
          <P>
            L'Utilisateur s'engage à fournir des informations exactes et à les maintenir à jour. Ses
            identifiants de connexion sont strictement personnels et confidentiels ; il est seul
            responsable de leur conservation et de toute utilisation de son Compte effectuée au
            moyen de ceux-ci, et s'engage à informer sans délai SpotLocal de toute utilisation
            frauduleuse dont il aurait connaissance. L'Utilisateur peut à tout moment demander la
            suppression de son Compte dans les conditions prévues à l'article 23 des présentes.
          </P>
        </Art>

        <Art n="5" title="Rôle d'intermédiaire technique de SpotLocal">
          <P>
            SpotLocal exploite une plateforme de mise en relation et de diffusion d'informations
            locales. À ce titre, elle agit exclusivement en qualité d'intermédiaire technique et de
            fournisseur de services d'hébergement, au sens de l'article 6 du règlement (UE)
            2022/2065 du 19 octobre 2022 relatif à un marché unique des services numériques, à
            l'égard des contenus publiés par les Commerçants et les Collectivités.
          </P>
          <P>
            SpotLocal n'a pas la qualité de vendeur, de prestataire ou de mandataire des
            Commerçants. Elle n'intervient à aucun titre dans la conclusion, l'exécution ou le
            paiement des contrats susceptibles d'être conclus entre l'Utilisateur et un Commerçant,
            lesquels sont formés directement et exclusivement entre eux, dans les conditions propres
            à chaque Commerçant. SpotLocal n'est soumise à aucune obligation générale de
            surveillance des contenus qu'elle stocke ni de recherche active de faits ou de
            circonstances révélant des activités illicites.
          </P>
        </Art>

        <Art n="6" title="Offres, promotions et Coupons des Commerçants">
          <P>
            Les Offres, promotions, réductions, prix, conditions, durées de validité, stocks et
            informations relatives aux établissements sont définis, rédigés et publiés par les
            Commerçants sous leur seule et entière responsabilité. Chaque Commerçant est seul tenu,
            à l'égard de l'Utilisateur, du respect des dispositions du Code de la consommation
            relatives à l'information sur les prix, aux annonces de réduction de prix et aux
            pratiques commerciales, ainsi que de l'exécution loyale des Offres qu'il publie.
          </P>
          <P>
            En conséquence, et dans les limites autorisées par la loi, SpotLocal ne garantit ni
            l'exactitude, ni l'exhaustivité, ni l'actualité, ni la licéité des Offres publiées, ni
            leur disponibilité effective en magasin, ni la qualité ou la conformité des produits et
            services proposés par les Commerçants, et ne saurait être tenue pour responsable de
            l'inexécution, de la mauvaise exécution ou du refus d'exécution d'une Offre par un
            Commerçant, d'une erreur affectant une Offre, de la modification, de la suspension ou du
            retrait d'une Offre par son auteur, ni de tout litige né entre l'Utilisateur et un
            Commerçant. Toute réclamation relative à une Offre doit être adressée directement au
            Commerçant concerné, SpotLocal pouvant, à titre purement gracieux et sans engagement de
            sa part, faciliter la mise en relation entre les parties.
          </P>
          <P>
            La validation d'un Coupon s'effectue depuis le terminal de l'Utilisateur, au sein de
            l'établissement du Commerçant, au moyen d'une vérification de la présence de
            l'Utilisateur dans un périmètre déterminé autour dudit établissement ou, à défaut, au
            moyen d'un code remis par le Commerçant. Un Coupon validé est utilisable pendant une
            durée limitée indiquée lors de sa validation. Il est strictement personnel, ne peut être
            cédé, revendu ni échangé contre sa valeur en numéraire, et demeure soumis aux conditions
            fixées par le Commerçant, lequel apprécie seul les conditions de son application en
            caisse.
          </P>
        </Art>

        <Art n="7" title="Informations publiées par les Collectivités">
          <P>
            Les informations municipales, alertes, avis et événements diffusés depuis l'Espace
            Mairie sont rédigés et publiés par les Collectivités sous leur seule responsabilité
            éditoriale. Ces informations sont fournies à titre indicatif et ne se substituent pas
            aux actes administratifs, arrêtés et publications officielles de la Collectivité
            concernée, qui seuls font foi.
          </P>
        </Art>

        <Art n="8" title="Obligations de l'Utilisateur">
          <P>
            L'Utilisateur s'engage à faire de la Plateforme un usage loyal, personnel et conforme à
            sa destination, aux présentes CGU ainsi qu'aux lois et règlements en vigueur. Il
            s'interdit notamment de valider ou de tenter de valider un Coupon hors de
            l'établissement concerné, de falsifier, simuler ou altérer de quelque manière que ce
            soit la position transmise par son terminal, de créer plusieurs Comptes en vue de
            bénéficier indûment d'une Offre, de procéder à toute extraction, collecte ou
            réutilisation automatisée ou systématique des contenus de la Plateforme, de porter
            atteinte à la sécurité, à l'intégrité ou au fonctionnement de la Plateforme, ainsi que
            d'usurper l'identité d'un tiers. Tout manquement expose l'Utilisateur aux mesures
            prévues à l'article 12, sans préjudice de toute action judiciaire.
          </P>
        </Art>

        <Art n="9" title="Responsabilité">
          <P>
            SpotLocal est tenue d'une obligation de moyens dans la fourniture de la Plateforme. Sa
            responsabilité ne saurait être engagée en raison de dysfonctionnements imputables au
            terminal ou à la connexion de l'Utilisateur, au fait d'un tiers, notamment d'un
            Commerçant ou d'une Collectivité, ou à un cas de force majeure au sens de l'article 1218
            du Code civil. Aucune stipulation des présentes ne saurait avoir pour effet de limiter
            ou d'exclure la responsabilité de SpotLocal en cas de faute lourde ou dolosive, de
            dommage corporel, ou dans les cas où une telle limitation est interdite par les
            dispositions impératives du Code de la consommation.
          </P>
        </Art>

        <Art n="10" title="Signalement des contenus illicites">
          <P>
            Tout Utilisateur peut signaler à SpotLocal un contenu qu'il estime illicite ou contraire
            aux présentes, selon la procédure de notification décrite à l'article 5 des mentions
            légales, à l'adresse <V>{ID.emailContact}</V>. SpotLocal traite les notifications reçues
            de manière diligente, objective et non arbitraire, et informe leur auteur de la suite
            qui leur est donnée.
          </P>
        </Art>

        <Art n="11" title="Propriété intellectuelle">
          <P>
            SpotLocal concède à l'Utilisateur, pour la durée de son utilisation de la Plateforme, un
            droit personnel, non exclusif, non cessible et non transférable d'accès et d'utilisation
            de la Plateforme, pour ses seuls besoins privés. Tout autre usage est subordonné à
            l'autorisation préalable et écrite de SpotLocal. Les droits de propriété intellectuelle
            afférents à la Plateforme sont régis par l'article 4 des mentions légales.
          </P>
        </Art>

        <Art n="12" title="Suspension et résiliation">
          <P>
            En cas de manquement de l'Utilisateur aux présentes CGU, SpotLocal se réserve le droit
            de suspendre temporairement ou de supprimer définitivement son Compte, d'annuler les
            Coupons validés de manière frauduleuse et de lui interdire l'accès à tout ou partie de
            la Plateforme, après l'en avoir informé par une décision motivée, sauf urgence ou
            obligation légale contraire. L'Utilisateur peut, à tout moment et sans motif, cesser
            d'utiliser la Plateforme et demander la suppression de son Compte.
          </P>
        </Art>

        <Art n="13" title="Modification des CGU">
          <P>
            SpotLocal se réserve la faculté de modifier les présentes CGU, notamment pour les
            adapter aux évolutions de la Plateforme ou de la réglementation. Les Utilisateurs
            titulaires d'un Compte sont informés de toute modification substantielle par tout moyen
            approprié avant son entrée en vigueur. L'utilisation de la Plateforme postérieurement à
            l'entrée en vigueur des CGU modifiées vaut acceptation de celles-ci.
          </P>
        </Art>

        <Art n="14" title="Droit applicable, médiation et règlement des litiges">
          <P>
            Les présentes CGU sont régies par le droit français. En cas de différend, l'Utilisateur
            est invité à adresser préalablement une réclamation écrite à SpotLocal à l'adresse{" "}
            <V>{ID.emailContact}</V> afin de rechercher une solution amiable.
          </P>
          <P>
            Conformément aux articles L. 611-1 et suivants et R. 612-1 et suivants du Code de la
            consommation, l'Utilisateur ayant la qualité de consommateur peut, à défaut de
            résolution amiable dans un délai de deux mois à compter de sa réclamation écrite,
            recourir gratuitement au médiateur de la consommation dont relève SpotLocal :{" "}
            <V>{ID.mediateurNom}</V>, dont les coordonnées et les modalités de saisine figurent sur
            le site <V>{ID.mediateurSite}</V>.
          </P>
          <P>
            À défaut de résolution amiable, tout litige sera porté devant la juridiction compétente
            dans les conditions de droit commun, l'Utilisateur consommateur pouvant saisir, à son
            choix, outre l'une des juridictions territorialement compétentes en vertu du Code de
            procédure civile, la juridiction du lieu où il demeurait au moment de la conclusion du
            contrat ou de la survenance du fait dommageable, conformément à l'article R. 631-3 du
            Code de la consommation.
          </P>
        </Art>
      </Part>

      <Part title="Titre II — Politique de confidentialité et protection des données personnelles">
        <Art n="15" title="Responsable du traitement">
          <P>
            Les données à caractère personnel des Utilisateurs sont traitées par <Editeur />, en
            qualité de responsable du traitement au sens de l'article 4, 7) du règlement (UE)
            2016/679 du 27 avril 2016 relatif à la protection des personnes physiques à l'égard du
            traitement des données à caractère personnel (ci-après le «&nbsp;RGPD&nbsp;»), et dans
            le respect de la loi n° 78-17 du 6 janvier 1978 modifiée relative à l'informatique, aux
            fichiers et aux libertés. Toute question relative au traitement des données personnelles
            peut être adressée à l'adresse <V>{ID.emailRgpd}</V>.
          </P>
        </Art>

        <Art n="16" title="Principes applicables">
          <P>
            SpotLocal s'engage à ne collecter que les données adéquates, pertinentes et limitées à
            ce qui est strictement nécessaire au regard des finalités pour lesquelles elles sont
            traitées, à les traiter de manière licite, loyale et transparente, à les conserver pour
            une durée n'excédant pas celle nécessaire à ces finalités, et à garantir leur sécurité
            et leur confidentialité, conformément à l'article 5 du RGPD. SpotLocal ne vend, ne loue
            ni ne cède à titre onéreux les données personnelles des Utilisateurs, et ne procède à
            aucun profilage ni à aucune prise de décision fondée exclusivement sur un traitement
            automatisé produisant des effets juridiques à leur égard.
          </P>
        </Art>

        <Art n="17" title="Données traitées, finalités et bases légales">
          <P>
            Lors de la création et de la gestion d'un Compte, SpotLocal traite l'adresse
            électronique de l'Utilisateur ainsi que son mot de passe, lequel est conservé sous une
            forme chiffrée irréversible, aux fins de permettre l'authentification de l'Utilisateur
            et la fourniture des fonctionnalités réservées aux titulaires d'un Compte, notamment
            l'enregistrement de commerces favoris et la validation de Coupons. Ce traitement est
            nécessaire à l'exécution des présentes CGU, au sens de l'article 6, 1, b) du RGPD.
          </P>
          <P>
            La Plateforme est susceptible d'accéder à la position géographique du terminal de
            l'Utilisateur, exclusivement après que celui-ci y a expressément consenti au moyen de la
            fenêtre d'autorisation affichée par son navigateur, sur le fondement de l'article 6, 1,
            a) du RGPD et de l'article 82 de la loi n° 78-17 du 6 janvier 1978. Lorsqu'elle est
            utilisée pour afficher et trier les établissements situés à proximité, la position est
            exploitée en temps réel, uniquement dans la mémoire du terminal de l'Utilisateur, et
            n'est ni transmise aux serveurs de SpotLocal, ni enregistrée, ni conservée au-delà de la
            session de navigation. Lorsqu'elle est utilisée pour valider un Coupon, la position est
            transmise de manière ponctuelle et sécurisée aux serveurs de SpotLocal aux seules fins
            de calculer la distance séparant l'Utilisateur de l'établissement concerné ; les
            coordonnées géographiques ne sont ni enregistrées ni conservées à l'issue de ce calcul,
            seule la distance arrondie au mètre étant associée à la validation du Coupon, aux fins
            de preuve de son utilisation régulière et de prévention de la fraude, sur le fondement
            de l'intérêt légitime de SpotLocal et des Commerçants au sens de l'article 6, 1, f) du
            RGPD. Aucun historique de déplacements n'est constitué. L'Utilisateur peut retirer à
            tout moment son autorisation depuis les réglages de son navigateur ou de son terminal.
          </P>
          <P>
            L'envoi de notifications Push Web est subordonné au consentement préalable, libre,
            spécifique, éclairé et univoque de l'Utilisateur, recueilli selon un mécanisme
            d'adhésion active (opt-in) : aucune notification ne peut être adressée à l'Utilisateur
            sans qu'il ait, d'une part, sollicité leur activation par une action positive au sein de
            la Plateforme et, d'autre part, accordé l'autorisation correspondante dans la fenêtre
            système de son navigateur. Ce traitement, fondé sur l'article 6, 1, a) du RGPD et sur
            l'article 82 de la loi n° 78-17 du 6 janvier 1978, porte sur l'adresse technique
            d'abonnement générée par le navigateur et ses clés de chiffrement, sur la commune et les
            catégories d'intérêt sélectionnées et, le cas échéant, sur l'identifiant du Compte et la
            liste des commerces favoris pour lesquels l'Utilisateur a choisi d'être alerté. Le
            consentement peut être retiré à tout moment, aussi simplement qu'il a été donné, depuis
            les préférences de la Plateforme ou les réglages du navigateur, le retrait entraînant la
            suppression de l'abonnement.
          </P>
          <P>
            Lorsque l'Utilisateur s'inscrit aux alertes par courrier électronique ou par message
            court, SpotLocal traite l'adresse électronique ou le numéro de téléphone communiqué
            ainsi que les catégories d'intérêt choisies, aux fins d'adresser les alertes
            sollicitées, sur le fondement du consentement de l'Utilisateur. Chaque message comporte
            un moyen simple de se désinscrire.
          </P>
          <P>
            Les préférences d'affichage de l'Utilisateur, telles que le rayon de recherche, les
            catégories sélectionnées et l'état d'installation de l'application, sont enregistrées
            exclusivement dans le stockage local de son terminal et ne sont pas transmises à
            SpotLocal. Les statistiques mises à la disposition des Commerçants, relatives aux
            consultations de leur fiche et à l'utilisation de leurs Offres, sont établies au moyen
            de comptages agrégés qui ne comportent ni l'identité de l'Utilisateur, ni son adresse
            IP, ni aucun identifiant permettant de le reconnaître.
          </P>
          <P>
            Enfin, les prestataires d'hébergement de SpotLocal conservent des journaux techniques de
            connexion, comportant notamment l'adresse IP et les caractéristiques du terminal, aux
            fins d'assurer la sécurité, le bon fonctionnement de la Plateforme et la prévention des
            abus, sur le fondement de l'intérêt légitime de SpotLocal, ainsi que, le cas échéant,
            pour répondre aux obligations légales de conservation qui lui incombent.
          </P>
        </Art>

        <Art n="18" title="Destinataires des données">
          <P>
            Les données personnelles sont exclusivement destinées aux personnes habilitées de
            SpotLocal, dans la limite de leurs attributions, ainsi qu'à ses sous-traitants au sens
            de l'article 28 du RGPD, qui agissent sur ses instructions documentées et sont tenus par
            des obligations contractuelles de confidentialité et de sécurité : la société Supabase,
            Inc., pour l'hébergement de la base de données et l'authentification ; la société Vercel
            Inc., pour l'hébergement de l'application ; la société Resend, Inc., pour l'acheminement
            des courriers électroniques ; et les services de notification exploités par les éditeurs
            des navigateurs, pour l'acheminement des notifications Push Web, ces derniers ne
            recevant que le contenu chiffré des notifications.
          </P>
          <P>
            Les Commerçants n'ont accès qu'aux informations strictement nécessaires à la
            vérification d'un Coupon au moment de son utilisation dans leur établissement, ainsi
            qu'à des statistiques agrégées et anonymes. Les données peuvent en outre être
            communiquées aux autorités administratives ou judiciaires habilitées, sur réquisition et
            dans les conditions prévues par la loi.
          </P>
        </Art>

        <Art n="19" title="Transferts de données hors de l'Union européenne">
          <P>
            Certains sous-traitants de SpotLocal étant établis aux États-Unis d'Amérique, des
            données personnelles sont susceptibles d'être transférées ou rendues accessibles en
            dehors de l'Espace économique européen. Ces transferts sont encadrés, conformément au
            chapitre V du RGPD, soit par la décision d'adéquation de la Commission européenne du 10
            juillet 2023 relative au cadre de protection des données UE–États-Unis, pour les
            sous-traitants certifiés à ce titre, soit par les clauses contractuelles types adoptées
            par la Commission européenne, assorties le cas échéant de mesures complémentaires.
            L'Utilisateur peut obtenir une copie de ces garanties sur simple demande adressée à
            l'adresse <V>{ID.emailRgpd}</V>.
          </P>
        </Art>

        <Art n="20" title="Durées de conservation">
          <P>
            Les données relatives au Compte sont conservées pendant toute la durée de son existence,
            puis supprimées à la suite de la demande de suppression de l'Utilisateur ou à l'issue
            d'une période de trois ans sans aucune connexion au Compte. Dans ce dernier cas,
            l'Utilisateur est informé de la suppression envisagée par un courrier électronique
            adressé au moins trente jours avant celle-ci ; une connexion au Compte avant
            l'expiration de ce délai suffit à en empêcher la suppression. Les abonnements aux
            notifications Push Web sont conservés jusqu'au retrait du consentement ou jusqu'à
            l'invalidation de l'adresse d'abonnement par le navigateur. Les données relatives aux
            alertes par courrier électronique ou message court sont conservées jusqu'à la
            désinscription de l'Utilisateur. Les données relatives à la validation des Coupons sont
            conservées pendant une durée de trois ans à compter de leur enregistrement, aux fins de
            preuve et de lutte contre la fraude, puis rendues définitivement anonymes par la
            suppression de tout lien avec le Compte, seules des données statistiques étant
            conservées au-delà. Les tentatives de saisie du code de validation d'un Commerçant,
            enregistrées aux fins de prévention de la fraude, sont supprimées au bout de trente
            jours. Les coordonnées géographiques ne font l'objet d'aucune conservation. Les journaux
            techniques sont conservés pour une durée maximale d'un an. À l'issue de ces durées, les
            données sont supprimées ou rendues définitivement anonymes.
          </P>
        </Art>

        <Art n="21" title="Stockage local et traceurs">
          <P>
            La Plateforme utilise exclusivement des mécanismes de stockage local du terminal
            strictement nécessaires à la fourniture du service expressément demandé par
            l'Utilisateur, à savoir le maintien de la session d'authentification, l'enregistrement
            des préférences d'affichage et le fonctionnement hors ligne de l'application. Ces
            mécanismes sont exemptés du recueil du consentement en application de l'article 82 de la
            loi n° 78-17 du 6 janvier 1978. La Plateforme ne dépose aucun traceur publicitaire, de
            mesure d'audience ou de profilage. L'affichage des fonds cartographiques OpenStreetMap
            et des polices de caractères Google Fonts implique la transmission, par le navigateur de
            l'Utilisateur, de son adresse IP aux serveurs de ces services, aux seules fins de la
            fourniture des ressources demandées.
          </P>
        </Art>

        <Art n="22" title="Sécurité des données">
          <P>
            SpotLocal met en œuvre les mesures techniques et organisationnelles appropriées afin de
            garantir un niveau de sécurité adapté au risque, conformément à l'article 32 du RGPD, et
            notamment le chiffrement des échanges au moyen du protocole TLS, le chiffrement
            irréversible des mots de passe, le cloisonnement des accès aux données par des règles de
            sécurité appliquées au niveau de la base de données et la limitation des habilitations.
            En cas de violation de données susceptible d'engendrer un risque pour les droits et
            libertés des Utilisateurs, SpotLocal procède aux notifications prévues par les articles
            33 et 34 du RGPD.
          </P>
        </Art>

        <Art n="23" title="Droits des Utilisateurs et procédure d'exercice">
          <P>
            Conformément aux articles 15 à 22 du RGPD, l'Utilisateur dispose d'un droit d'accès à
            ses données, d'un droit de rectification, d'un droit à l'effacement, d'un droit à la
            limitation du traitement, d'un droit à la portabilité des données qu'il a fournies,
            ainsi que d'un droit d'opposition au traitement fondé sur l'intérêt légitime. Lorsque le
            traitement est fondé sur son consentement, il peut le retirer à tout moment, sans porter
            atteinte à la licéité du traitement fondé sur le consentement effectué avant ce retrait.
            Il dispose en outre, en application de l'article 85 de la loi n° 78-17 du 6 janvier
            1978, du droit de définir des directives relatives à la conservation, à l'effacement et
            à la communication de ses données après son décès.
          </P>
          <P>
            Ces droits s'exercent par courrier électronique adressé à l'adresse{" "}
            <V>{ID.emailRgpd}</V> ou par courrier postal adressé au siège social de SpotLocal,{" "}
            <V>{ID.adresse}</V>, en précisant l'objet de la demande et l'adresse électronique
            associée au Compte le cas échéant. En cas de doute raisonnable sur l'identité du
            demandeur, SpotLocal peut solliciter les informations complémentaires strictement
            nécessaires à la confirmation de celle-ci, conformément à l'article 12, 6 du RGPD.
            SpotLocal répond à la demande dans un délai d'un mois à compter de sa réception, ce
            délai pouvant être prolongé de deux mois compte tenu de la complexité ou du nombre de
            demandes, auquel cas l'Utilisateur en est informé dans le délai initial d'un mois.
          </P>
          <P>
            La demande d'effacement emporte la suppression du Compte et de l'ensemble des données
            qui y sont rattachées, à l'exception de celles dont la conservation est imposée par une
            obligation légale ou nécessaire à la constatation, à l'exercice ou à la défense de
            droits en justice, lesquelles font alors l'objet d'un archivage intermédiaire à accès
            restreint pendant la durée strictement nécessaire.
          </P>
          <P>
            Si l'Utilisateur estime, après avoir contacté SpotLocal, que ses droits ne sont pas
            respectés, il peut introduire une réclamation auprès de la Commission nationale de
            l'informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex
            07, ou en ligne sur le site www.cnil.fr.
          </P>
        </Art>

        <Art n="24" title="Modification de la politique de confidentialité">
          <P>
            La présente politique de confidentialité peut être modifiée afin de tenir compte des
            évolutions de la Plateforme ou du cadre légal et réglementaire. Toute modification
            substantielle est portée à la connaissance des Utilisateurs avant son entrée en vigueur
            et, lorsqu'elle affecte un traitement fondé sur le consentement, donne lieu à un nouveau
            recueil de celui-ci.
          </P>
        </Art>
      </Part>

      <Updated />
    </>
  );
}

// ── CGV & CGU Espace Pro ────────────────────────────────────────────────────────────────────

export function CgvPro() {
  return (
    <>
      <P>
        Les présentes conditions générales de vente et d'utilisation de l'Espace Pro (ci-après les
        «&nbsp;Conditions&nbsp;») régissent les relations contractuelles entre <Editeur />, numéro
        de TVA intracommunautaire <V>{ID.numTva}</V> (ci-après «&nbsp;SpotLocal&nbsp;»), et toute
        personne morale ou physique agissant à des fins professionnelles, ou toute association ou
        organisme, qui crée un compte au sein de l'Espace Pro de la plateforme SpotLocal et y
        référence un établissement (ci-après le «&nbsp;Commerçant&nbsp;»). SpotLocal et le
        Commerçant sont ci-après désignés ensemble les «&nbsp;Parties&nbsp;» et individuellement une
        «&nbsp;Partie&nbsp;».
      </P>

      <Art n="1" title="Définitions">
        <P>
          Au sens des présentes, le terme «&nbsp;Plateforme&nbsp;» désigne le service SpotLocal
          accessible en ligne et sous forme d'application web progressive. Le terme «&nbsp;Espace
          Pro&nbsp;» désigne l'interface de gestion réservée aux Commerçants. Le terme
          «&nbsp;Établissement&nbsp;» désigne le commerce, l'entreprise ou l'association référencé
          par le Commerçant. Le terme «&nbsp;Fiche&nbsp;» désigne la page de présentation de
          l'Établissement publiée sur la Plateforme. Le terme «&nbsp;Contenus&nbsp;» désigne
          l'ensemble des textes, informations, Offres, prix, photographies, logos, marques, visuels
          et éléments de toute nature importés ou publiés par le Commerçant. Le terme
          «&nbsp;Offre&nbsp;» désigne toute promotion, réduction de prix, coupon ou avantage
          commercial publié par le Commerçant à destination des utilisateurs de la Plateforme. Le
          terme «&nbsp;Services&nbsp;» désigne l'ensemble des prestations, gratuites ou payantes,
          fournies par SpotLocal au Commerçant au titre des présentes. Le terme
          «&nbsp;Utilisateur&nbsp;» désigne tout visiteur de la Plateforme.
        </P>
      </Art>

      <Art n="2" title="Objet, champ d'application et acceptation">
        <P>
          Les présentes Conditions ont pour objet de définir les conditions dans lesquelles
          SpotLocal fournit les Services au Commerçant ainsi que les droits et obligations des
          Parties. Elles constituent un contrat conclu entre professionnels, le Commerçant déclarant
          agir exclusivement pour les besoins de son activité professionnelle ou de l'objet de son
          association. Les Services ne sont pas proposés aux consommateurs.
        </P>
        <P>
          L'acceptation des présentes Conditions est matérialisée par le cochage, par le Commerçant,
          de la case prévue à cet effet lors de la création de son compte et lors de la création de
          sa Fiche, accompagnée de la certification de son pouvoir de représenter l'Établissement.
          La date et l'heure, fixées par les serveurs de SpotLocal, la version des Conditions
          acceptées, l'adresse IP et le type de navigateur utilisés sont enregistrés par SpotLocal
          dans un journal non modifiable. Les présentes Conditions prévalent sur tout autre document
          du Commerçant, et notamment sur ses éventuelles conditions générales d'achat, sauf accord
          dérogatoire exprès et écrit de SpotLocal.
        </P>
      </Art>

      <Art n="3" title="Capacité et pouvoir de représentation">
        <P>
          La personne physique qui procède à la création du compte et de la Fiche déclare et
          garantit être majeure et juridiquement capable, et disposer du pouvoir et de la qualité
          nécessaires pour engager l'Établissement au titre des présentes, en sa qualité de
          représentant légal ou en vertu d'une délégation de pouvoir régulière. Elle certifie
          l'exactitude du numéro d'immatriculation SIRET ou du numéro d'inscription au répertoire
          national des associations communiqué, ainsi que de l'ensemble des informations
          d'identification fournies.
        </P>
        <P>
          SpotLocal se réserve le droit de procéder à toute vérification utile de ces informations,
          notamment auprès des registres et bases de données publics, et de solliciter tout
          justificatif. Toute déclaration inexacte, incomplète ou mensongère autorise SpotLocal à
          suspendre ou à résilier de plein droit le compte du Commerçant, sans préavis ni indemnité,
          sans préjudice de tous dommages et intérêts. La personne ayant agi sans pouvoir demeure
          personnellement tenue des engagements souscrits.
        </P>
      </Art>

      <Art n="4" title="Création du compte et de la Fiche">
        <P>
          Le Commerçant s'engage à renseigner des informations exactes, complètes et à jour
          relatives à l'Établissement, notamment sa dénomination, son adresse, ses coordonnées et
          son activité, et à les actualiser sans délai en cas de modification. Il est seul
          responsable de la conservation et de la confidentialité de ses identifiants de connexion,
          ainsi que de toute utilisation de l'Espace Pro effectuée au moyen de ceux-ci, et s'engage
          à informer immédiatement SpotLocal de toute utilisation non autorisée.
        </P>
      </Art>

      <Art n="5" title="Description des Services">
        <P>
          SpotLocal met à la disposition du Commerçant, à titre gratuit, la création et la
          publication d'une Fiche présentant l'Établissement, la publication d'Offres dans les
          limites applicables à la formule gratuite, ainsi que des outils associés, tels que la
          génération d'une affiche vitrine comportant un code QR et la consultation de statistiques
          agrégées. Les associations et organismes à but non lucratif bénéficient, à titre gratuit,
          de la publication de leur Fiche et de leurs événements.
        </P>
        <P>
          SpotLocal propose en outre, à titre onéreux, l'abonnement «&nbsp;Site Pro&nbsp;», donnant
          accès à un site vitrine dédié et à la publication illimitée d'Offres, au tarif de dix-neuf
          euros par mois ; l'option «&nbsp;Vedette&nbsp;», consistant en une mise en avant
          temporaire de la Fiche pendant une durée de vingt-quatre heures, au tarif de neuf euros ;
          ainsi que la réservation d'emplacements de bannière publicitaire en haut ou en bas de
          page, selon les formules Test d'une durée de sept jours, Standard et Sponsor Exclusif
          d'une durée d'un mois calendaire chacune, aux tarifs affichés dans l'Espace Pro au jour de
          la commande. Les caractéristiques essentielles de chaque Service sont décrites dans
          l'Espace Pro préalablement à toute commande. SpotLocal se réserve la faculté de faire
          évoluer les fonctionnalités des Services, sans que cette évolution puisse affecter
          substantiellement un Service payant en cours d'exécution.
        </P>
      </Art>

      <Art n="6" title="Prix, facturation et modalités de paiement">
        <P>
          Les prix des Services payants sont exprimés en euros et s'entendent <V>{ID.regimePrix}</V>
          . Le prix applicable est celui affiché dans l'Espace Pro au moment de la validation de la
          commande. Le paiement est exigible à la commande et s'effectue par carte bancaire par
          l'intermédiaire du prestataire de services de paiement Stripe, ou par prélèvement
          récurrent pour l'abonnement. La commande n'est définitivement formée qu'après confirmation
          du paiement. Une facture est mise à la disposition du Commerçant pour chaque paiement.
        </P>
        <P>
          Conformément à l'article L. 441-10 du Code de commerce, tout retard ou défaut de paiement
          entraîne de plein droit, sans qu'un rappel soit nécessaire, l'application de pénalités de
          retard calculées au taux d'intérêt appliqué par la Banque centrale européenne à son
          opération de refinancement la plus récente majoré de dix points de pourcentage, ainsi que
          d'une indemnité forfaitaire pour frais de recouvrement d'un montant de quarante euros
          prévue à l'article D. 441-5 du même code, sans préjudice de la faculté pour SpotLocal de
          suspendre les Services concernés jusqu'au complet paiement.
        </P>
      </Art>

      <Art n="7" title="Durée, reconduction et résiliation des Services payants">
        <P>
          L'abonnement «&nbsp;Site Pro&nbsp;» est souscrit pour une durée d'un mois, tacitement
          reconduite pour des périodes successives d'un mois. Le Commerçant peut le résilier à tout
          moment depuis son Espace Pro ; la résiliation prend effet au terme de la période mensuelle
          en cours, sans remboursement de la période entamée. L'option «&nbsp;Vedette&nbsp;» et les
          réservations de bannière sont souscrites pour une durée ferme et déterminée, courant à
          compter de leur activation ou, pour les formules mensuelles, du premier au dernier jour du
          mois calendaire réservé.
        </P>
        <P>
          Toute commande validée et payée est ferme et définitive. L'annulation anticipée d'une
          option ou d'une réservation à l'initiative du Commerçant libère l'emplacement concerné
          mais n'ouvre droit à aucun remboursement, total ou partiel, ni à l'émission d'un avoir.
        </P>
      </Art>

      <Art n="8" title="Absence de droit de rétractation">
        <P>
          Les Services étant exclusivement fournis à des professionnels pour les besoins de leur
          activité, le droit de rétractation prévu aux articles L. 221-18 et suivants du Code de la
          consommation, réservé aux consommateurs, n'est pas applicable aux commandes passées au
          titre des présentes.
        </P>
        <P>
          À titre surabondant, et pour le cas où le Commerçant serait fondé à se prévaloir des
          dispositions protectrices du Code de la consommation, notamment en application de
          l'article L. 221-3 dudit code, le Commerçant reconnaît et accepte que les Services
          consistent en des prestations de services et en la fourniture de contenus numériques dont
          l'exécution commence, à sa demande expresse, dès la confirmation de la commande, avant
          l'expiration du délai de rétractation. Il renonce expressément à son droit de
          rétractation, conformément aux 1° et 13° de l'article L. 221-28 du Code de la
          consommation, s'agissant de prestations de services pleinement exécutées avant la fin du
          délai de rétractation et de contenus numériques non fournis sur un support matériel dont
          l'exécution a commencé avec son accord préalable exprès.
        </P>
      </Art>

      <Art n="9" title="Responsabilité exclusive du Commerçant quant à ses Offres">
        <P>
          Le Commerçant est seul et entièrement responsable des Contenus et des Offres qu'il publie,
          de leur véracité, de leur exactitude, de leur licéité, de leur loyauté et de leur mise à
          jour, ainsi que de la disponibilité effective des produits et services concernés. Il
          s'engage à honorer, dans les conditions annoncées, toute Offre publiée et tout Coupon
          régulièrement validé par un Utilisateur pendant la période de validité affichée.
        </P>
        <P>
          Le Commerçant s'engage à respecter l'ensemble des dispositions législatives et
          réglementaires applicables à la publicité et aux prix, et notamment les articles L. 112-1
          et suivants du Code de la consommation relatifs à l'information sur les prix. Il s'engage
          en particulier, conformément à l'article L. 112-1-1 du Code de la consommation, à ce que
          toute annonce de réduction de prix, et notamment toute présentation d'un prix barré,
          indique le prix antérieur pratiqué avant l'application de la réduction, ce prix antérieur
          correspondant au prix le plus bas pratiqué par lui à l'égard de tous les consommateurs au
          cours des trente derniers jours précédant l'application de la réduction. Il s'engage à ne
          présenter une opération comme des soldes que dans le respect des articles L. 310-3 et R.
          310-15 et suivants du Code de commerce, notamment pendant les seules périodes légales et
          pour des marchandises proposées à la vente et payées depuis au moins un mois à la date de
          début de la période de soldes considérée, ainsi qu'à respecter les dispositions des
          articles L. 310-1 et suivants du même code relatives aux liquidations.
        </P>
        <P>
          Le Commerçant s'interdit toute pratique commerciale déloyale, et notamment toute pratique
          commerciale trompeuse au sens des articles L. 121-2 à L. 121-5 du Code de la consommation,
          telle que l'annonce d'un prix de référence fictif, d'une réduction inexistante, d'une
          disponibilité inexacte ou d'une durée de validité mensongère, dont il reconnaît qu'elle
          est passible des sanctions pénales prévues à l'article L. 132-2 du même code. SpotLocal,
          qui n'exerce aucun contrôle préalable sur les Offres et n'en détermine ni le contenu ni
          les conditions, ne saurait en aucun cas être tenue pour responsable de leur
          non-conformité.
        </P>
      </Art>

      <Art n="10" title="Contenus illicites et activités réglementées">
        <P>
          Le Commerçant s'interdit de publier, par l'intermédiaire de la Plateforme, tout Contenu
          illicite, et notamment tout Contenu à caractère diffamatoire, injurieux, discriminatoire,
          haineux, violent, pornographique ou contraire à l'ordre public ou aux bonnes mœurs, tout
          Contenu portant atteinte aux droits de tiers, et notamment à leurs droits de propriété
          intellectuelle, à leur droit à l'image ou au respect de leur vie privée, ainsi que tout
          Contenu relatif à des produits ou services dont la vente ou la promotion est interdite.
        </P>
        <P>
          Le Commerçant s'interdit en outre toute promotion de produits ou services dont la
          publicité est réglementée, sauf à se conformer strictement à la réglementation qui leur
          est applicable, et notamment aux articles L. 3323-2 et suivants du Code de la santé
          publique relatifs à la publicité en faveur des boissons alcooliques, aux articles L.
          3512-4 et suivants du même code relatifs aux produits du tabac et produits du vapotage,
          dont toute propagande ou publicité est prohibée, aux articles L. 5122-1 et suivants du
          même code relatifs aux médicaments, aux dispositions de la loi n° 2010-476 du 12 mai 2010
          relatives aux jeux d'argent et de hasard, ainsi qu'aux règles déontologiques applicables
          aux professions réglementées. Toute Offre relative à des boissons alcooliques ne peut
          s'adresser aux mineurs et doit comporter le message sanitaire prescrit par la loi.
        </P>
      </Art>

      <Art n="11" title="Propriété intellectuelle et licence">
        <P>
          Le Commerçant demeure titulaire des droits de propriété intellectuelle attachés à ses
          Contenus. Il concède à SpotLocal, à titre gratuit et non exclusif, pour le monde entier et
          pour toute la durée de la relation contractuelle augmentée de la durée nécessaire au
          retrait effectif des Contenus, le droit de reproduire, représenter, adapter, notamment aux
          formats d'affichage requis, et diffuser les Contenus sur la Plateforme, dans les
          notifications et communications adressées aux Utilisateurs ainsi que sur les supports
          générés depuis l'Espace Pro, tels que l'affiche vitrine, aux seules fins de l'exécution
          des Services et de la promotion de la Plateforme.
        </P>
        <P>
          Le Commerçant déclare et garantit être titulaire de l'ensemble des droits de propriété
          intellectuelle, droits de la personnalité et autorisations nécessaires à l'exploitation
          des Contenus qu'il importe, et notamment des photographies, logos, marques et visuels, et
          que lesdits Contenus ne constituent ni une contrefaçon au sens des articles L. 335-2 et L.
          716-4 du Code de la propriété intellectuelle, ni un acte de concurrence déloyale ou
          parasitaire, ni une atteinte aux droits de quiconque.
        </P>
      </Art>

      <Art n="12" title="Garantie d'éviction et indemnisation">
        <P>
          Le Commerçant garantit SpotLocal contre tout trouble, revendication, action, réclamation,
          opposition ou éviction, de quelque nature que ce soit, émanant de tout tiers ou de toute
          autorité administrative, et fondé en tout ou partie sur les Contenus ou les Offres qu'il a
          publiés, et notamment sur une contrefaçon des visuels, logos, marques ou photographies
          importés, une atteinte au droit à l'image ou à la vie privée, une pratique commerciale
          trompeuse ou un manquement à la réglementation des prix, des soldes ou de la publicité.
        </P>
        <P>
          À ce titre, le Commerçant s'engage à intervenir, à première demande de SpotLocal, à toute
          instance engagée à l'encontre de celle-ci, et à l'indemniser intégralement de l'ensemble
          des préjudices subis et des sommes mises à sa charge, en ce compris les dommages et
          intérêts, condamnations, amendes, sommes versées au titre d'une transaction, ainsi que les
          frais de procédure et honoraires d'avocats et de conseils raisonnablement exposés. La
          présente garantie survit à la cessation des relations contractuelles pour toute la durée
          des prescriptions applicables.
        </P>
      </Art>

      <Art n="13" title="Modération, suspension et retrait unilatéral">
        <P>
          SpotLocal se réserve le droit, à tout moment et à sa seule discrétion, de refuser la
          publication, de suspendre, de déréférencer ou de retirer, sans préavis, tout Contenu ou
          toute Offre qu'elle estime illicite, contraire aux présentes Conditions, trompeur,
          susceptible d'engager sa responsabilité, de nuire à l'image de la Plateforme ou ne
          respectant pas les spécifications techniques requises, ainsi que de suspendre ou de fermer
          le compte du Commerçant concerné. SpotLocal procède au retrait immédiat de tout Contenu
          manifestement illicite dès qu'elle en a connaissance.
        </P>
        <P>
          Toute décision de restriction est portée à la connaissance du Commerçant par un exposé des
          motifs clair et spécifique, conformément à l'article 17 du règlement (UE) 2022/2065, sauf
          lorsque les Contenus concernés constituent des contenus commerciaux trompeurs de grande
          ampleur ou lorsqu'une autorité judiciaire ou répressive en a décidé autrement. Le
          Commerçant peut contester la décision en adressant une réclamation motivée à l'adresse{" "}
          <V>{ID.emailContact}</V>, que SpotLocal examine de manière diligente et objective. Le
          retrait d'un Contenu ou la suspension d'un Service pour un motif imputable au Commerçant
          n'ouvre droit à aucun remboursement ni à aucune indemnité.
        </P>
      </Art>

      <Art n="14" title="Absence de garantie de résultat commercial">
        <P>
          SpotLocal est tenue d'une obligation de moyens dans l'exécution des Services. Elle ne
          souscrit aucune garantie de résultat quant à la visibilité de la Fiche, au positionnement
          de l'Établissement, au nombre de consultations, de Coupons validés ou de clients, à
          l'audience de la Plateforme, ni quant au chiffre d'affaires ou au retour sur
          investissement susceptible d'être généré par les Services. Les statistiques mises à la
          disposition du Commerçant ont une valeur purement indicative et ne sauraient fonder aucune
          réclamation.
        </P>
      </Art>

      <Art n="15" title="Responsabilité de SpotLocal">
        <P>
          SpotLocal ne pourra être tenue responsable que des dommages directs et prévisibles
          résultant d'un manquement prouvé à ses obligations contractuelles. Elle ne saurait en
          aucun cas être tenue de réparer les dommages indirects, tels que les pertes de chiffre
          d'affaires, de bénéfices, de clientèle, de chance ou de données, ou l'atteinte à l'image.
          En tout état de cause, et sauf faute lourde ou dolosive, la responsabilité totale et
          cumulée de SpotLocal, toutes causes confondues, est limitée au montant des sommes
          effectivement versées par le Commerçant au titre des Services au cours des douze mois
          précédant le fait générateur de responsabilité. SpotLocal ne saurait être tenue
          responsable de l'inexécution de ses obligations résultant d'un cas de force majeure au
          sens de l'article 1218 du Code civil, ni d'une défaillance des réseaux de communication ou
          des prestataires techniques tiers.
        </P>
      </Art>

      <Art n="16" title="Disponibilité de la Plateforme">
        <P>
          SpotLocal s'efforce d'assurer l'accessibilité de la Plateforme et de l'Espace Pro de
          manière continue, sous réserve des opérations de maintenance, de mise à jour et des
          interruptions indépendantes de sa volonté. Les interruptions temporaires n'ouvrent droit à
          aucune indemnité, sauf indisponibilité totale d'un Service payant d'une durée continue
          supérieure à soixante-douze heures imputable à SpotLocal, auquel cas la période
          d'indisponibilité est compensée par une prolongation équivalente du Service concerné.
        </P>
      </Art>

      <Art n="17" title="Données personnelles">
        <P>
          Les données personnelles relatives au Commerçant et à ses représentants sont traitées par
          SpotLocal aux fins de la gestion du compte, de l'exécution des Services, de la
          facturation, de la vérification des informations d'identification et de la prévention de
          la fraude, sur le fondement de l'exécution du contrat, du respect des obligations légales
          et de l'intérêt légitime de SpotLocal, dans les conditions décrites dans la politique de
          confidentialité de la Plateforme. Les données de facturation sont conservées pendant dix
          ans à compter de la clôture de l'exercice concerné, conformément à l'article L. 123-22 du
          Code de commerce. Les enregistrements de l'acceptation des présentes Conditions,
          mentionnés à l'article 2, sont conservés pendant toute la durée de la relation
          contractuelle puis pendant cinq ans à compter de son terme, aux fins de preuve,
          conformément à l'article L. 110-4 du Code de commerce, y compris en cas de suppression du
          compte. Les droits prévus par le RGPD s'exercent à l'adresse <V>{ID.emailRgpd}</V>. Le
          Commerçant s'engage à utiliser les informations relatives aux Utilisateurs auxquelles il
          pourrait avoir accès, notamment lors de la vérification d'un Coupon, aux seules fins de
          cette vérification, et à ne pas les collecter ni les conserver.
        </P>
      </Art>

      <Art n="18" title="Confidentialité">
        <P>
          Chaque Partie s'engage à conserver confidentielles les informations de nature technique,
          commerciale ou financière communiquées par l'autre Partie et signalées comme telles, ou
          dont le caractère confidentiel résulte de leur nature, et à ne les utiliser qu'aux fins de
          l'exécution des présentes, pendant toute la durée des relations contractuelles et pendant
          une durée de deux ans après leur cessation.
        </P>
      </Art>

      <Art n="19" title="Résiliation pour manquement">
        <P>
          En cas de manquement grave du Commerçant à ses obligations, et notamment en cas de
          publication de Contenus illicites, de pratique commerciale trompeuse, de déclaration
          inexacte relative à son identité ou à son pouvoir de représentation, ou de défaut de
          paiement, SpotLocal pourra résilier de plein droit les présentes Conditions, par
          notification adressée par courrier électronique, avec effet immédiat, ou à l'issue d'un
          délai de huit jours suivant une mise en demeure restée sans effet lorsque le manquement
          est susceptible d'être réparé, conformément aux articles 1224 et suivants du Code civil,
          sans préjudice de tous dommages et intérêts. La résiliation n'ouvre droit à aucun
          remboursement des sommes versées. Le Commerçant peut, à tout moment, supprimer sa Fiche et
          clôturer son compte, sous réserve des engagements fermes en cours.
        </P>
      </Art>

      <Art n="20" title="Modification des Conditions">
        <P>
          SpotLocal se réserve la faculté de modifier les présentes Conditions. Le Commerçant est
          informé de toute modification par courrier électronique ou par un avis au sein de l'Espace
          Pro au moins trente jours avant son entrée en vigueur, sauf modification imposée par une
          obligation légale ou réglementaire. Le Commerçant qui refuse les Conditions modifiées peut
          résilier son abonnement avant leur entrée en vigueur ; à défaut, la poursuite de
          l'utilisation des Services vaut acceptation des Conditions modifiées. Les commandes en
          cours demeurent régies par la version des Conditions en vigueur au jour de leur
          validation.
        </P>
      </Art>

      <Art n="21" title="Preuve">
        <P>
          Les Parties conviennent que les enregistrements informatiques conservés dans les systèmes
          de SpotLocal et de ses prestataires, et notamment l'enregistrement horodaté de
          l'acceptation des présentes Conditions, des commandes et des paiements, font foi entre
          elles et constituent une preuve admissible, conformément aux articles 1366 et 1368 du Code
          civil, sauf preuve contraire apportée par le Commerçant.
        </P>
      </Art>

      <Art n="22" title="Dispositions diverses">
        <P>
          Les présentes Conditions expriment l'intégralité des obligations des Parties relatives à
          leur objet. Le fait pour une Partie de ne pas se prévaloir d'un manquement de l'autre
          Partie ne saurait valoir renonciation à s'en prévaloir ultérieurement. Si l'une quelconque
          des stipulations des présentes était déclarée nulle ou inapplicable, elle serait réputée
          non écrite, les autres stipulations conservant toute leur force et leur portée. Le
          Commerçant ne peut céder ou transférer le bénéfice des présentes sans l'accord préalable
          et écrit de SpotLocal.
        </P>
      </Art>

      <Art n="23" title="Droit applicable et juridiction compétente">
        <P>
          Les présentes Conditions sont régies par le droit français. En cas de différend relatif à
          leur formation, leur interprétation, leur exécution ou leur cessation, les Parties
          s'efforceront de parvenir à une solution amiable. À défaut d'accord dans un délai de
          trente jours à compter de la notification du différend par la Partie la plus diligente, et
          sous réserve des règles impératives de compétence, tout litige sera soumis à la compétence
          exclusive du tribunal de commerce de <V>{ID.rcsVille}</V>, y compris en cas de référé,
          d'appel en garantie ou de pluralité de défendeurs, cette attribution de compétence
          s'appliquant aux Commerçants ayant la qualité de commerçant au sens de l'article 48 du
          Code de procédure civile.
        </P>
      </Art>

      <Updated />
    </>
  );
}

// ── Charte Espace Mairies & Collectivités ───────────────────────────────────────────────────

export function CharteMairies() {
  return (
    <>
      <P>
        La présente charte (ci-après la «&nbsp;Charte&nbsp;») définit les engagements souscrits par
        toute commune, tout établissement public de coopération intercommunale ou toute collectivité
        territoriale (ci-après la «&nbsp;Collectivité&nbsp;») utilisant l'Espace Mairie de la
        plateforme SpotLocal, éditée par <Editeur /> (ci-après «&nbsp;SpotLocal&nbsp;»), afin de
        diffuser des informations à destination des habitants et usagers de son territoire. Elle a
        pour objet de garantir que l'Espace Mairie demeure un outil d'information d'intérêt public,
        neutre, fiable et respectueux des droits des personnes.
      </P>

      <Art n="1" title="Objet et adhésion">
        <P>
          L'Espace Mairie permet à la Collectivité de publier des informations municipales, des
          alertes, des avis et des événements, et de les porter à la connaissance des Utilisateurs
          par leur affichage sur la Plateforme et, le cas échéant, par l'envoi de notifications aux
          Utilisateurs qui y ont consenti. L'utilisation de l'Espace Mairie emporte adhésion pleine
          et entière de la Collectivité à la présente Charte, que l'agent ou l'élu procédant à
          l'ouverture de l'accès déclare accepter au nom et pour le compte de la Collectivité, en
          vertu d'une habilitation régulière de l'autorité territoriale. Cette acceptation est
          matérialisée par le cochage, par chaque agent ou élu, de la case prévue à cet effet lors
          de sa première connexion à l'Espace Mairie et après toute modification substantielle de la
          Charte ; la date et l'heure, fixées par les serveurs de SpotLocal, la version de la Charte
          acceptée, l'adresse IP et le type de navigateur utilisés sont enregistrés par SpotLocal
          dans un journal non modifiable et conservés pendant toute la durée d'utilisation de
          l'Espace Mairie puis pendant cinq ans, aux fins de preuve.
        </P>
      </Art>

      <Art n="2" title="Habilitation et responsabilité des accès">
        <P>
          Les accès à l'Espace Mairie sont nominatifs et attribués aux seuls agents et élus désignés
          par l'autorité territoriale, sous l'autorité et la responsabilité de laquelle ils
          agissent. La Collectivité veille à la confidentialité des identifiants, à la mise à jour
          de la liste des personnes habilitées et à la révocation sans délai des accès des personnes
          ayant cessé leurs fonctions. Toute publication effectuée au moyen d'un accès de la
          Collectivité est réputée émaner de celle-ci.
        </P>
      </Art>

      <Art n="3" title="Information d'intérêt public">
        <P>
          La Collectivité s'engage à n'utiliser l'Espace Mairie qu'aux fins de diffuser des
          informations présentant un caractère d'intérêt public local, relatives notamment au
          fonctionnement et aux horaires des services publics, aux travaux, à la circulation et au
          stationnement, à la sécurité et à la salubrité publiques, aux alertes météorologiques et
          aux risques majeurs, à la vie culturelle, sportive et associative, aux démarches
          administratives ainsi qu'aux manifestations organisées ou soutenues par la Collectivité.
          L'Espace Mairie ne saurait être utilisé à des fins commerciales, personnelles ou
          étrangères aux missions de service public de la Collectivité.
        </P>
      </Art>

      <Art n="4" title="Neutralité politique">
        <P>
          En application du principe de neutralité du service public, la Collectivité s'engage à ce
          que les informations publiées depuis l'Espace Mairie présentent un caractère strictement
          informatif et neutre. Elle s'interdit d'y diffuser tout contenu de propagande ou de
          communication à caractère politique, électoral, partisan, syndical ou religieux, tout
          contenu valorisant ou dénigrant un élu, un candidat, un parti ou un groupement politique,
          ainsi que toute prise de position sur un débat électoral.
        </P>
        <P>
          La Collectivité s'engage en particulier à respecter les dispositions du Code électoral et
          notamment son article L. 52-1, aux termes duquel aucune campagne de promotion publicitaire
          des réalisations ou de la gestion d'une collectivité ne peut être organisée sur le
          territoire des collectivités intéressées par le scrutin à compter du premier jour du
          sixième mois précédant le mois au cours duquel il doit être procédé à des élections
          générales, ainsi que son article L. 52-8, qui prohibe toute participation des personnes
          morales, à l'exception des partis ou groupements politiques, au financement de la campagne
          électorale d'un candidat, y compris sous la forme d'avantages en nature. Durant les
          périodes préélectorales, la Collectivité limite ses publications aux informations
          pratiques et factuelles nécessaires au fonctionnement des services publics.
        </P>
        <P>
          La Collectivité s'engage également à respecter l'égalité de traitement entre les acteurs
          économiques et associatifs de son territoire et s'interdit de recommander ou de favoriser
          nommément un commerçant ou une entreprise déterminée au détriment des autres, hors
          communication institutionnelle relative à un dispositif public ouvert à tous.
        </P>
      </Art>

      <Art n="5" title="Exactitude, actualité et loyauté des informations">
        <P>
          La Collectivité s'engage à publier des informations exactes, vérifiées, claires et
          actualisées, à en indiquer la date et, le cas échéant, la durée de validité, et à procéder
          sans délai à la correction ou au retrait de toute information devenue inexacte ou
          obsolète. Les informations publiées sur l'Espace Mairie ne se substituent pas aux actes
          administratifs et publications officielles de la Collectivité, qui seuls font foi, et la
          Collectivité veille à ce qu'aucune confusion ne puisse naître à cet égard.
        </P>
      </Art>

      <Art n="6" title="Protection des données personnelles des administrés">
        <P>
          La Collectivité s'interdit de publier, sur l'Espace Mairie, toute donnée à caractère
          personnel relative à des administrés, agents ou tiers, et notamment toute information
          relative à l'état civil, à la santé, à la situation sociale ou fiscale ou aux infractions,
          en l'absence de base légale et de nécessité au regard d'une mission d'intérêt public,
          conformément au règlement (UE) 2016/679 et à la loi n° 78-17 du 6 janvier 1978. Toute
          diffusion de l'image d'une personne identifiable est subordonnée au recueil préalable de
          son autorisation ou, s'agissant d'un mineur, de celle des titulaires de l'autorité
          parentale. La Collectivité demeure responsable des traitements de données qu'elle met en
          œuvre pour l'exercice de ses missions et s'appuie, le cas échéant, sur son délégué à la
          protection des données.
        </P>
      </Art>

      <Art n="7" title="Propriété intellectuelle">
        <P>
          La Collectivité garantit disposer de l'ensemble des droits de propriété intellectuelle et
          autorisations nécessaires à la diffusion des textes, photographies, logos, affiches et
          visuels qu'elle publie, et garantit SpotLocal contre toute réclamation de tiers à ce
          titre. Elle concède à SpotLocal, à titre gratuit et non exclusif, pour la durée de son
          utilisation de l'Espace Mairie, le droit de reproduire, représenter et adapter ces
          contenus aux seules fins de leur diffusion sur la Plateforme et dans les notifications
          adressées aux Utilisateurs.
        </P>
      </Art>

      <Art n="8" title="Accessibilité et clarté">
        <P>
          Consciente des obligations d'accessibilité des services de communication au public en
          ligne qui lui incombent en application de l'article 47 de la loi n° 2005-102 du 11 février
          2005, la Collectivité s'attache à rédiger ses informations dans un langage clair et
          compréhensible par tous, à éviter la diffusion d'informations essentielles sous la seule
          forme d'images comportant du texte, et à accompagner les visuels d'une description
          textuelle de leur contenu.
        </P>
      </Art>

      <Art n="9" title="Usage des alertes et notifications">
        <P>
          La Collectivité s'engage à faire un usage proportionné des fonctionnalités d'alerte et de
          notification, en les réservant aux informations présentant un caractère d'utilité réelle
          pour les Utilisateurs, et notamment aux situations d'urgence, aux risques pour la sécurité
          des personnes et aux perturbations significatives des services publics, et à s'abstenir de
          toute sollicitation excessive ou répétée de nature à dénaturer ces fonctionnalités. Les
          notifications ne sont adressées qu'aux seuls Utilisateurs ayant préalablement consenti à
          leur réception.
        </P>
      </Art>

      <Art n="10" title="Responsabilité éditoriale">
        <P>
          La Collectivité a la qualité d'éditeur des contenus qu'elle publie sur l'Espace Mairie et
          en assume l'entière responsabilité éditoriale, le directeur de la publication de ces
          contenus étant l'autorité territoriale ou l'élu qu'elle a désigné à cet effet. SpotLocal
          intervient en qualité de fournisseur de services d'hébergement au sens de l'article 6 du
          règlement (UE) 2022/2065 et n'exerce aucun contrôle préalable sur ces contenus, dont elle
          ne saurait être tenue pour responsable.
        </P>
      </Art>

      <Art n="11" title="Modération et suspension">
        <P>
          SpotLocal se réserve le droit de retirer, sans préavis, tout contenu manifestement
          illicite ou contraire à la présente Charte, et notamment tout contenu méconnaissant le
          principe de neutralité politique ou les dispositions du Code électoral, et de suspendre
          l'accès de la Collectivité à l'Espace Mairie en cas de manquement grave ou réitéré. Toute
          mesure de retrait ou de suspension est notifiée à la Collectivité par une décision
          motivée, à laquelle celle-ci peut répondre par une réclamation adressée à l'adresse{" "}
          <V>{ID.emailContact}</V>.
        </P>
      </Art>

      <Art n="12" title="Conditions financières, durée et modification">
        <P>
          Les éventuelles conditions financières de l'utilisation de l'Espace Mairie font, le cas
          échéant, l'objet d'une convention distincte conclue avec la Collectivité dans le respect
          des règles de la commande publique. La présente Charte s'applique pour toute la durée
          d'utilisation de l'Espace Mairie. SpotLocal peut la modifier, la Collectivité étant
          informée de toute modification substantielle au moins trente jours avant son entrée en
          vigueur ; la poursuite de l'utilisation de l'Espace Mairie au-delà de cette date vaut
          acceptation de la Charte modifiée. La Collectivité peut cesser à tout moment d'utiliser
          l'Espace Mairie et solliciter la fermeture de ses accès.
        </P>
      </Art>

      <Art n="13" title="Droit applicable et règlement des différends">
        <P>
          La présente Charte est régie par le droit français. Les parties s'engagent à rechercher
          une solution amiable à tout différend relatif à son interprétation ou à son exécution
          avant toute action contentieuse. À défaut d'accord, le différend sera porté devant la
          juridiction compétente.
        </P>
      </Art>

      <Updated />
    </>
  );
}

const DOCUMENTS: Record<LegalDocKey, () => ReactNode> = {
  mentions: MentionsLegales,
  cgu: CguParticuliers,
  "cgv-pro": CgvPro,
  "charte-mairies": CharteMairies,
};

/** Corps complet d'un document juridique, prêt à être placé dans une page ou une modale. */
export function LegalDocument({ doc }: { doc: LegalDocKey }) {
  const Document = DOCUMENTS[doc];
  return (
    <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
      <Document />
    </div>
  );
}
