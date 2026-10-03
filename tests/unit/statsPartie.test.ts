import { describe, it, expect } from "vitest";
import { calculerStatsPartie } from "@/domain/stats/statsPartie";
import type { Donne } from "@/domain/score/regles";

const joueurs = ["Andry", "Fara", "Lian", "Marc", "Nina"];

const donneBase: Omit<Donne, "points"> = {
  table: [0, 1, 2, 3, 4],
  preneur: 0,
  appele: 1,
  contrat: "garde",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
};

describe("calculerStatsPartie", () => {
  it("retourne des compteurs à zéro sur une partie vierge", () => {
    const stats = calculerStatsPartie([], joueurs, 5);
    expect(stats).toEqual({
      nbDonnes: 0,
      reussies: 0,
      chutees: 0,
      avecAppele: 0,
      preneurSeul: 0,
      roisAppeles: [],
      joueursAppeles: [],
    });
  });

  it("cumule réussites/chutes, mains appelées, rois et joueurs appelés sur un mélange de donnes", () => {
    const donnes: Donne[] = [
      // réussie, à 5 avec appelé (Fara), roi Cœur
      { ...donneBase, preneur: 0, appele: 1, roiAppele: "coeur", points: 60 },
      // chute, à 5 avec appelé (Lian), roi Carreau
      { ...donneBase, preneur: 0, appele: 2, roiAppele: "carreau", points: 30 },
      // réussie, à 5, preneur seul (pas d'appelé)
      { ...donneBase, preneur: 3, appele: null, points: 60 },
      // réussie, à 5 avec appelé de nouveau Fara, roi Cœur de nouveau
      { ...donneBase, preneur: 4, appele: 1, roiAppele: "coeur", points: 60 },
      // réussie, à 4 joueurs (pas de mécanique d'appelé) : ne compte ni pour
      // avecAppele/preneurSeul, ni pour roisAppeles (roiAppele absent)
      { ...donneBase, table: [0, 1, 2, 3], preneur: 0, appele: null, points: 60 },
    ];

    const stats = calculerStatsPartie(donnes, joueurs, 5);

    expect(stats.nbDonnes).toBe(5);
    expect(stats.reussies).toBe(4);
    expect(stats.chutees).toBe(1);
    expect(stats.avecAppele).toBe(3);
    expect(stats.preneurSeul).toBe(1);
    expect(stats.roisAppeles).toEqual([{ roi: "coeur", fois: 2 }, { roi: "carreau", fois: 1 }]);
    expect(stats.joueursAppeles).toEqual([{ joueur: "Fara", fois: 2 }, { joueur: "Lian", fois: 1 }]);
  });

  it("ignore les donnes sans roiAppele enregistré (archives antérieures à son introduction)", () => {
    const donnes: Donne[] = [{ ...donneBase, preneur: 0, appele: 1, points: 60 }];
    const stats = calculerStatsPartie(donnes, joueurs, 5);
    expect(stats.avecAppele).toBe(1);
    expect(stats.roisAppeles).toEqual([]);
  });
});
