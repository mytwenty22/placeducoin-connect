import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { downloadPosterPdf, type PosterCommerce } from "@/lib/poster-pdf";

export function PosterButton({ commerce }: { commerce: PosterCommerce }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const { logoIncluded } = await downloadPosterPdf(commerce);
          if (logoIncluded) {
            toast.success("Affiche vitrine téléchargée — prête à imprimer en A4.");
          } else {
            toast.warning(
              "Affiche téléchargée sans votre logo (image inaccessible). Ré-importez-le depuis Mon Profil puis relancez l'impression.",
            );
          }
        } catch (error) {
          toast.error(`Impossible de générer l'affiche : ${(error as Error).message}`);
        } finally {
          setPending(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-navy/30 bg-card px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-secondary disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      {pending ? "Génération du PDF…" : "Imprimer mon affiche vitrine"}
    </button>
  );
}
