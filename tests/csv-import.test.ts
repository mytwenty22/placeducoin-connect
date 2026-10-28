import { describe, it, expect } from "vitest";
import {
  CsvImportError,
  decodeCsvBytes,
  detectDelimiter,
  parseCsv,
  parsePrice,
  parseProductsCsv,
} from "../src/lib/csv";

const utf8 = (s: string) => new TextEncoder().encode(s);

// Encodage Windows-1252 des quelques caractères accentués utilisés dans les tests.
function cp1252(s: string) {
  const map: Record<string, number> = {
    é: 0xe9,
    è: 0xe8,
    à: 0xe0,
    â: 0xe2,
    ô: 0xf4,
    û: 0xfb,
    É: 0xc9,
    œ: 0x9c,
    "€": 0x80,
  };
  return Uint8Array.from([...s].map((c) => map[c] ?? c.charCodeAt(0)));
}

function importError(fn: () => unknown): CsvImportError {
  try {
    fn();
  } catch (e) {
    if (e instanceof CsvImportError) return e;
    throw e;
  }
  throw new Error("CsvImportError attendue");
}

describe("decodeCsvBytes", () => {
  it("UTF-8 avec BOM (« CSV UTF-8 » d'Excel) : BOM retiré", () => {
    const text = decodeCsvBytes(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8("nom;prix\nPâté;3")]));
    expect(text).toBe("nom;prix\nPâté;3");
  });

  it("Windows-1252 (« CSV séparateur point-virgule » d'Excel) : accents conservés", () => {
    expect(decodeCsvBytes(cp1252("nom;prix\nCrème brûlée à la sève;4 €"))).toContain(
      "Crème brûlée à la sève;4 €",
    );
  });

  it("classeur .xlsx : message explicite", () => {
    expect(importError(() => decodeCsvBytes(utf8("PK\u0003\u0004..."))).message).toMatch(
      /classeur Excel/,
    );
  });
});

describe("detectDelimiter / parseCsv", () => {
  it("détecte point-virgule, virgule et tabulation sur l'en-tête", () => {
    expect(detectDelimiter("nom;prix;description\na,b;1;x")).toBe(";");
    expect(detectDelimiter("nom,prix,description\na;b,1,x")).toBe(",");
    expect(detectDelimiter("nom\tprix\na\t1")).toBe("\t");
    expect(detectDelimiter('"nom;complet",prix\n')).toBe(",");
  });

  it("guillemets, séparateur et saut de ligne dans un champ, numéros de ligne justes", () => {
    const rows = parseCsv(
      'nom;description\r\n"Pain; complet";"Ligne 1\nLigne 2"\r\nBrioche;"Dite ""maison"""\r\n',
    );
    expect(rows).toEqual([
      { cells: ["nom", "description"], line: 1 },
      { cells: ["Pain; complet", "Ligne 1\nLigne 2"], line: 2 },
      { cells: ["Brioche", 'Dite "maison"'], line: 4 },
    ]);
  });

  it("fins de ligne \\r seules (anciens Mac) et lignes vides ignorées", () => {
    expect(parseCsv("nom;prix\r\rA;1\r;\r").map((r) => r.cells)).toEqual([
      ["nom", "prix"],
      ["A", "1"],
    ]);
  });

  it("guillemet jamais refermé : erreur qui cite la ligne", () => {
    expect(importError(() => parseCsv('nom;prix\nA;1\n"B;2\nC;3')).message).toMatch(/ligne 3/);
  });
});

describe("parsePrice", () => {
  it.each([
    ["12,50", 12.5],
    ["12.5", 12.5],
    ["12,50 €", 12.5],
    ["1 234,50", 1234.5],
    ["1 234,50 €", 1234.5],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["8 EUR", 8],
    ["0", 0],
  ])("%s → %s", (raw, expected) => expect(parsePrice(raw)).toBe(expected));

  it("vide → null, illisible ou négatif → NaN", () => {
    expect(parsePrice("  ")).toBeNull();
    expect(parsePrice("gratuit")).toBeNaN();
    expect(parsePrice("-5")).toBeNaN();
    expect(parsePrice("12,50,30")).toBeNaN();
  });
});

describe("parseProductsCsv", () => {
  it("export Excel français : point-virgule, en-têtes accentués et en majuscules, prix FR", () => {
    const text = decodeCsvBytes(
      cp1252(
        "Désignation;Prix (€);Descriptif\nCôte de bœuf;24,90 €;Maturée 30 jours\nÉclair;3,5;\n",
      ),
    );
    expect(parseProductsCsv(text)).toEqual([
      { nom: "Côte de bœuf", prix: 24.9, description: "Maturée 30 jours", photo_url: null },
      { nom: "Éclair", prix: 3.5, description: null, photo_url: null },
    ]);
  });

  it("CSV à virgules avec colonne photo", () => {
    expect(
      parseProductsCsv("nom,prix,description,photo\nBaguette,1.20,,https://exemple.fr/b.jpg\n"),
    ).toEqual([
      { nom: "Baguette", prix: 1.2, description: null, photo_url: "https://exemple.fr/b.jpg" },
    ]);
  });

  it("prix facultatif (colonne absente ou cellule vide)", () => {
    expect(parseProductsCsv("nom\nConseil personnalisé\n")).toEqual([
      { nom: "Conseil personnalisé", prix: null, description: null, photo_url: null },
    ]);
  });

  it("colonne nom introuvable : liste les colonnes lues", () => {
    const e = importError(() => parseProductsCsv("article_ref;tarif_ht\nA;1"));
    expect(e.message).toMatch(/Colonne « nom » introuvable/);
    expect(e.message).toContain("« article_ref »");
  });

  it("tout ou rien : chaque ligne invalide est listée, aucun produit renvoyé", () => {
    const e = importError(() =>
      parseProductsCsv("nom;prix;photo\nA;1\n;2\nB;gratuit\nC;3;exemple.fr/c.jpg\nD;4\n"),
    );
    expect(e.message).toBe("3 lignes à corriger, aucun produit importé.");
    expect(e.details).toEqual([
      "Ligne 3 : nom manquant.",
      "Ligne 4 : prix « gratuit » illisible (exemple : 12,50).",
      "Ligne 5 : photo : une adresse web commençant par http(s):// est attendue.",
    ]);
  });

  it("fichier vide, en-têtes seuls, encodage cassé", () => {
    expect(importError(() => parseProductsCsv(" \n")).message).toBe("Le fichier est vide.");
    expect(importError(() => parseProductsCsv("nom;prix\n")).message).toMatch(/aucun produit/);
    expect(importError(() => parseProductsCsv("nom\nP�té")).message).toMatch(/UTF-8/);
  });
});
