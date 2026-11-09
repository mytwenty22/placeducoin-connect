import { describe, expect, it } from "vitest";
import { CsvImportError } from "../src/lib/csv";
import { FICHES_CSV_TEMPLATE, parseFichesCsv } from "../src/lib/fiches-csv";

const HEADER = "nom;adresse;categorie;telephone;metier;code_postal";

function errorsOf(text: string): string[] {
  try {
    parseFichesCsv(text);
  } catch (error) {
    expect(error).toBeInstanceOf(CsvImportError);
    const { message, details } = error as CsvImportError;
    return [message, ...details];
  }
  throw new Error("Une erreur était attendue");
}

describe("parseFichesCsv", () => {
  it("lit le modèle proposé au téléchargement", () => {
    // Sans son BOM, retiré à la lecture du fichier par decodeCsvBytes.
    const fiches = parseFichesCsv(FICHES_CSV_TEMPLATE.slice(1));
    expect(fiches.map((f) => f.category)).toEqual(["bouche", "boutiques", "services"]);
    expect(fiches[0]).toMatchObject({
      nom: "Boucherie Martin",
      trade: "Boucher",
      codePostal: null,
    });
  });

  it("accepte les en-têtes accentués, sans métier ni code postal", () => {
    const [fiche] = parseFichesCsv(
      "Enseigne,Adresse,Catégorie,Téléphone\nChez Paul,1 rue A,Services,0556000000\n",
    );
    expect(fiche).toMatchObject({ nom: "Chez Paul", category: "services", trade: "" });
  });

  it("garde le code postal propre à une ligne", () => {
    const [fiche] = parseFichesCsv(`${HEADER}\nA B;1 rue A;mode;0556000000;Fleuriste;33200\n`);
    expect(fiche?.codePostal).toBe("33200");
  });

  it("refuse tout le fichier en listant les lignes à corriger", () => {
    const errors = errorsOf(
      `${HEADER}\nBon commerce;1 rue A;mode;0556000000;;\nMauvais;;Vie Locale;;;123\n`,
    );
    expect(errors[0]).toContain("aucune fiche importée");
    expect(errors[1]).toContain("Ligne 3");
    expect(errors[1]).toContain("adresse manquante");
    expect(errors[1]).toContain("catégorie « Vie Locale » inconnue");
    expect(errors[1]).toContain("téléphone manquant");
    expect(errors[1]).toContain("code postal invalide");
  });

  it("refuse la restauration", () => {
    const errors = errorsOf(`${HEADER}\nLa Table;1 rue A;bouche;0556000000;Restaurant;\n`);
    expect(errors[1]).toContain("restauration exclue");
  });

  it("signale les colonnes manquantes", () => {
    expect(errorsOf("nom;adresse\nA B;1 rue A\n")[0]).toContain("categorie, telephone");
  });
});
