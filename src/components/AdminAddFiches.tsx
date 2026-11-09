import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FilePlus2, Upload } from "lucide-react";
import { LocalityFields } from "@/components/LocalityFields";
import { CsvImportError, decodeCsvBytes, MAX_CSV_BYTES } from "@/lib/csv";
import { FICHES_CSV_TEMPLATE, parseFichesCsv, type FicheCsvRow } from "@/lib/fiches-csv";
import { geocodeAddress } from "@/lib/geocode";
import { isMarketplaceEligible } from "@/lib/marketplace-sort";
import { CATEGORIES, type CategoryKey } from "@/lib/placeducoin-data";
import { resolveLocality, validateLocality, type LocalityValue } from "@/lib/locality";
import { slugify } from "@/lib/slugify";
import { supabase } from "@/lib/supabase";

const FICHE_CATEGORIES = CATEGORIES.filter((c) => c.key !== "locale");
const EMPTY_LOCALITY: LocalityValue = {
  codePostal: "",
  insee: "",
  quartierId: null,
  newQuartier: null,
};
const FIELD_CLASS =
  "mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-navy";
const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const BUTTON_CLASS =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60";
// La Base Adresse Nationale tolère 50 requêtes par seconde : large marge pour un import.
const GEOCODE_CONCURRENCY = 5;

type NewFiche = Omit<FicheCsvRow, "codePostal"> & {
  codePostal: string;
  quartierId: string | null;
};
type CreateResult = { created: number; skipped: string[] };

async function createFiches(
  villeId: string,
  fiches: NewFiche[],
  onProgress?: (done: number) => void,
): Promise<CreateResult> {
  const payload: object[] = new Array(fiches.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < fiches.length) {
      const index = next++;
      const fiche = fiches[index]!;
      // Sans résultat fiable, la fiche est créée quand même et placée au centre de sa commune.
      const position = await geocodeAddress(fiche.adresse, fiche.codePostal);
      payload[index] = {
        nom: fiche.nom,
        slug: slugify(fiche.nom),
        adresse: fiche.adresse,
        category: fiche.category,
        telephone: fiche.telephone,
        trade: fiche.trade,
        code_postal: fiche.codePostal,
        quartier_id: fiche.quartierId,
        latitude: position?.lat ?? null,
        longitude: position?.lng ?? null,
      };
      onProgress?.(++done);
    }
  }
  await Promise.all(Array.from({ length: GEOCODE_CONCURRENCY }, worker));

  const { data, error } = await supabase.rpc("admin_create_unclaimed_fiches", {
    p_ville_id: villeId,
    p_fiches: payload,
  });
  if (error) throw new Error(error.message);
  return data as CreateResult;
}

