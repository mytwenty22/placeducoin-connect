/**
 * Lecture des fichiers CSV de l'import catalogue (Espace Pro → Catalogue).
 *
 * Les fichiers viennent surtout d'Excel ou LibreOffice en français, d'où :
 * - séparateur point-virgule (Excel FR) aussi bien que virgule ou tabulation, détecté sur l'en-tête ;
 * - encodage UTF-8 (avec ou sans BOM) ou Windows-1252 (« CSV (séparateur : point-virgule) »
 *   d'Excel), sinon les accents sortent en « � » ;
 * - prix au format français (« 12,50 € », « 1 234,50 »).
 */

export type CsvDelimiter = "," | ";" | "\t";

/** Erreur de fichier à montrer telle quelle au commerçant. */
export class CsvImportError extends Error {
  constructor(
    message: string,
    /** Détail ligne par ligne (« Ligne 4 : prix invalide… »). */
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "CsvImportError";
  }
}

/** Décode le contenu brut : UTF-8 si valide (BOM retiré), sinon Windows-1252. */
export function decodeCsvBytes(bytes: Uint8Array): string {
  // Classeur Excel (.xlsx) renommé ou choisi par erreur : c'est une archive ZIP (« PK »).
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    throw new CsvImportError(
      "Ce fichier est un classeur Excel, pas un CSV. Dans Excel : Fichier → Enregistrer sous → « CSV UTF-8 (délimité par des virgules) ».",
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Séparateur le plus fréquent sur la première ligne (hors guillemets) ; « ; » en cas d'égalité. */
export function detectDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === "\n" || char === "\r")) break;
    else if (!inQuotes && char in counts) counts[char as CsvDelimiter]++;
  }
  return (Object.keys(counts) as CsvDelimiter[]).reduce((best, d) =>
    counts[d] > counts[best] ? d : best,
  );
}

export type CsvRow = { cells: string[]; line: number };

/**
 * Parseur RFC 4180 : champs entre guillemets (avec séparateurs, guillemets doublés et retours à la
 * ligne), fins de ligne \n, \r\n ou \r. Chaque ligne garde son numéro dans le fichier (1 = en-tête)
 * pour les messages d'erreur. Les lignes vides sont ignorées.
 */
export function parseCsv(text: string, delimiter: CsvDelimiter = detectDelimiter(text)): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;
  let quoteStart = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim().length > 0)) rows.push({ cells: row, line: rowStart });
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) line++;
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
      quoteStart = line;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRow();
      line++;
      rowStart = line;
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    throw new CsvImportError(
      `Guillemet ouvert ligne ${quoteStart} et jamais refermé : vérifiez cette ligne du fichier.`,
    );
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

