import { describe, it, expect } from "vitest";
import { dureesDonnes, dureePartie, formaterDuree } from "@/domain/stats/durees";
import type { Donne } from "@/domain/score/regles";

const d = (finA?: number) => ({ finA }) as Donne;

describe("durees", () => {
  it("mesure chaque donne depuis la précédente", () => {
    expect(dureesDonnes(1000, [d(4000), d(10000)])).toEqual([3000, 6000]);
  });
  it("rend null sans horodatage", () => {
    expect(dureesDonnes(undefined, [d(4000), d(9000)])).toEqual([null, 5000]);
    expect(dureesDonnes(1000, [d()])).toEqual([null]);
  });
  it("durée totale", () => {
    expect(dureePartie(1000, [d(4000), d(10000)])).toBe(9000);
    expect(dureePartie(undefined, [d(4000)])).toBeNull();
  });
  it("formate", () => {
    expect(formaterDuree(45_000)).toBe("45 s");
    expect(formaterDuree(425_000)).toBe("7 min 05 s");
    expect(formaterDuree(4_320_000)).toBe("1 h 12 min");
  });
});
