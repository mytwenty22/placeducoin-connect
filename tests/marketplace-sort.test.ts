import { describe, expect, it } from "vitest";
import { isMarketplaceEligible, sortBoostSpot, sortMarketplace } from "../src/lib/marketplace-sort";
import { withComputedDistance } from "../src/lib/geo";

const SEED = "visite-1";
const shop = (slug: string, distanceKm: number, premium = false, sponsored = false) => ({
  id: slug,
  slug,
  distanceKm,
  premium,
  sponsored,
});
const slugs = (list: { slug: string }[]) => list.map((c) => c.slug);
const order = (list: ReturnType<typeof shop>[]) => slugs(sortMarketplace(list, SEED));

describe("sortMarketplace", () => {
  it("ne place jamais une fiche gratuite, même très proche, au-dessus d'un Site Pro", () => {
    expect(order([shop("gratuit", 0.2), shop("pro", 18, true)])).toEqual(["pro", "gratuit"]);
  });

  it("fait entrer une fiche gratuite boostée dans le bloc Pro, classée par distance", () => {
    const list = [shop("pro", 12, true), shop("gratuit", 0.2), shop("booste", 1.5, false, true)];
    expect(order(list)).toEqual(["booste", "pro", "gratuit"]);
  });

  it("trie chaque bloc par tranche de distance croissante", () => {
    const list = [shop("loin", 12), shop("moyen", 3), shop("proche", 0.4)];
    expect(order(list)).toEqual(["proche", "moyen", "loin"]);
  });

  it("garde le même ordre pendant une visite et le fait tourner d'une visite à l'autre", () => {
    const list = Array.from({ length: 20 }, (_, i) => shop(`commerce-${i}`, 1.5, true));
    expect(order([...list].reverse())).toEqual(order(list));
    const leaders = new Set(
      Array.from({ length: 14 }, (_, visit) => sortMarketplace(list, `visite-${visit}`)[0]?.slug),
    );
    expect(leaders.size).toBeGreaterThan(3);
  });
});

describe("sortBoostSpot", () => {
  it("affiche les favoris du visiteur en premier, même plus éloignés", () => {
    const list = [shop("proche", 0.4, true, true), shop("favori", 15, true, true)];
    expect(slugs(sortBoostSpot(list, new Set(["favori"]), SEED))).toEqual(["favori", "proche"]);
  });

  it("fait tourner les fiches à distance égale", () => {
    const list = Array.from({ length: 20 }, (_, i) => shop(`commerce-${i}`, 1.5, true, true));
    const leaders = new Set(
      Array.from(
        { length: 14 },
        (_, visit) => sortBoostSpot(list, new Set(), `visite-${visit}`)[0]?.slug,
      ),
    );
    expect(leaders.size).toBeGreaterThan(3);
  });
});

describe("withComputedDistance", () => {
  it("retombe sur Bordeaux, jamais Paris, pour une commune inconnue sans GPS", () => {
    const [commerce] = withComputedDistance(
      [{ slug: "a", city: "Commune inconnue", distanceKm: 0 }],
      { lat: 44.8378, lng: -0.5792 },
    );
    expect(commerce?.distanceKm).toBe(0);
  });
});

describe("isMarketplaceEligible", () => {
  it.each([
    "Boucher",
    "Coiffeur",
    "Libraire",
    "Opticien",
    "Fleuriste",
    "Chocolatier",
    "Restauration de meubles",
    "",
  ])("conserve « %s »", (trade) => expect(isMarketplaceEligible({ trade })).toBe(true));

  it.each(["Restaurant", "Fast-food", "Pizzeria", "Restauration rapide", "Boulangerie-snack"])(
    "exclut %s",
    (trade) => expect(isMarketplaceEligible({ trade })).toBe(false),
  );
});
