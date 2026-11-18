import { describe, expect, it } from "vitest";
import { isPlaceholderPhone, publicPhone } from "../src/lib/phone";

describe("publicPhone", () => {
  it("masque le numéro fictif des fiches importées, quel que soit son format", () => {
    for (const phone of ["05 00 00 00 00", "0500000000", "05.00.00.00.00", "+33 5 00 00 00 00"]) {
      expect(isPlaceholderPhone(phone)).toBe(true);
      expect(publicPhone(phone)).toBe("");
    }
  });

  it("garde les vrais numéros, y compris ceux qui contiennent beaucoup de zéros", () => {
    expect(publicPhone(" 05 56 00 00 00 ")).toBe("05 56 00 00 00");
    expect(publicPhone("05 00 00 00 01")).toBe("05 00 00 00 01");
    expect(publicPhone("06 58 07 54 19")).toBe("06 58 07 54 19");
  });

  it("renvoie une chaîne vide sans numéro", () => {
    expect(publicPhone(null)).toBe("");
    expect(publicPhone(undefined)).toBe("");
    expect(publicPhone("  ")).toBe("");
  });
});
