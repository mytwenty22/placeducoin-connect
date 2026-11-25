import { describe, expect, it } from "vitest";
import { supportLevel } from "../src/lib/local-support";

describe("supportLevel", () => {
  it("attribue le niveau selon le cumul déclaré", () => {
    expect(supportLevel(0)).toBe("Curieux du quartier");
    expect(supportLevel(49.99)).toBe("Curieux du quartier");
    expect(supportLevel(50)).toBe("Soutien local");
    expect(supportLevel(199)).toBe("Soutien local");
    expect(supportLevel(200)).toBe("Pilier du quartier");
    expect(supportLevel(500)).toBe("Ambassadeur indépendant");
    expect(supportLevel(12000)).toBe("Ambassadeur indépendant");
  });
});
