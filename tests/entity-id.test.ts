import { describe, it, expect } from "vitest";
import {
  canCompanyPay,
  hasAssociationIdentifier,
  isValidRna,
  isValidSiret,
  normalizeIdentifier,
  parseAssociationIdentifier,
  resolveIdentity,
} from "../src/lib/entity-id";

describe("resolveIdentity", () => {
  it("entreprise : SIRET valide, ou case « en cours » seulement si autorisée", () => {
    expect(
      resolveIdentity(
        "company",
        { identifier: "130 025 265 00013", pending: false },
        { allowPending: true },
      ),
    ).toEqual({
      ok: true,
      patch: { siret: "13002526500013", rna: null, immatriculation_en_cours: false },
    });
    expect(
      resolveIdentity("company", { identifier: "", pending: true }, { allowPending: true }),
    ).toEqual({ ok: true, patch: { siret: null, rna: null, immatriculation_en_cours: true } });
    expect(
      resolveIdentity("company", { identifier: "", pending: true }, { allowPending: false }).ok,
    ).toBe(false);
    expect(
      resolveIdentity(
        "company",
        { identifier: "W123456789", pending: false },
        { allowPending: true },
      ).ok,
    ).toBe(false);
  });

  it("association : RNA ou SIRET, jamais « en cours »", () => {
    expect(
      resolveIdentity(
        "association",
        { identifier: "W123456789", pending: false },
        { allowPending: true },
      ),
    ).toEqual({
      ok: true,
      patch: { siret: null, rna: "W123456789", immatriculation_en_cours: false },
    });
    expect(
      resolveIdentity("association", { identifier: "", pending: true }, { allowPending: true }).ok,
    ).toBe(false);
  });
});

describe("isValidSiret", () => {
  it("accepte un SIRET dont la clé de Luhn est correcte", () => {
    // SIRET public de la Direction interministérielle du numérique (DINUM).
    expect(isValidSiret("13002526500013")).toBe(true);
    expect(isValidSiret("73282932000074")).toBe(true);
  });

  it("refuse une clé de Luhn incorrecte, une longueur ou des caractères invalides", () => {
    expect(isValidSiret("13002526500014")).toBe(false);
    expect(isValidSiret("1300252650001")).toBe(false);
    expect(isValidSiret("1300252650001A")).toBe(false);
    expect(isValidSiret("")).toBe(false);
    expect(isValidSiret(null)).toBe(false);
  });

  it("applique l'exception La Poste (somme des chiffres multiple de 5)", () => {
    expect(isValidSiret("35600000000048")).toBe(true); // siège, valide au sens de Luhn
    expect(isValidSiret("35600000000056")).toBe(true); // établissement, somme multiple de 5
    expect(isValidSiret("35600000000049")).toBe(false);
  });
});

describe("isValidRna", () => {
  it("exige un W suivi de 9 chiffres", () => {
    expect(isValidRna("W123456789")).toBe(true);
    expect(isValidRna("W12345678")).toBe(false);
    expect(isValidRna("w123456789")).toBe(false);
    expect(isValidRna("123456789")).toBe(false);
  });
});

describe("parseAssociationIdentifier", () => {
  it("range un RNA ou un SIRET dans la bonne colonne après normalisation", () => {
    expect(parseAssociationIdentifier(" w123 456 789 ")).toEqual({
      rna: "W123456789",
      siret: null,
    });
    expect(parseAssociationIdentifier("130 025 265 00013")).toEqual({
      rna: null,
      siret: "13002526500013",
    });
    expect(parseAssociationIdentifier("abc")).toBeNull();
  });
});

describe("règles d'accès", () => {
  it("une association est débloquée par un RNA ou un SIRET", () => {
    expect(hasAssociationIdentifier({ rna: "W123456789", siret: null })).toBe(true);
    expect(hasAssociationIdentifier({ rna: null, siret: "13002526500013" })).toBe(true);
    expect(hasAssociationIdentifier({ rna: null, siret: null })).toBe(false);
  });

  it("une entreprise ne paie qu'avec un SIRET valide non refusé", () => {
    expect(canCompanyPay({ siret: "13002526500013", verification_status: "a_verifier" })).toBe(
      true,
    );
    expect(canCompanyPay({ siret: "13002526500013", verification_status: "refuse" })).toBe(false);
    expect(canCompanyPay({ siret: null, verification_status: "non_renseigne" })).toBe(false);
  });

  it("normalise espaces, points et tirets", () => {
    expect(normalizeIdentifier("130.025.265-00013")).toBe("13002526500013");
  });
});
