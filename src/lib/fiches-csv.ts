import type { CategoryKey } from "@/lib/placeducoin-data";
import { CsvImportError, detectDelimiter, normalizeHeader, parseCsv } from "./csv";
import { isMarketplaceEligible } from "./marketplace-sort";

/** Import de fiches sans gérant d'une commune (/admin), mêmes règles que l'import catalogue. */

const HEADER_ALIASES = {
  nom: ["nom", "enseigne", "nom du commerce", "commerce", "etablissement"],
  adresse: ["adresse", "adresse postale", "rue"],
  categorie: ["categorie", "category", "onglet"],
  telephone: ["telephone", "tel", "tel fixe", "numero", "phone"],
  metier: ["metier", "activite", "profession"],
  code_postal: ["code postal", "cp"],
} as const;

const CATEGORY_ALIASES: Record<string, CategoryKey> = {
  bouche: "bouche",
  alimentation: "bouche",
  alimentaire: "bouche",
  "alimentation bouche": "bouche",
  "bouche alimentaire": "bouche",
  boutique: "boutiques",
  boutiques: "boutiques",
  mode: "boutiques",
  "boutiques mode": "boutiques",
  service: "services",
  services: "services",
  "bien etre": "services",
  "services bien etre": "services",
};

/** Modèle à télécharger : point-virgule et BOM pour qu'Excel FR l'ouvre en colonnes. */
export const FICHES_CSV_TEMPLATE =
  "﻿" +
  [
    "nom;adresse;categorie;telephone;metier;code_postal",
    "Boucherie Martin;12 rue du Marché;Alimentation & Bouche;05 56 00 00 00;Boucher;",
    "Librairie du Centre;3 place de la Mairie;Boutiques & Mode;05 56 00 00 01;Libraire;",
    "Salon Élégance;8 avenue de la Gare;Services & Bien-être;05 56 00 00 02;Coiffeur;",
  ].join("\r\n") +
  "\r\n";

export const MAX_CSV_FICHES = 500;

export type FicheCsvRow = {
  nom: string;
  adresse: string;
  category: CategoryKey;
  telephone: string;
  trade: string;
  /** Code postal propre à la ligne ; à défaut, celui de la commune choisie. */
  codePostal: string | null;
};

/** Tout ou rien : à la moindre ligne invalide, liste les lignes à corriger et n'importe rien. */
export function parseFichesCsv(text: string): FicheCsvRow[] {
  if (!text.trim()) throw new CsvImportError("Le fichier est vide.");
  if (text.includes("�")) {
    throw new CsvImportError(
      "Encodage du fichier illisible. Enregistrez-le au format « CSV UTF-8 » puis réessayez.",
    );
  }
  const [headerRow, ...dataRows] = parseCsv(text, detectDelimiter(text));
  if (!headerRow) throw new CsvImportError("Le fichier est vide.");

  const header = headerRow.cells.map(normalizeHeader);
  const column = (key: keyof typeof HEADER_ALIASES) =>
    header.findIndex((h) => (HEADER_ALIASES[key] as readonly string[]).includes(h));
  const idx = {
    nom: column("nom"),
    adresse: column("adresse"),
    categorie: column("categorie"),
    telephone: column("telephone"),
    metier: column("metier"),
    code_postal: column("code_postal"),
  };
  const missing = (["nom", "adresse", "categorie", "telephone"] as const).filter(
    (key) => idx[key] === -1,
  );
  if (missing.length > 0) {
    throw new CsvImportError(
      `Colonne${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} : ${missing.join(", ")} (colonnes lues : ${headerRow.cells
        .map((c) => `« ${c.trim()} »`)
        .join(", ")}).`,
    );
  }
  if (dataRows.length === 0) {
    throw new CsvImportError("Le fichier ne contient que la ligne d'en-têtes, aucune fiche.");
  }
  if (dataRows.length > MAX_CSV_FICHES) {
    throw new CsvImportError(
      `Trop de lignes : ${dataRows.length} fiches, ${MAX_CSV_FICHES} au maximum par import. Découpez le fichier.`,
    );
  }

  const errors: string[] = [];
  const fiches: FicheCsvRow[] = [];
  for (const { cells, line } of dataRows) {
    const cell = (i: number) => (i === -1 ? "" : (cells[i] ?? "").trim());
    const nom = cell(idx.nom);
    const adresse = cell(idx.adresse);
    const rawCategory = cell(idx.categorie);
    const category = CATEGORY_ALIASES[normalizeHeader(rawCategory)];
    const telephone = cell(idx.telephone);
    const trade = cell(idx.metier);
    const codePostal = cell(idx.code_postal);

    const lineErrors: string[] = [];
    if (nom.length < 2 || nom.length > 80) lineErrors.push("nom manquant ou trop long");
    if (adresse.length < 3 || adresse.length > 200) lineErrors.push("adresse manquante");
    if (!category) {
      lineErrors.push(
        `catégorie « ${rawCategory} » inconnue (Alimentation & Bouche, Boutiques & Mode ou Services & Bien-être)`,
      );
    }
    if (telephone.length < 6 || telephone.length > 30) lineErrors.push("téléphone manquant");
    if (codePostal && !/^\d{5}$/.test(codePostal)) lineErrors.push("code postal invalide");
    if (!isMarketplaceEligible({ trade })) lineErrors.push("restauration exclue du site");

    if (lineErrors.length > 0 || !category) {
      errors.push(`Ligne ${line} : ${lineErrors.join(", ")}.`);
      continue;
    }
    fiches.push({ nom, adresse, category, telephone, trade, codePostal: codePostal || null });
  }

  if (errors.length > 0) {
    throw new CsvImportError(
      `${errors.length} ligne${errors.length > 1 ? "s" : ""} à corriger, aucune fiche importée.`,
      errors,
    );
  }
  return fiches;
}
