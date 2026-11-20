import { describe, expect, it } from "vitest";
import { cityMatchRank, rankCitiesByName } from "../src/lib/city-search";
import { normalizeSearch } from "../src/lib/utils";

const villes = [
  "Ambarès-et-Lagrave",
  "Artigues-près-Bordeaux",
  "Bègles",
  "Bordeaux",
  "Le Haillan",
  "Le Taillan-Médoc",
  "Saint-Aubin-de-Médoc",
  "Saint-Médard-en-Jalles",
].map((nom) => ({ nom }));
const search = (text: string) => rankCitiesByName(villes, normalizeSearch(text)).map((v) => v.nom);

describe("rankCitiesByName", () => {
  it("met Bordeaux avant Artigues-près-Bordeaux", () => {
    expect(search("Bordeaux")).toEqual(["Bordeaux", "Artigues-près-Bordeaux"]);
    expect(search("bord")).toEqual(["Bordeaux", "Artigues-près-Bordeaux"]);
  });

  it("ignore accents et majuscules", () => {
    expect(search("BEGLES")).toEqual(["Bègles"]);
  });

  it("classe le début du nom avant le début d'un mot", () => {
    expect(search("medoc")).toEqual(["Le Taillan-Médoc", "Saint-Aubin-de-Médoc"]);
    expect(search("saint-m")).toEqual(["Saint-Médard-en-Jalles"]);
    expect(search("taillan")).toEqual(["Le Taillan-Médoc"]);
  });

  it("exclut les communes qui ne contiennent pas la saisie", () => {
    expect(search("talence")).toEqual([]);
  });
});

describe("cityMatchRank", () => {
  it("distingue nom exact, début, mot et milieu", () => {
    expect(cityMatchRank("Bordeaux", "bordeaux")).toBe(0);
    expect(cityMatchRank("Bordeaux", "bor")).toBe(1);
    expect(cityMatchRank("Artigues-près-Bordeaux", "bor")).toBe(2);
    expect(cityMatchRank("Bordeaux", "dea")).toBe(3);
    expect(cityMatchRank("Bordeaux", "xyz")).toBeNull();
  });
});
