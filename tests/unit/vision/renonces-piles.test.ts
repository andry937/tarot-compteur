import { describe, it, expect } from "vitest";
import { detecterRenonces } from "@/vision/domain/renonces";
import { construirePiles, pointsAttaque, pointsDe } from "@/vision/domain/piles";
import { gagnantDuPli } from "@/domain/cartes/cartes";
import type { PliJoue } from "@/vision/domain/machinePli";
import { ECART5, jouerMainComplete } from "./aide";

/** Fabrique un pli : `entries` = [joueur, carte] dans l'ordre de jeu. */
function pli(numero: number, entries: Array<[number, string]>): PliJoue {
  const poses = entries.map(([joueur, carte], i) => ({ carte, joueur, horodatage: i }));
  return { numero, poses, entame: poses[0].joueur, gagnant: poses[gagnantDuPli(poses.map((p) => p.carte))].joueur };
}

const cles = (plis: PliJoue[]) => detecterRenonces(plis).map((a) => a.cle);

describe("détection de renonce après coup", () => {
  it("signale un joueur qui coupe puis joue plus tard la couleur qu'il disait ne plus avoir", () => {
    const plis = [
      pli(1, [[0, "coeur-5"], [1, "atout-3"]]),
      pli(2, [[0, "pique-5"], [1, "pique-9"]]),
      pli(3, [[0, "carreau-5"], [1, "coeur-2"]]),
    ];
    expect(cles(plis)).toEqual(["renonce-1-coeur-3"]);
  });

  it("ne signale rien quand les joueurs fournissent toujours", () => {
    const plis = [pli(1, [[0, "coeur-5"], [1, "coeur-9"]]), pli(2, [[0, "pique-5"], [1, "pique-9"]])];
    expect(cles(plis)).toEqual([]);
  });

  it("exempte toujours l'Excuse", () => {
    const plis = [pli(1, [[0, "coeur-5"], [1, "excuse"]]), pli(2, [[0, "coeur-6"], [1, "coeur-2"]])];
    expect(cles(plis)).toEqual([]);
  });

  it("signale un joueur qui n'a ni fourni ni coupé puis joue de l'atout", () => {
    const plis = [pli(1, [[0, "coeur-5"], [1, "pique-9"]]), pli(2, [[0, "pique-5"], [1, "atout-4"]])];
    expect(cles(plis)).toEqual(["renonce-1-atout-2"]);
  });

  it("signale un atout non fourni à l'entame d'atout, puis joué plus tard", () => {
    const plis = [pli(1, [[0, "atout-10"], [1, "pique-9"]]), pli(2, [[0, "coeur-5"], [1, "atout-2"]])];
    expect(cles(plis)).toEqual(["renonce-1-atout-2"]);
  });

  it("signale un défaut de surcoupe prouvé par un atout plus fort joué ensuite", () => {
    const plis = [
      pli(1, [[0, "atout-10"], [1, "atout-5"]]),
      pli(2, [[0, "coeur-5"], [1, "atout-15"]]),
    ];
    expect(cles(plis)).toEqual(["surcoupe-1-1"]);
  });

  it("ne signale pas de défaut de surcoupe si le joueur ne joue ensuite que des atouts plus faibles", () => {
    const plis = [
      pli(1, [[0, "atout-10"], [1, "atout-5"]]),
      pli(2, [[0, "coeur-5"], [1, "atout-8"]]),
    ];
    expect(cles(plis)).toEqual([]);
  });
});

describe("piles et points", () => {
  it("donne le pli à son gagnant, sauf l'Excuse qui reste à celui qui l'a jouée", () => {
    const p = pli(1, [[1, "atout-5"], [2, "coeur-14"], [3, "atout-12"], [4, "excuse"], [0, "atout-3"]]);
    const piles = construirePiles([p]);
    expect(p.gagnant).toBe(3);
    expect(piles[3].sort()).toEqual(["atout-12", "atout-3", "atout-5", "coeur-14"]);
    expect(piles[4]).toEqual(["excuse"]);
    expect(pointsDe(piles[3])).toBe(0.5 + 0.5 + 0.5 + 4.5);
  });

  it("une manche complète répartit les 91 points : piles + écart (0,5 × 3)", () => {
    const etat = jouerMainComplete();
    const piles = construirePiles(etat.plis);
    const total = Object.values(piles).reduce((t, c) => t + pointsDe(c), 0);
    expect(total + pointsDe(ECART5)).toBe(91);
    expect(Object.values(piles).flat()).toHaveLength(75);
  });

  it("calcule les points de l'attaque (preneur seul, ou avec l'appelé)", () => {
    const piles = { 0: ["coeur-14", "atout-21"], 1: ["atout-3"], 2: ["pique-13"] };
    expect(pointsAttaque(piles, 0, null)).toBe(9);
    expect(pointsAttaque(piles, 0, 2)).toBe(12.5);
    expect(pointsAttaque(piles, 0, 0)).toBe(9);
    expect(pointsAttaque({}, 3, null)).toBe(0);
  });
});
