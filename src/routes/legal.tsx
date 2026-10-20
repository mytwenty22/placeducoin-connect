import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { LegalDocument } from "@/components/legal/LegalDocuments";
import { isLegalDocKey, LEGAL_DOCS, type LegalDocKey } from "@/lib/legal";

export const Route = createFileRoute("/legal")({
  validateSearch: (search: Record<string, unknown>): { doc: LegalDocKey } => ({
    doc: isLegalDocKey(search["doc"]) ? search["doc"] : "mentions",
  }),
  head: () => ({
    meta: [
      { title: "Informations légales — SpotLocal" },
      {
        name: "description",
        content:
          "Mentions légales, conditions générales d'utilisation, politique de confidentialité, CGV de l'Espace Pro et charte de l'Espace Mairies de SpotLocal.",
      },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  const { doc } = Route.useSearch();
  const current = LEGAL_DOCS.find((d) => d.key === doc) ?? LEGAL_DOCS[0];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <nav aria-label="Documents juridiques" className="flex flex-wrap gap-2">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.key}
              to="/legal"
              search={{ doc: d.key }}
              aria-current={d.key === doc ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                d.key === doc
                  ? "bg-navy text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {d.short}
            </Link>
          ))}
        </nav>

        <article className="surface-card space-y-6 p-5 sm:p-8">
          <h1 className="font-display text-2xl font-extrabold text-foreground">{current.title}</h1>
          <LegalDocument doc={doc} />
        </article>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="font-semibold text-navy hover:underline">
            Retour à la Marketplace
          </Link>
        </p>
      </div>
    </div>
  );
}
