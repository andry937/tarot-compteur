import { describe, it, expect } from "vitest";
import { appeleDetecte, scoresDirects } from "@/vision/domain/annonce";
import { etatInitial } from "@/vision/domain/machinePli";
import { CONFIG5, ramasser, poserPli } from "./aide";

// Pli 1 (le joueur 1 entame) : le roi de cœur est joué par le joueur 2 ; le XII du joueur 3 gagne.
const CARTES = ["atout-5", "coeur-14", "atout-12", "excuse", "atout-3"];

describe("annonce et scores en direct", () => {
  it("ne connaît pas l'appelé tant que le roi appelé n'est pas posé", () => {
    const etat = etatInitial(CONFIG5);
    expect(appeleDetecte(etat, { preneur: 3, roiAppele: "coeur" })).toBeUndefined();
    expect(appeleDetecte(etat, { preneur: 3, roiAppele: null })).toBeNull();
  });

  it("découvre l'appelé dès que son roi est posé, même avant la fin du pli", () => {
    const etat = poserPli(etatInitial(CONFIG5), CARTES.slice(0, 2), 0);
    expect(appeleDetecte(etat, { preneur: 3, roiAppele: "coeur" })).toBe(2);
  });

  it("considère que le preneur joue seul quand il pose lui-même le roi appelé", () => {
    const etat = poserPli(etatInitial(CONFIG5), CARTES.slice(0, 2), 0);
    expect(appeleDetecte(etat, { preneur: 2, roiAppele: "coeur" })).toBeNull();
  });

  it("compte les points des piles pour chaque camp, une fois l'appelé découvert", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES, 0);
    etat = ramasser(etat, CARTES, 1000);
    // Le joueur 3 gagne le pli (4 cartes = 4,5 + 0,5 × 3 = 6) ; l'Excuse (4,5) reste au joueur 4.
    const preneur3 = scoresDirects(etat, { preneur: 3, roiAppele: "coeur" });
    expect(preneur3.appele).toBe(2);
    expect(preneur3.attaque).toBe(6);
    expect(preneur3.defense).toBe(4.5);
    expect(preneur3.plisRestants).toBe(14);

    const preneur4 = scoresDirects(etat, { preneur: 4, roiAppele: null });
    expect(preneur4.attaque).toBe(4.5);
    expect(preneur4.defense).toBe(6);
  });
});
