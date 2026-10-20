import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LegalDocument } from "@/components/legal/LegalDocuments";
import { LEGAL_DOCS, type LegalDocKey } from "@/lib/legal";

/** Lecture d'un document juridique sans quitter la page (ex. formulaire d'inscription Pro). */
export function LegalDocumentDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: LegalDocKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const meta = LEGAL_DOCS.find((d) => d.key === doc);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle className="font-display text-lg">{meta?.title}</DialogTitle>
          <DialogDescription>
            <Link
              to="/legal"
              search={{ doc }}
              target="_blank"
              className="font-semibold text-navy hover:underline"
            >
              Ouvrir dans un nouvel onglet
            </Link>
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-5 py-5">
          <LegalDocument doc={doc} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