function downloadTemplate() {
  const url = URL.createObjectURL(
    new Blob([FICHES_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "modele-fiches-spotlocal.csv";
  link.click();
  // Libéré après coup : Safari annule le téléchargement si l'URL disparaît trop tôt.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ajout de fiches sans gérant, une par une ou par import CSV d'une commune. */
export function AdminAddFiches() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-fiches"] });
    void queryClient.invalidateQueries({ queryKey: ["villes"] });
    void queryClient.invalidateQueries({ queryKey: ["quartiers"] });
  };

  return (
    <section>
      <div className="flex items-center gap-2">
        <FilePlus2 className="h-5 w-5 text-navy" />
        <h2 className="font-display text-lg font-extrabold text-foreground">
          Ajouter des fiches sans gérant
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Ces fiches sont publiées sur la marketplace et proposent la revendication à leur gérant.
      </p>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <AddFicheForm onCreated={refresh} />
        <ImportFichesCsv onImported={refresh} />
      </div>
    </section>
  );
}

function AddFicheForm({ onCreated }: { onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [locality, setLocality] = useState(EMPTY_LOCALITY);
  const [category, setCategory] = useState<CategoryKey | "">("");
  const [telephone, setTelephone] = useState("");
  const [trade, setTrade] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    const localityError = validateLocality(locality);
    const formError =
      localityError ??
      (!category
        ? "Choisissez une catégorie."
        : !isMarketplaceEligible({ trade })
          ? "La restauration n'est pas acceptée sur le site."
          : null);
    if (formError || !category) {
      toast.error(formError);
      return;
    }
    setPending(true);
    try {
      const { villeId, quartierId } = await resolveLocality(locality);
      const result = await createFiches(villeId, [
        { nom, adresse, category, telephone, trade, codePostal: locality.codePostal, quartierId },
      ]);
      if (result.created === 0) {
        toast.error("Cette fiche existe déjà dans cette commune.");
        return;
      }
      toast.success(`Fiche « ${nom.trim()} » créée`);
      setNom("");
      setAdresse("");
      setLocality(EMPTY_LOCALITY);
      setCategory("");
      setTelephone("");
      setTrade("");
      onCreated();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="surface-card space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 className="font-display font-bold text-foreground">Une fiche</h3>
      <label className="block">
        <span className={LABEL_CLASS}>Nom *</span>
        <input
          required
          minLength={2}
          maxLength={80}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Adresse *</span>
        <input
          required
          minLength={3}
          maxLength={200}
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="12 rue du Marché"
          className={FIELD_CLASS}
        />
      </label>
      <LocalityFields value={locality} onChange={setLocality} adresse={adresse} />
      <label className="block">
        <span className={LABEL_CLASS}>Catégorie *</span>
        <select
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey)}
          className={FIELD_CLASS}
        >
          <option value="">Choisir une catégorie</option>
          {FICHE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Téléphone *</span>
        <input
          required
          type="tel"
          minLength={6}
          maxLength={30}
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>Métier (facultatif)</span>
        <input
          maxLength={80}
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          placeholder="Ex : Boucher, Libraire, Coiffeur"
          className={FIELD_CLASS}
        />
      </label>
      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        {pending ? "Création…" : "Créer la fiche"}
      </button>
    </form>
  );
}

function ImportFichesCsv({ onImported }: { onImported: () => void }) {
  const [locality, setLocality] = useState(EMPTY_LOCALITY);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<FicheCsvRow[] | null>(null);
  const [fileError, setFileError] = useState<{ message: string; details: string[] } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setRows(null);
    setFileError(null);
    if (file.size > MAX_CSV_BYTES) {
      setFileError({ message: "Fichier trop lourd (2 Mo maximum).", details: [] });
      return;
    }
    try {
      setRows(parseFichesCsv(decodeCsvBytes(new Uint8Array(await file.arrayBuffer()))));
    } catch (error) {
      setFileError({
        message: (error as Error).message,
        details: error instanceof CsvImportError ? error.details : [],
      });
    }
  }

  async function runImport() {
    if (!rows) return;
    const localityError = validateLocality(locality);
    if (localityError) {
      toast.error(localityError);
      return;
    }
    setProgress(0);
    try {
      const { villeId } = await resolveLocality({
        ...locality,
        quartierId: null,
        newQuartier: null,
      });
      const result = await createFiches(
        villeId,
        rows.map((r) => ({
          ...r,
          codePostal: r.codePostal ?? locality.codePostal,
          quartierId: null,
        })),
        setProgress,
      );
      toast.success(
        `${result.created} fiche${result.created > 1 ? "s" : ""} importée${result.created > 1 ? "s" : ""}` +
          (result.skipped.length > 0
            ? `, ${result.skipped.length} déjà présente${result.skipped.length > 1 ? "s" : ""}`
            : ""),
      );
      setRows(null);
      setFileName("");
      onImported();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProgress(null);
    }
  }

  const importing = progress !== null;

  return (
    <div className="surface-card space-y-4 p-4">
      <div className="flex items-center gap-2">
        <h3 className="font-display font-bold text-foreground">Import CSV d'une commune</h3>
        <button
          type="button"
          onClick={downloadTemplate}
          className="ml-auto text-xs font-semibold text-navy hover:underline"
        >
          Télécharger le modèle
        </button>
      </div>
      <LocalityFields value={locality} onChange={setLocality} adresse="" hideQuartier />
      <label className="block">
        <span className={LABEL_CLASS}>Fichier CSV *</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={importing}
          onChange={(e) => void handleFile(e)}
          className="mt-1 block w-full text-sm text-foreground"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Colonnes : nom, adresse, categorie, telephone. Facultatives : metier, code_postal.
        </span>
      </label>

      {fileError ? (
        <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive" role="alert">
          <p className="font-semibold">{fileError.message}</p>
          {fileError.details.length > 0 ? (
            <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-4">
              {fileError.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {rows ? (
        <button
          type="button"
          disabled={importing}
          onClick={() => void runImport()}
          className={`${BUTTON_CLASS} inline-flex items-center gap-2`}
        >
          <Upload className="h-4 w-4" />
          {importing
            ? `Localisation des adresses… ${progress}/${rows.length}`
            : `Importer ${rows.length} fiche${rows.length > 1 ? "s" : ""} de ${fileName}`}
        </button>
      ) : null}
    </div>
  );
}
