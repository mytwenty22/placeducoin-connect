import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, GitMerge, MapPin, Pencil, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type QuartierRow = {
  id: string;
  nom: string;
  code_postal: string;
  ville_id: string;
  created_by: string | null;
  created_at: string;
  villes: { nom: string } | { nom: string }[] | null;
};

type Quartier = Omit<QuartierRow, "villes"> & { villeNom: string };

type Action = { id: string; kind: "rename" | "merge" } | null;

const QUARTIERS_KEY = ["admin-quartiers"];
const NO_QUARTIERS: Quartier[] = [];

/**
 * Modération des quartiers créés par les comptes Pro et Association : renommer (faute de
 * frappe), fusionner un doublon dans le bon quartier (les fiches suivent), ou supprimer.
 */
export function AdminQuartiers() {
  const queryClient = useQueryClient();
  const [villeFilter, setVilleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [draft, setDraft] = useState("");

  const quartiersQuery = useQuery({
    queryKey: QUARTIERS_KEY,
    queryFn: async (): Promise<Quartier[]> => {
      const { data, error } = await supabase
        .from("quartiers")
        .select("id, nom, code_postal, ville_id, created_by, created_at, villes(nom)")
        .order("nom");
      if (error) throw error;
      return (data as QuartierRow[]).map(({ villes, ...q }) => {
        const ville = Array.isArray(villes) ? villes[0] : villes;
        return { ...q, villeNom: ville?.nom ?? "—" };
      });
    },
  });

  // Nombre de fiches par quartier et nom de la fiche du créateur (pour savoir qui l'a ajouté).
  const commercesQuery = useQuery({
    queryKey: ["admin-quartiers-commerces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commerces").select("nom, owner_id, quartier_id");
      if (error) throw error;
      return data as { nom: string; owner_id: string | null; quartier_id: string | null }[];
    },
  });

  const { countByQuartier, commerceByOwner } = useMemo(() => {
    const counts = new Map<string, number>();
    const owners = new Map<string, string>();
    for (const c of commercesQuery.data ?? []) {
      if (c.quartier_id) counts.set(c.quartier_id, (counts.get(c.quartier_id) ?? 0) + 1);
      if (c.owner_id && !owners.has(c.owner_id)) owners.set(c.owner_id, c.nom);
    }
    return { countByQuartier: counts, commerceByOwner: owners };
  }, [commercesQuery.data]);

  const quartiers = quartiersQuery.data ?? NO_QUARTIERS;
  const villes = useMemo(
    () =>
      [...new Map(quartiers.map((q) => [q.ville_id, q.villeNom])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1], "fr"),
      ),
    [quartiers],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return quartiers
      .filter((q) => !villeFilter || q.ville_id === villeFilter)
      .filter(
        (q) =>
          !needle ||
          q.nom.toLocaleLowerCase("fr").includes(needle) ||
          q.code_postal.includes(needle),
      )
      .sort(
        (a, b) => a.villeNom.localeCompare(b.villeNom, "fr") || a.nom.localeCompare(b.nom, "fr"),
      );
  }, [quartiers, villeFilter, search]);

  const refresh = () => {
    setAction(null);
    setDraft("");
    void queryClient.invalidateQueries({ queryKey: QUARTIERS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["admin-quartiers-commerces"] });
  };

  const renameMutation = useMutation({
    mutationFn: async ({ id, nom }: { id: string; nom: string }) => {
      const { error } = await supabase.rpc("admin_rename_quartier", {
        p_quartier_id: id,
        p_nom: nom,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Quartier renommé");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      const { data, error } = await supabase.rpc("admin_merge_quartier", {
        p_source_id: sourceId,
        p_target_id: targetId,
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (moved) => {
      toast.success(
        `Quartiers fusionnés (${moved} fiche${moved > 1 ? "s" : ""} déplacée${moved > 1 ? "s" : ""})`,
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quartiers").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Quartier supprimé");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = renameMutation.isPending || mergeMutation.isPending || deleteMutation.isPending;

  return (
    <section>
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-navy" />
        <h2 className="font-display text-lg font-extrabold text-foreground">Quartiers</h2>
        {quartiersQuery.data ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {quartiers.length} quartier{quartiers.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Créés par les commerçants et associations. Fusionnez un doublon dans le bon quartier : ses
        fiches y sont déplacées. Supprimer un quartier retire seulement le quartier des fiches.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select
          value={villeFilter}
          onChange={(e) => setVilleFilter(e.target.value)}
          aria-label="Filtrer par ville"
          className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
        >
          <option value="">Toutes les villes</option>
          {villes.map(([id, nom]) => (
            <option key={id} value={id}>
              {nom}
            </option>
          ))}
        </select>
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou code postal"
            aria-label="Rechercher un quartier"
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-navy"
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {quartiersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : null}
        {quartiersQuery.isError ? (
          <p className="text-sm text-destructive">{(quartiersQuery.error as Error).message}</p>
        ) : null}
        {quartiersQuery.data && visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {quartiers.length === 0 ? "Aucun quartier pour le moment." : "Aucun quartier trouvé."}
          </p>
        ) : null}

        {visible.map((q) => {
          const count = countByQuartier.get(q.id) ?? 0;
          const creator = q.created_by ? commerceByOwner.get(q.created_by) : undefined;
          const isRenaming = action?.id === q.id && action.kind === "rename";
          const isMerging = action?.id === q.id && action.kind === "merge";
          const mergeTargets = quartiers.filter((o) => o.ville_id === q.ville_id && o.id !== q.id);

          return (
            <article key={q.id} className="surface-card p-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (draft.trim()) renameMutation.mutate({ id: q.id, nom: draft });
                      }}
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={60}
                        aria-label="Nouveau nom"
                        className="min-w-0 flex-1 rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-navy"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        aria-label="Enregistrer"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAction(null)}
                        aria-label="Annuler"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <p className="truncate font-semibold text-foreground">{q.nom}</p>
                  )}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {q.villeNom} ({q.code_postal}) · {count} fiche{count > 1 ? "s" : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {creator
                      ? `Ajouté par ${creator}`
                      : q.created_by
                        ? "Ajouté par un compte sans fiche"
                        : "Ajouté par l'équipe"}
                    {" · "}
                    {new Date(q.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>

                {!isRenaming ? (
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Renommer"
                      disabled={busy}
                      onClick={() => {
                        setAction({ id: q.id, kind: "rename" });
                        setDraft(q.nom);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label="Fusionner"
                      disabled={busy || mergeTargets.length === 0}
                      onClick={() => {
                        setAction(isMerging ? null : { id: q.id, kind: "merge" });
                        setDraft("");
                      }}
                    >
                      <GitMerge className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label="Supprimer"
                      danger
                      disabled={busy}
                      onClick={() => {
                        const detail =
                          count > 0 ? `\n${count} fiche(s) n'auront plus de quartier.` : "";
                        if (window.confirm(`Supprimer le quartier « ${q.nom} » ?${detail}`)) {
                          deleteMutation.mutate(q.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                ) : null}
              </div>

              {isMerging ? (
                <form
                  className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft) mergeMutation.mutate({ sourceId: q.id, targetId: draft });
                  }}
                >
                  <span className="text-xs font-semibold text-muted-foreground">
                    Fusionner dans
                  </span>
                  <select
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Quartier de destination"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-navy"
                  >
                    <option value="">Choisir un quartier…</option>
                    {mergeTargets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nom} ({o.code_postal})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy || !draft}
                      className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                    >
                      Fusionner
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction(null)}
                      className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-full disabled:opacity-40 ${
        danger
          ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "bg-secondary text-foreground hover:bg-secondary/70"
      }`}
    >
      {children}
    </button>
  );
}
