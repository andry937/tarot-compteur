import { describe, it, expect } from "vitest";
import { ECART_SOIREE_MS, classementSoiree, grouperSoirees, libelleSoiree, soireeDeLaPartie } from "@/domain/stats/soirees";
import type { Donne } from "@/domain/score/regles";
import type { PartieAnalysee } from "@/domain/stats/stats";
import type { Fiche } from "@/domain/joueurs/identite";

const ids = ["a", "b", "c", "d"];
const roster: Fiche[] = ids.map((id) => ({ id, nom: id.toUpperCase(), creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null }));
const donne = (preneur: number, points: number): Donne => ({
  table: [0, 1, 2, 3],
  preneur,
  appele: null,
  contrat: "garde",
  bouts: 2,
  points,
  petitAuBout: "aucun",
  chelem: "aucun",
  miseres: [],
});
const heure = 60 * 60 * 1000;
const t0 = new Date("2026-03-07T20:00:00.000Z").getTime();
const partie = (id: string, decalageH: number, donnes: Donne[], joueursId = ids): PartieAnalysee => ({
  archiveId: id,
  date: new Date(t0 + decalageH * heure).toISOString(),
  joueursId,
  donnes,
});

describe("soirées", () => {
  it("regroupe les parties espacées de moins de 24 h", () => {
    const soirees = grouperSoirees([partie("p1", 0, []), partie("p2", 3, []), partie("p3", 23, [])]);
    expect(soirees).toHaveLength(1);
    expect(soirees[0].parties.map((p) => p.archiveId)).toEqual(["p1", "p2", "p3"]);
  });

  it("sépare deux parties espacées de 24 h ou plus", () => {
    const soirees = grouperSoirees([partie("p1", 0, []), partie("p2", ECART_SOIREE_MS / heure, [])]);
    expect(soirees).toHaveLength(2);
    expect(grouperSoirees([partie("p1", 0, []), partie("p2", 24 - 0.01, [])])).toHaveLength(1);
  });

  it("chaîne les parties : l'écart se mesure avec la partie précédente, pas avec la première", () => {
    // 0 h, 20 h, 40 h : chaque écart est de 20 h, mais la dernière est à 40 h de la première.
    const soirees = grouperSoirees([partie("p1", 0, []), partie("p2", 20, []), partie("p3", 40, [])]);
    expect(soirees).toHaveLength(1);
    expect(soirees[0].debut).toBe(partie("p1", 0, []).date);
    expect(soirees[0].fin).toBe(partie("p3", 40, []).date);
  });

  it("trie de la plus récente à la plus ancienne, quel que soit l'ordre d'entrée", () => {
    const soirees = grouperSoirees([partie("tard", 100, []), partie("tot", 0, [])]);
    expect(soirees.map((s) => s.parties[0].archiveId)).toEqual(["tard", "tot"]);
  });

  it("retrouve la soirée d'une partie par sa date", () => {
    const soirees = grouperSoirees([partie("p1", 0, []), partie("p2", 2, []), partie("p3", 100, [])]);
    expect(soireeDeLaPartie(soirees, partie("p2", 2, []).date)?.parties).toHaveLength(2);
    expect(soireeDeLaPartie(soirees, "2000-01-01T00:00:00.000Z")).toBeUndefined();
  });

  it("additionne les points des parties de la soirée", () => {
    const p1 = partie("p1", 0, [donne(0, 60), donne(0, 60)]);
    const p2 = partie("p2", 2, [donne(1, 60)]);
    const [soiree] = grouperSoirees([p1, p2]);
    const lignes = classementSoiree(soiree, roster);
    const total = lignes.reduce((a, l) => a + l.pts, 0);
    expect(total).toBe(0); // somme nulle sur chaque donne
    const a = lignes.find((l) => l.id === "a")!;
    const b = lignes.find((l) => l.id === "b")!;
    expect(a.donnes).toBe(3);
    expect(a.parties).toBe(2);
    // A gagne ses deux prises (+), puis défend la prise de B (−) ; B ne prend qu'une fois.
    expect(lignes[0].id).toBe("a");
    expect(a.pts).toBeGreaterThan(b.pts);
  });

  it("regroupe un joueur fusionné sous sa fiche cible", () => {
    const fusion: Fiche[] = [...roster, { id: "x", nom: "X", creee: "2026-01-01T00:00:00.000Z", actif: false, redirigeVers: "a" }];
    const p1 = partie("p1", 0, [donne(0, 60)]);
    const p2 = partie("p2", 2, [donne(0, 60)], ["x", "b", "c", "d"]);
    const lignes = classementSoiree(grouperSoirees([p1, p2])[0], fusion);
    expect(lignes.filter((l) => l.nom === "A")).toHaveLength(1);
    expect(lignes.find((l) => l.nom === "A")!.parties).toBe(2);
  });

  it("libelle la soirée avec le jour de sa première partie", () => {
    const [s] = grouperSoirees([partie("p1", 0, [])]);
    expect(libelleSoiree(s)).toMatch(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2} (mars) 2026$/);
  });
});
