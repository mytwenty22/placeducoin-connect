import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Ban,
  Eye,
  ExternalLink,
  KeyRound,
  Pencil,
  RotateCcw,
  Search,
  Store,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isBoostActive } from "@/lib/boost";

type FicheRow = {
  commerce_id: string;
  nom: string;
  slug: string;
  trade: string | null;
  category: string;
  ville_id: string | null;
  ville_nom: string | null;
  adresse: string | null;
  telephone: string | null;
  description: string | null;
  site_actif: boolean;
  boost_actif: boolean;
  boost_expires_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  owner_id: string | null;
  email: string | null;
  role: string | null;
  verification_status: string | null;
  siret: string | null;
  rna: string | null;
  legal_name: string | null;
  // Fusionnés depuis commerces (admin_list_fiches ne les renvoie pas).
  masquee_at?: string | null;
  masquage_motif?: string | null;
};

type Masquage = { id: string; masquee_at: string; masquage_motif: string | null };

type Status = "pending" | "validated" | "masked" | "suspended";
type AccountType = "pro" | "free" | "association";

const STATUS_META: Record<Status, { label: string; className: string }> = {
  pending: { label: "En attente de vérification", className: "bg-amber-100 text-amber-800" },
  validated: { label: "Validé", className: "bg-emerald-100 text-emerald-800" },
  masked: { label: "Masquée", className: "bg-slate-200 text-slate-700" },
  suspended: { label: "Suspendu", className: "bg-red-100 text-red-700" },
};

const MASQUAGE_MOTIFS: Record<string, string> = {
  hors_perimetre: "hors périmètre du lancement",
  fermee_ou_remplacee: "commerce fermé ou local repris",
};

const TYPE_META: Record<AccountType, string> = {
  pro: "Commerçant Pro",
  free: "Gratuit",
  association: "Association",
};

function statusOf(f: FicheRow): Status {
  if (f.suspended_at) return "suspended";
  if (f.masquee_at) return "masked";
  return f.verification_status === "verifie" ? "validated" : "pending";
}

// "Commerçant Pro" = une option payante en cours (Site Pro ou Vedette) ; une association reste
// une association même si elle a pris une option.
function typeOf(f: FicheRow): AccountType {
  if (f.role === "association") return "association";
  return f.site_actif || isBoostActive(f) ? "pro" : "free";
}

const LIST_KEY = ["admin-fiches"];
const MASQUAGE_KEY = ["admin-fiches-masquage"];
const PAGE_SIZE = 1000;

/**
 * Toutes les fiches, par pages de 1000 : l'API Supabase plafonne chaque réponse à 1000 lignes
 * (max_rows), y compris pour un RPC. Sans pagination, les fiches les plus anciennes (tri par date
 * décroissante) disparaissaient de la liste et de la recherche. Le tri secondaire par id rend
 * l'ordre stable entre deux pages (les imports en masse partagent la même date de création).
 */
async function fetchAllFiches(): Promise<FicheRow[]> {
  const rows = new Map<string, FicheRow>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("admin_list_fiches")
      .order("created_at", { ascending: false })
      .order("commerce_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as FicheRow[];
    for (const row of page) rows.set(row.commerce_id, row);
    if (page.length < PAGE_SIZE) return [...rows.values()];
  }
}

