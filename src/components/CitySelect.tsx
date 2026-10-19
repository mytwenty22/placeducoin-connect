import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { useAllQuartiers, type CityOption, type Ville } from "@/hooks/use-villes";
import { searchCommunes } from "@/lib/communes";
import { normalizeSearch } from "@/lib/utils";

type Row = { key: string; label: string; detail: string; option: CityOption };

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("fr") + value.slice(1);
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// Menu de ville commun à la Marketplace et à l'Espace Pro. Une seule zone de saisie, trois
// sources de résultats :
//   1. les communes SpotLocal, par nom (sans accents) ou par code postal ; une commune à plusieurs
//      codes postaux propose aussi chaque code (ex. Bordeaux 33200) ;
//   2. les quartiers, par nom ou code postal (ex. « chartrons ») ;
//   3. toutes les autres communes de France (geo.api.gouv.fr) par nom ou code postal complet
//      (ex. 33400 Talence) : la Marketplace affiche alors les bons plans des alentours.
// Entrée sélectionne le premier résultat.
export function CitySelect({
  villes,
  loading,
  selected,
  selectedDetail = null,
  onChoose,
  className = "",
  buttonClassName = "",
}: {
  villes: Ville[];
  loading: boolean;
  selected: Ville | null;
  /** Précision affichée après le nom (quartier ou code postal choisi). */
  selectedDetail?: string | null;
  onChoose: (option: CityOption) => void;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const quartiersQuery = useAllQuartiers();

  // Fermeture au clic à l'extérieur ou avec Échap.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const q = normalizeSearch(query);
  const digits = query.replace(/\s/g, "");
  const isDigits = /^\d+$/.test(digits);

  const debouncedQuery = useDebounced(query.trim(), 250);
  const externalQuery = useQuery({
    queryKey: ["communes-search", debouncedQuery],
    queryFn: () => searchCommunes(debouncedQuery),
    enabled: open && debouncedQuery.length >= 3,
    staleTime: 10 * 60 * 1000,
  });

  const sections = useMemo(() => {
    const local: Row[] = [];
    for (const v of villes) {
      if (!q) {
        local.push({
          key: v.id,
          label: v.nom,
          detail: "",
          option: { kind: "ville", ville: v, codePostal: null },
        });
        continue;
      }
      if (isDigits) {
        const matched = v.codes_postaux.filter((cp) => cp.startsWith(digits));
        if (matched.length === 0) continue;
        if (v.codes_postaux.length > 1) {
          if (matched.length > 1 || digits.length < 5) {
            local.push({
              key: v.id,
              label: v.nom,
              detail: "Toute la commune",
              option: { kind: "ville", ville: v, codePostal: null },
            });
          }
          for (const cp of matched) {
            local.push({
              key: `${v.id}:${cp}`,
              label: v.nom,
              detail: cp,
              option: { kind: "ville", ville: v, codePostal: cp },
            });
          }
        } else {
          local.push({
            key: v.id,
            label: v.nom,
            detail: matched[0]!,
            option: { kind: "ville", ville: v, codePostal: null },
          });
        }
      } else if (normalizeSearch(v.nom).includes(q)) {
        local.push({
          key: v.id,
          label: v.nom,
          detail: "",
          option: { kind: "ville", ville: v, codePostal: null },
        });
      }
    }

    const quartiers: Row[] = [];
    if (q && (isDigits || q.length >= 2)) {
      for (const quartier of quartiersQuery.data ?? []) {
        const ville = villes.find((v) => v.id === quartier.ville_id);
        if (!ville) continue;
        const match = isDigits
          ? quartier.code_postal.startsWith(digits)
          : normalizeSearch(quartier.nom).includes(q);
        if (!match) continue;
        quartiers.push({
          key: `q:${quartier.id}`,
          label: capitalize(quartier.nom),
          detail: `${quartier.code_postal} · ${ville.nom}`,
          option: { kind: "quartier", ville, quartier },
        });
      }
    }

    // Communes du référentiel absentes de SpotLocal (les autres sont déjà listées ci-dessus).
    const known = new Set(villes.map((v) => v.insee_code).filter(Boolean));
    const external: Row[] =
      q && debouncedQuery === query.trim()
        ? (externalQuery.data ?? [])
            .filter((c) => !known.has(c.code) && c.centre)
            .map((c) => {
              const cp = isDigits && digits.length === 5 ? digits : null;
              return {
                key: `insee:${c.code}`,
                label: c.nom,
                detail: cp ?? c.codesPostaux.slice(0, 2).join(", "),
                option: {
                  kind: "external" as const,
                  commune: { insee: c.code, nom: c.nom, lat: c.centre!.lat, lng: c.centre!.lng },
                  codePostal: cp,
                },
              };
            })
        : [];

    return { local, quartiers, external };
  }, [villes, q, isDigits, digits, quartiersQuery.data, externalQuery.data, debouncedQuery, query]);

  const rows = [...sections.local, ...sections.quartiers, ...sections.external];
  const searchingExternal =
    q.length > 0 &&
    query.trim().length >= 3 &&
    (externalQuery.isFetching || debouncedQuery !== query.trim());

  function choose(row: Row) {
    onChoose(row.option);
    setOpen(false);
    setQuery("");
  }

  function renderSection(title: string, list: Row[], hint?: string) {
    if (list.length === 0) return null;
    return (
      <>
        {q ? (
          <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {title}
          </li>
        ) : null}
        {list.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              role="option"
              aria-selected={row.option.kind !== "external" && row.option.ville.id === selected?.id}
              onClick={() => choose(row)}
              className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm text-popover-foreground hover:bg-secondary"
            >
              <span
                className={`min-w-0 truncate ${
                  row.option.kind !== "external" && row.option.ville.id === selected?.id && !q
                    ? "font-bold"
                    : ""
                }`}
              >
                {row.label}
              </span>
              {row.detail ? (
                <span className="shrink-0 text-xs text-muted-foreground">{row.detail}</span>
              ) : null}
            </button>
          </li>
        ))}
        {hint ? <li className="px-3 pb-2 text-[11px] text-muted-foreground">{hint}</li> : null}
      </>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-xl bg-card px-3 py-3 text-left text-sm font-semibold text-foreground shadow-card ${buttonClassName}`}
      >
        <MapPin className="h-4 w-4 shrink-0 text-promo" />
        <span className="min-w-0 flex-1 truncate">
          {selected
            ? `${selected.nom}${selectedDetail ? ` · ${selectedDetail}` : ""}`
            : "Choisir une ville"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full min-w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && rows[0]) {
                e.preventDefault();
                choose(rows[0]);
              }
            }}
            placeholder="Ville, code postal ou quartier…"
            aria-label="Rechercher une ville, un code postal ou un quartier"
            className="w-full border-b border-border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
          />
          <ul role="listbox" className="max-h-72 overflow-auto py-1">
            {renderSection("Communes SpotLocal", sections.local)}
            {renderSection("Quartiers", sections.quartiers)}
            {renderSection(
              "Autres communes",
              sections.external,
              "Pas encore de commerce inscrit : affiche les bons plans des alentours.",
            )}
            {loading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Chargement…</li>
            ) : null}
            {searchingExternal ? (
              <li className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche dans toutes les communes…
              </li>
            ) : null}
            {!loading && !searchingExternal && rows.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {isDigits && digits.length < 5
                  ? "Continuez la saisie du code postal (5 chiffres)…"
                  : "Aucune commune, aucun code postal ni quartier trouvé."}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
