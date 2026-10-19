import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import type { Ville } from "@/hooks/use-villes";

// Menu déroulant des communes (recherche par nom ou code postal), commun à la Marketplace et à
// l'Espace Pro. Toutes les communes sont listées (liste défilante) : chacun peut passer librement
// de l'une à l'autre.
export function CitySelect({
  villes,
  loading,
  selected,
  onSelect,
  className = "",
  buttonClassName = "",
}: {
  villes: Ville[];
  loading: boolean;
  selected: Ville | null;
  onSelect: (ville: Ville) => void;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

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

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return villes.filter(
      (v) =>
        v.nom.toLowerCase().includes(q) ||
        (/^\d+$/.test(q) && v.codes_postaux.some((cp) => cp.startsWith(q))),
    );
  }, [villes, query]);

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
        <span className="min-w-0 flex-1 truncate">{selected?.nom ?? "Choisir une ville"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full min-w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ville, village ou code postal…"
            className="w-full border-b border-border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
          />
          <ul role="listbox" className="max-h-56 overflow-auto py-1">
            {suggestions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={v.id === selected?.id}
                  onClick={() => {
                    onSelect(v);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-secondary ${
                    v.id === selected?.id ? "font-bold" : ""
                  }`}
                >
                  {v.nom}
                </button>
              </li>
            ))}
            {loading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Chargement…</li>
            ) : null}
            {!loading && suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Aucune commune</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
