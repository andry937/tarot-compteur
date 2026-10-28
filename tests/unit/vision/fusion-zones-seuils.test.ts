import { describe, it, expect } from "vitest";
import { fusionCoins } from "@/vision/domain/fusionCoins";
import { affecterZone } from "@/vision/domain/zones";
import { accepte, estConfondable, SEUILS_DEFAUT } from "@/vision/domain/seuils";
import type { CarteVue, Detection, Zone } from "@/vision/domain/types";

const coin = (carte: string, confiance: number, x: number, y: number): Detection => ({ carte, confiance, x, y, l: 0.02, h: 0.03 });

describe("fusionCoins", () => {
  it("fusionne les deux coins d'une même carte en une seule, confiance moyenne et centre au milieu", () => {
    const vues = fusionCoins([coin("atout-12", 0.9, 0.1, 0.1), coin("atout-12", 0.7, 0.3, 0.4)]);
    expect(vues).toHaveLength(1);
    expect(vues[0].nbCoins).toBe(2);
    expect(vues[0].confiance).toBeCloseTo(0.8);
    expect(vues[0].cx).toBeCloseTo(0.2 + 0.01);
    expect(vues[0].cy).toBeCloseTo(0.25 + 0.015);
  });

  it("garde une carte dont un seul coin est vu, avec une confiance réduite", () => {
    const [v] = fusionCoins([coin("coeur-14", 0.8, 0.5, 0.5)]);
    expect(v.nbCoins).toBe(1);
    expect(v.confiance).toBeCloseTo(0.72);
  });

  it("ne garde que les deux meilleurs coins quand le modèle en renvoie plus", () => {
    const [v] = fusionCoins([coin("pique-1", 0.9, 0, 0), coin("pique-1", 0.8, 1, 1), coin("pique-1", 0.1, 0.5, 0.5)]);
    expect(v.nbCoins).toBe(2);
    expect(v.confiance).toBeCloseTo(0.85);
  });

  it("renvoie une carte par classe, triées, et rien sans détection", () => {
    expect(fusionCoins([])).toEqual([]);
    const vues = fusionCoins([coin("pique-1", 0.9, 0, 0), coin("atout-3", 0.9, 0, 0), coin("pique-1", 0.9, 1, 1)]);
    expect(vues.map((v) => v.carte)).toEqual(["atout-3", "pique-1"]);
  });
});

describe("seuils par classe", () => {
  const vue = (carte: string, confiance: number, nbCoins: number): CarteVue => ({ carte, confiance, cx: 0, cy: 0, nbCoins });

  it("repère les atouts confondables", () => {
    for (const n of [6, 9, 16, 17, 18, 19, 20]) expect(estConfondable(`atout-${n}`)).toBe(true);
    for (const n of [1, 5, 10, 21]) expect(estConfondable(`atout-${n}`)).toBe(false);
    expect(estConfondable("coeur-6")).toBe(false);
  });

  it("une carte ordinaire passe le seuil de base", () => {
    expect(accepte(vue("coeur-3", 0.5, 1))).toBe(true);
    expect(accepte(vue("coeur-3", 0.49, 2))).toBe(false);
  });

  it("un atout confondable exige un seuil strict et deux coins d'accord", () => {
    expect(accepte(vue("atout-6", 0.79, 2))).toBe(false);
    expect(accepte(vue("atout-6", 0.85, 2))).toBe(true);
    expect(accepte(vue("atout-6", 0.85, 1))).toBe(false);
    expect(accepte(vue("atout-6", 0.92, 1))).toBe(true);
    expect(accepte(vue("atout-16", 0.6, 2), { ...SEUILS_DEFAUT, strict: 0.5 })).toBe(true);
  });
});

describe("zones", () => {
  const vue = (cx: number, cy: number): CarteVue => ({ carte: "atout-3", confiance: 1, cx, cy, nbCoins: 2 });
  const chien: Zone = { id: "chien", x: 0.4, y: 0.4, l: 0.2, h: 0.2 };

  it("affecte une carte à la zone du chien ou de l'écart qui contient son centre", () => {
    const ecart: Zone = { id: "ecart", x: 0.7, y: 0.1, l: 0.2, h: 0.2 };
    expect(affecterZone(vue(0.5, 0.5), [chien, ecart])).toBe("chien");
    expect(affecterZone(vue(0.8, 0.2), [chien, ecart])).toBe("ecart");
  });

  it("met « table » toute carte hors de ces zones, où qu'elle soit : sa position ne désigne pas un joueur", () => {
    expect(affecterZone(vue(0.001, 0.001), [chien])).toBe("table");
    expect(affecterZone(vue(0.9, 0.9), [])).toBe("table");
  });

  it("départage deux zones qui se chevauchent par la plus proche de leur centre", () => {
    const zones: Zone[] = [
      { id: "chien", x: 0, y: 0, l: 0.5, h: 0.5 },
      { id: "ecart", x: 0.3, y: 0, l: 0.5, h: 0.5 },
    ];
    expect(affecterZone(vue(0.35, 0.25), zones)).toBe("chien");
    expect(affecterZone(vue(0.45, 0.25), zones)).toBe("ecart");
  });
});