/** Fiches masquées (lisibles par un admin via la policy de lecture), par pages de 1000. */
async function fetchMasquages(): Promise<Masquage[]> {
  const rows: Masquage[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("commerces")
      .select("id, masquee_at, masquage_motif")
      .not("masquee_at", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Masquage[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/**
 * Gestion des fiches commerçants et associations : statut, validation, modification et
 * suspension en un clic, filtres par ville, type de compte et statut.
 */
export function AdminFiches() {
  const queryClient = useQueryClient();
  const [villeFilter, setVilleFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [passwordId, setPasswordId] = useState<string | null>(null);

  const fichesQuery = useQuery({ queryKey: LIST_KEY, queryFn: fetchAllFiches });

  const statusMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      action: "validate" | "suspend" | "reactivate";
      reason?: string;
    }) => {
      const { error } = await supabase.rpc("admin_set_fiche_status", {
        p_commerce_id: input.id,
        p_action: input.action,
        p_reason: input.reason ?? null,
      });
      if (error) throw new Error(error.message);
      return input.action;
    },
    onSuccess: (action) => {
      toast.success(
        action === "validate"
          ? "Fiche validée"
          : action === "suspend"
            ? "Fiche suspendue : elle n'apparaît plus sur le site"
            : "Fiche réactivée",
      );
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const masquageQuery = useQuery({ queryKey: MASQUAGE_KEY, queryFn: fetchMasquages });

  const unmaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_unmask_fiche", { p_commerce_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Fiche réaffichée : elle est de nouveau visible sur le site");
      void queryClient.invalidateQueries({ queryKey: MASQUAGE_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const fiches = useMemo(() => {
    const masked = new Map((masquageQuery.data ?? []).map((m) => [m.id, m]));
    return (fichesQuery.data ?? []).map((f) => {
      const m = masked.get(f.commerce_id);
      return m ? { ...f, masquee_at: m.masquee_at, masquage_motif: m.masquage_motif } : f;
    });
  }, [fichesQuery.data, masquageQuery.data]);

  const villes = useMemo(
    () =>
      [
        ...new Map(fiches.filter((f) => f.ville_id).map((f) => [f.ville_id!, f.ville_nom ?? "—"])),
      ].sort((a, b) => a[1].localeCompare(b[1], "fr")),
    [fiches],
  );

  // Fiches filtrées par ville / type / recherche, avant le filtre de statut (pour les compteurs).
  const scoped = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return fiches.filter(
      (f) =>
        (!villeFilter || f.ville_id === villeFilter) &&
        (!typeFilter || typeOf(f) === typeFilter) &&
        (!needle ||
          [f.nom, f.slug, f.email, f.trade, f.siret, f.rna, f.legal_name].some((v) =>
            v?.toLocaleLowerCase("fr").includes(needle),
          )),
    );
  }, [fiches, villeFilter, typeFilter, search]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { pending: 0, validated: 0, masked: 0, suspended: 0 };
    for (const f of scoped) c[statusOf(f)]++;
    return c;
  }, [scoped]);

  const visible = statusFilter ? scoped.filter((f) => statusOf(f) === statusFilter) : scoped;
  const busy = statusMutation.isPending || unmaskMutation.isPending;

  return (
    <section>
      <div className="flex items-center gap-2">
        <Store className="h-5 w-5 text-navy" />
        <h2 className="font-display text-lg font-extrabold text-foreground">
          Commerçants & associations
        </h2>
        {fichesQuery.data ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {fiches.length} fiche{fiches.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <FilterSelect label="Ville" value={villeFilter} onChange={setVilleFilter}>
          <option value="">Toutes les villes</option>
          {villes.map(([id, nom]) => (
            <option key={id} value={id}>
              {nom}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Type de compte"
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as AccountType | "")}
        >
          <option value="">Tous les types</option>
          {(Object.keys(TYPE_META) as AccountType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t]}
            </option>
          ))}
        </FilterSelect>
        <label className="relative">
          <span className="sr-only">Rechercher</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, slug, e-mail, SIRET…"
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-navy"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        <StatusChip active={statusFilter === ""} onClick={() => setStatusFilter("")}>
          Toutes · {scoped.length}
        </StatusChip>
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <StatusChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {STATUS_META[s].label} · {counts[s]}
          </StatusChip>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {fichesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : null}
        {fichesQuery.isError ? (
          <p className="text-sm text-destructive">{(fichesQuery.error as Error).message}</p>
        ) : null}
        {masquageQuery.isError ? (
          <p className="text-sm text-destructive">
            Fiches masquées non chargées : {(masquageQuery.error as Error).message}
          </p>
        ) : null}
        {fichesQuery.data && visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune fiche ne correspond à ces filtres.</p>
        ) : null}

        {visible.map((f) => {
          const status = statusOf(f);
          const type = typeOf(f);
          const identifier = f.siret ? `SIRET ${f.siret}` : f.rna ? `RNA ${f.rna}` : null;
          return (
            <article key={f.commerce_id} className="surface-card p-3 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{f.nom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[f.trade, f.ville_nom].filter(Boolean).join(" · ")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.owner_id ? (
                      <>
                        Propriétaire :{" "}
                        <span className="font-medium text-foreground">
                          {f.email ?? "compte sans e-mail"}
                        </span>
                      </>
                    ) : (
                      "Sans propriétaire (fiche non réclamée)"
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {identifier ?? "Aucun SIRET / RNA"}
                    {f.legal_name ? ` · ${f.legal_name}` : ""}
                    {f.verification_status === "refuse"
                      ? " · identifiant refusé par l'annuaire"
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_META[status].className}`}
                  >
                    {STATUS_META[status].label}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
                    {TYPE_META[type]}
                  </span>
                </div>
              </div>

              {f.suspended_at ? (
                <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                  Suspendue le {new Date(f.suspended_at).toLocaleDateString("fr-FR")}
                  {f.suspension_reason ? ` — ${f.suspension_reason}` : ""}
                </p>
              ) : null}
              {f.masquee_at ? (
                <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  Masquée du site le {new Date(f.masquee_at).toLocaleDateString("fr-FR")}
                  {f.masquage_motif
                    ? ` — ${MASQUAGE_MOTIFS[f.masquage_motif] ?? f.masquage_motif}`
                    : ""}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.masquee_at ? (
                  <ActionButton
                    tone="success"
                    disabled={busy}
                    onClick={() => unmaskMutation.mutate(f.commerce_id)}
                  >
                    <Eye className="h-3.5 w-3.5" /> Réafficher
                  </ActionButton>
                ) : null}
                {status !== "validated" && !f.masquee_at ? (
                  <ActionButton
                    tone="success"
                    disabled={busy}
                    onClick={() => statusMutation.mutate({ id: f.commerce_id, action: "validate" })}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" /> Valider
                  </ActionButton>
                ) : null}
                <ActionButton
                  disabled={busy}
                  onClick={() => setEditingId(editingId === f.commerce_id ? null : f.commerce_id)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </ActionButton>
                {f.suspended_at ? (
                  <ActionButton
                    disabled={busy}
                    onClick={() =>
                      statusMutation.mutate({ id: f.commerce_id, action: "reactivate" })
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Réactiver
                  </ActionButton>
                ) : (
                  <ActionButton
                    tone="danger"
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt(
                        `Suspendre « ${f.nom} » ? La fiche disparaîtra du site.\nMotif (facultatif) :`,
                        "",
                      );
                      if (reason === null) return;
                      statusMutation.mutate({ id: f.commerce_id, action: "suspend", reason });
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" /> Suspendre
                  </ActionButton>
                )}
                <Link
                  to={f.site_actif ? "/site/$slug" : "/commerce/$slug"}
                  params={{ slug: f.slug }}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-navy hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Voir
                </Link>
                {f.owner_id ? (
                  <ActionButton
                    disabled={busy}
                    onClick={() =>
                      setPasswordId(passwordId === f.commerce_id ? null : f.commerce_id)
                    }
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Changer le mot de passe
                  </ActionButton>
                ) : null}
              </div>

              {passwordId === f.commerce_id ? (
                <SetPasswordForm fiche={f} onClose={() => setPasswordId(null)} />
              ) : null}

              {editingId === f.commerce_id ? (
                <EditFicheForm
                  fiche={f}
                  onClose={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
                  }}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EditFicheForm({
  fiche,
  onClose,
  onSaved,
}: {
  fiche: FicheRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState({
    nom: fiche.nom,
    trade: fiche.trade ?? "",
    adresse: fiche.adresse ?? "",
    telephone: fiche.telephone ?? "",
    description: fiche.description ?? "",
  });
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_update_fiche", {
        p_commerce_id: fiche.commerce_id,
        p_nom: values.nom,
        p_trade: values.trade,
        p_adresse: values.adresse,
        p_telephone: values.telephone,
        p_description: values.description,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Fiche modifiée");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="mt-3 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField label="Nom" value={values.nom} onChange={set("nom")} />
        <TextField label="Métier / activité" value={values.trade} onChange={set("trade")} />
        <TextField label="Adresse" value={values.adresse} onChange={set("adresse")} />
        <TextField label="Téléphone" value={values.telephone} onChange={set("telephone")} />
      </div>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Description
        </span>
        <textarea
          value={values.description}
          onChange={(e) => set("description")(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-2 text-sm outline-none focus:border-navy"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Annuler
        </button>
      </div>
    </form>
  );
}

const MIN_PASSWORD_LENGTH = 8;

/** Nouveau mot de passe du propriétaire, appliqué par l'Edge Function admin-set-password. */
function SetPasswordForm({ fiche, onClose }: { fiche: FicheRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("admin-set-password", {
        body: { commerce_id: fiche.commerce_id, password },
      });
      if (error) {
        // Réponse non-2xx : le message utile est dans le corps JSON renvoyé par la fonction.
        const context = (error as { context?: Response }).context;
        const body = context ? await context.json().catch(() => null) : null;
        throw new Error((body as { error?: string } | null)?.error ?? error.message);
      }
    },
    onSuccess: () => {
      toast.success(`Mot de passe changé pour ${fiche.email ?? "le propriétaire"}`);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="mt-3 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
    >
      <p className="text-xs text-muted-foreground">
        Nouveau mot de passe pour{" "}
        <span className="font-semibold text-foreground">{fiche.email ?? "le propriétaire"}</span>.
        Communiquez-le au commerçant par un canal sûr.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} />
        <PasswordField label="Confirmation" value={confirm} onChange={setConfirm} />
      </div>
      {password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
        <p className="text-xs text-destructive">Au moins {MIN_PASSWORD_LENGTH} caractères.</p>
      ) : mismatch ? (
        <p className="text-xs text-destructive">Les deux mots de passe ne correspondent pas.</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!valid || mutation.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {mutation.isPending ? "Enregistrement…" : "Appliquer le nouveau mot de passe"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Annuler
        </button>
      </div>
    </form>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus:border-navy"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus:border-navy"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-navy"
    >
      {children}
    </select>
  );
}

function StatusChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-transparent bg-navy text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "success" | "danger";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
        : "bg-secondary text-foreground hover:bg-secondary/70";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}
