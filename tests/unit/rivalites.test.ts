import { describe, it, expect } from "vitest";
import type { Donne } from "@/domain/score/regles";
import type { PartieAnalysee } from "@/domain/stats/stats";
import type { Fiche } from "@/domain/joueurs/identite";
import { calculerRivalites, bilanRivalites, DONNES_RIVALITE_MIN } from "@/domain/stats/rivalites";

const base: Donne = {
  table: [0, 1, 2, 3, 4],
  preneur: 0,
  appele: 1,
  contrat: "garde",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
  points: 60,
};
const ids = ["a", "b", "c", "d", "e"];
const roster: Fiche[] = ids.map((id) => ({ id, nom: id.toUpperCase(), creee: "", actif: true, redirigeVers: null }));
const partie = (donnes: Donne[]): PartieAnalysee => ({ archiveId: "p", date: "2026-01-01T00:00:00.000Z", joueursId: ids, donnes });
const donnes = (n: number, o: Partial<Donne>) => Array.from({ length: n }, () => ({ ...base, ...o }));

describe("calculerRivalites", () => {
  it("ne compte que les donnes en camps opposés, et ignore partenaires et joueurs au repos", () => {
    // a prend avec b appelé (réussi) : a affronte c, d, e ; a et b sont partenaires.
    const r = calculerRivalites("a", [partie(donnes(10, { points: 60 }))], roster);
    expect(r.map((x) => x.adversaireId).sort()).toEqual(["c", "d", "e"]);
    expect(r.every((x) => x.donnes === 10 && x.victoires === 10)).toBe(true);
    // Un joueur au repos n'est l'adversaire de personne.
    const repos = calculerRivalites("a", [partie(donnes(4, { table: [0, 1, 2, 3], appele: null }))], roster);
    expect(repos.find((x) => x.adversaireId === "e")).toBeUndefined();
  });

  it("compte une défaite quand le camp du joueur perd, et suit le camp en défense", () => {
    const r = calculerRivalites("c", [partie(donnes(10, { points: 30 }))], roster); // contrat chuté : c (défense) gagne contre a et b
    const contreA = r.find((x) => x.adversaireId === "a")!;
    expect(contreA).toMatchObject({ nom: "A", donnes: 10, victoires: 10 });
    expect(r.find((x) => x.adversaireId === "d")).toBeUndefined(); // d est dans le même camp
  });

  it("regroupe les identités fusionnées sous la fiche cible", () => {
    const fusion: Fiche[] = [...roster, { id: "z", nom: "Z", creee: "", actif: false, redirigeVers: "c" }];
    const p: PartieAnalysee = { ...partie(donnes(5, { points: 60 })), joueursId: ["a", "b", "z", "d", "e"] };
    const r = calculerRivalites("a", [p, partie(donnes(5, { points: 60 }))], fusion);
    expect(r.find((x) => x.adversaireId === "c")?.donnes).toBe(10);
  });
});

describe("bilanRivalites", () => {
  const riv = (adversaireId: string, donnes: number, victoires: number) => ({ adversaireId, nom: adversaireId, donnes, victoires });
  it("désigne la bête noire et la victime parmi les adversaires assez affrontés", () => {
    const { beteNoire, victime } = bilanRivalites([
      riv("x", DONNES_RIVALITE_MIN, 5),
      riv("y", DONNES_RIVALITE_MIN, 15),
      riv("z", 3, 0), // trop peu de donnes
    ]);
    expect(beteNoire?.adversaireId).toBe("x");
    expect(victime?.adversaireId).toBe("y");
  });
  it("ne cite personne sans assez de donnes, ni un adversaire qui n'est pas vraiment une bête noire", () => {
    expect(bilanRivalites([riv("x", 5, 0)])).toEqual({ beteNoire: null, victime: null });
    expect(bilanRivalites([riv("x", 30, 20)]).beteNoire).toBeNull();
  });
});