/** « 12,50 € », « 1 234,50 », « 12.5 » → nombre ; null si vide ; NaN si illisible. */
export function parsePrice(raw: string): number | null {
  // \s couvre aussi les espaces insécables qu'Excel met dans « 1 234,50 ».
  const cleaned = raw
    .replace(/[€\s]/g, "")
    .replace(/eur(os?)?$/i, "")
    .trim();
  if (!cleaned) return null;
  // Virgule et point ensemble : le dernier est le séparateur décimal (« 1.234,50 » / « 1,234.50 »).
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimal = lastComma > lastDot ? "," : ".";
  const thousands = decimal === "," ? "." : ",";
  const normalized = cleaned.split(thousands).join("").replace(decimal, ".");
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

const normalizeHeader = (h: string) =>
  h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();

const HEADER_ALIASES = {
  nom: ["nom", "nom du produit", "produit", "designation", "libelle", "article", "name"],
  prix: ["prix", "prix ttc", "tarif", "price", "montant"],
  description: ["description", "descriptif", "detail", "details"],
  photo_url: ["photo", "photo url", "image", "image url", "url photo", "url image"],
} as const;

/**
 * Modèle proposé au téléchargement sous le bouton d'import. Point-virgule et BOM UTF-8 : Excel en
 * français l'ouvre directement en colonnes, accents compris.
 */
export const CSV_TEMPLATE =
  "﻿" +
  [
    "nom;prix;description;photo",
    "Côte de bœuf;24,90;Maturée 30 jours, environ 1 kg;",
    '"Pain de campagne; tranché";3,20;Farine bio, cuit au feu de bois;',
    "Conseil personnalisé;;Sur rendez-vous, prix sur devis;",
  ].join("\r\n") +
  "\r\n";

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_PRODUCTS = 1000;
const MAX_NOM_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export type CsvProduct = {
  nom: string;
  prix: number | null;
  description: string | null;
  photo_url: string | null;
};

/**
 * Transforme le texte d'un CSV en produits. Tout ou rien : à la moindre ligne invalide, lève une
 * CsvImportError qui liste les lignes à corriger, pour ne pas importer un catalogue à moitié (et
 * créer des doublons au second essai).
 */
export function parseProductsCsv(text: string): CsvProduct[] {
  if (!text.trim()) throw new CsvImportError("Le fichier est vide.");
  if (text.includes("�")) {
    throw new CsvImportError(
      "Encodage du fichier illisible. Enregistrez-le au format « CSV UTF-8 » puis réessayez.",
    );
  }
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) throw new CsvImportError("Le fichier est vide.");

  const header = headerRow.cells.map(normalizeHeader);
  const column = (key: keyof typeof HEADER_ALIASES) =>
    header.findIndex((h) => (HEADER_ALIASES[key] as readonly string[]).includes(h));
  const idx = {
    nom: column("nom"),
    prix: column("prix"),
    description: column("description"),
    photo_url: column("photo_url"),
  };
  if (idx.nom === -1) {
    throw new CsvImportError(
      `Colonne « nom » introuvable. La première ligne doit contenir les en-têtes nom, prix, description (colonnes lues : ${headerRow.cells
        .map((c) => `« ${c.trim()} »`)
        .join(", ")}).`,
    );
  }
  if (dataRows.length === 0) {
    throw new CsvImportError("Le fichier ne contient que la ligne d'en-têtes, aucun produit.");
  }
  if (dataRows.length > MAX_CSV_PRODUCTS) {
    throw new CsvImportError(
      `Trop de lignes : ${dataRows.length} produits, ${MAX_CSV_PRODUCTS} au maximum par import. Découpez le fichier.`,
    );
  }

  const errors: string[] = [];
  const products: CsvProduct[] = [];
  for (const { cells, line } of dataRows) {
    const cell = (i: number) => (i === -1 ? "" : (cells[i] ?? "").trim());
    const nom = cell(idx.nom);
    const rawPrix = cell(idx.prix);
    const prix = parsePrice(rawPrix);
    const description = cell(idx.description);
    const photo = cell(idx.photo_url);
    const lineErrors: string[] = [];
    if (!nom) lineErrors.push("nom manquant");
    else if (nom.length > MAX_NOM_LENGTH)
      lineErrors.push(`nom trop long (${MAX_NOM_LENGTH} caractères max)`);
    if (Number.isNaN(prix)) lineErrors.push(`prix « ${rawPrix} » illisible (exemple : 12,50)`);
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      lineErrors.push(`description trop longue (${MAX_DESCRIPTION_LENGTH} caractères max)`);
    }
    if (photo && !/^https?:\/\/\S+$/i.test(photo)) {
      lineErrors.push("photo : une adresse web commençant par http(s):// est attendue");
    }
    if (lineErrors.length > 0) {
      errors.push(`Ligne ${line} : ${lineErrors.join(", ")}.`);
      continue;
    }
    products.push({ nom, prix, description: description || null, photo_url: photo || null });
  }

  if (errors.length > 0) {
    throw new CsvImportError(
      `${errors.length} ligne${errors.length > 1 ? "s" : ""} à corriger, aucun produit importé.`,
      errors,
    );
  }
  return products;
}
