import { useState } from "react";
import { LegalDocumentDialog } from "@/components/legal/LegalDocumentDialog";

/**
 * Case obligatoire d'acceptation des CGU/CGV Espace Pro et de certification du pouvoir de
 * représentation (inscription et création de fiche). Le lien ouvre le texte dans une modale pour
 * ne pas perdre la saisie du formulaire.
 */
export function ProTermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3">
      <input
        id="pro-terms"
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
      />
      <label htmlFor="pro-terms" className="text-xs leading-relaxed text-foreground">
        J'accepte les{" "}
        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="font-semibold text-navy underline hover:no-underline"
        >
          CGU/CGV Espace Pro
        </button>{" "}
        et je certifie avoir le pouvoir de représenter cet établissement. *
      </label>
      <LegalDocumentDialog doc="cgv-pro" open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
}
