import { useState, type ReactNode } from "react";
import { LegalDocumentDialog } from "@/components/legal/LegalDocumentDialog";
import type { LegalDocKey } from "@/lib/legal";

type CheckboxProps = { checked: boolean; onChange: (checked: boolean) => void };

/**
 * Case obligatoire d'acceptation d'un document juridique. Le lien ouvre le texte dans une modale
 * pour ne pas perdre la saisie du formulaire.
 */
function TermsCheckbox({
  id,
  doc,
  before,
  linkLabel,
  after,
  checked,
  onChange,
}: CheckboxProps & {
  id: string;
  doc: LegalDocKey;
  before: ReactNode;
  linkLabel: string;
  after: ReactNode;
}) {
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3">
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
      />
      <label htmlFor={id} className="text-xs leading-relaxed text-foreground">
        {before}{" "}
        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="font-semibold text-navy underline hover:no-underline"
        >
          {linkLabel}
        </button>{" "}
        {after} *
      </label>
      <LegalDocumentDialog doc={doc} open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
}

/** CGU/CGV Espace Pro et pouvoir de représentation (inscription et création de fiche). */
export function ProTermsCheckbox(props: CheckboxProps) {
  return (
    <TermsCheckbox
      {...props}
      id="pro-terms"
      doc="cgv-pro"
      before="J'accepte les"
      linkLabel="CGU/CGV Espace Pro"
      after="et je certifie avoir le pouvoir de représenter cet établissement."
    />
  );
}

/** Charte Espace Mairies et habilitation de l'agent (première connexion à l'Espace Mairie). */
export function CharteMairiesCheckbox(props: CheckboxProps) {
  return (
    <TermsCheckbox
      {...props}
      id="charte-mairies"
      doc="charte-mairies"
      before="J'accepte la"
      linkLabel="Charte Espace Mairies & Collectivités"
      after="au nom de ma collectivité et je certifie être habilité(e) à la représenter."
    />
  );
}
