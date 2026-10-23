import { describe, expect, it } from "vitest";
import { corrigerEntame, corrigerGagnant, corrigerJoueur, effacerCorrections } from "@/vision/domain/corrections";
import { cartesJoueesDe, etatInitial } from "@/vision/domain/machinePli";
import { construirePiles } from "@/vision/domain/piles";
import { CONFIG5, appliquerTout, poserPli, ramasser, valide } from "./aide";

// Entame du joueur 1 : les joueurs 1, 2, 3, 4, 0 posent dans l'ordre ; le roi de cœur (joueur 4) l'emporte.
const PLI1 = ["coeur-2", "coeur-9", "coeur-5", "coeur-14", "coeur-3"];
const PLI2 = ["pique-2", "pique-9", "pique-5", "pique-14", "pique-3"];
const cles = (e: { alertes: { cle: string }[] }) => e.alertes.map((a) => a.cle);
const joueursDuPli = (e: ReturnType<typeof etatInitial>, k: number) => e.plis[k].poses.map((p) => p.joueur);

function deuxPlis() {
  let etat = poserPli(etatInitial(CONFIG5), PLI1, 0);
  etat = ramasser(etat, PLI1, 3000);
  etat = poserPli(etat, PLI2, 5000);
  return ramasser(etat, PLI2, 8000);
}

describe("corrections — entame", () => {
  it("impose l'entame du pli en cours : les cartes déjà posées changent de joueur", () => {
    let etat = poserPli(etatInitial(CONFIG5), PLI1.slice(0, 2), 0);
    expect(etat.poseCourante.map((p) => p.joueur)).toEqual([1, 2]);
    etat = corrigerEntame(etat, "courant", 3);
    expect(etat.poseCourante.map((p) => p.joueur)).toEqual([3, 4]);
    expect(etat.entameAttendue).toBe(3);
    etat = appliquerTout(etat, PLI1.slice(2).map((c, i) => valide(c, 1000 + i * 500)));
    expect(etat.plis[0].entame).toBe(3);
    expect(joueursDuPli(etat, 0)).toEqual([3, 4, 0, 1, 2]);
    expect(etat.plis[0].surcharge).toEqual({ entame: 3 });
    expect(etat.surchargeCourante).toEqual({});
  });

  it("corrige l'entame d'un pli terminé et propage au suivant : l'entame du pli 2 est le gagnant du pli 1", () => {
    const etat = corrigerEntame(deuxPlis(), 1, 0);
    // Entame 0 : les cartes passent aux joueurs 0, 1, 2, 3, 4 ; le roi de cœur est au joueur 3.
    expect(joueursDuPli(etat, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(etat.plis[0].gagnant).toBe(3);
    expect(etat.plis[1].entame).toBe(3);
    expect(joueursDuPli(etat, 1)).toEqual([3, 4, 0, 1, 2]);
  });

  it("`null` revient à la déduction", () => {
    const etat = corrigerEntame(corrigerEntame(deuxPlis(), 1, 0), 1, null);
    expect(etat.plis[0].surcharge).toBeUndefined();
    expect(joueursDuPli(etat, 0)).toEqual([1, 2, 3, 4, 0]);
  });
});

describe("corrections — joueur d'une carte", () => {
  it("place une carte chez un joueur, les autres prennent les places restantes dans l'ordre d'arrivée", () => {
    const etat = corrigerJoueur(poserPli(etatInitial(CONFIG5), PLI1, 0), 1, "coeur-14", 0);
    expect(etat.plis[0].poses.map((p) => [p.carte, p.joueur])).toEqual([
      ["coeur-2", 1], ["coeur-9", 2], ["coeur-5", 3], ["coeur-3", 4], ["coeur-14", 0],
    ]);
    // Le gagnant et l'ordre de jeu suivent : le roi est maintenant au joueur 0.
    expect(etat.plis[0].gagnant).toBe(0);
    expect(etat.entameAttendue).toBe(0);
    expect(cartesJoueesDe(etat)).toEqual(["coeur-2", "coeur-9", "coeur-5", "coeur-3", "coeur-14"]);
  });

  it("agit sur le pli en cours", () => {
    let etat = poserPli(etatInitial(CONFIG5), PLI1.slice(0, 2), 0);
    etat = corrigerJoueur(etat, "courant", "coeur-9", 4);
    expect(etat.poseCourante.map((p) => [p.carte, p.joueur])).toEqual([["coeur-2", 1], ["coeur-9", 4]]);
  });

  it("une place n'a qu'une carte : imposer un joueur déjà pris libère l'autre carte", () => {
    let etat = poserPli(etatInitial(CONFIG5), PLI1.slice(0, 2), 0);
    etat = corrigerJoueur(etat, "courant", "coeur-2", 3);
    etat = corrigerJoueur(etat, "courant", "coeur-9", 3);
    expect(etat.surchargeCourante.joueurs).toEqual({ "coeur-9": 3 });
    expect(etat.poseCourante.map((p) => [p.carte, p.joueur])).toEqual([["coeur-2", 1], ["coeur-9", 3]]);
  });

  it("ignore un joueur absent de la table", () => {
    const etat = poserPli(etatInitial(CONFIG5), PLI1, 0);
    expect(corrigerJoueur(etat, 1, "coeur-14", 9)).toBe(etat);
    expect(corrigerEntame(etat, 1, 9)).toBe(etat);
    expect(corrigerGagnant(etat, 1, 9)).toBe(etat);
  });

  it("ignore un pli qui n'existe pas", () => {
    const etat = poserPli(etatInitial(CONFIG5), PLI1, 0);
    expect(corrigerGagnant(etat, 7, 2)).toBe(etat);
  });
});

describe("corrections — gagnant", () => {
  it("impose le gagnant, qui entame le pli suivant et reçoit le pli dans sa pile", () => {
    const etat = corrigerGagnant(deuxPlis(), 1, 2);
    expect(etat.plis[0].gagnant).toBe(2);
    expect(etat.plis[1].entame).toBe(2);
    expect(joueursDuPli(etat, 1)).toEqual([2, 3, 4, 0, 1]);
    // Le roi de pique est au joueur 0 : le pli 2 revient à celui qui l'a posé.
    expect(etat.plis[1].gagnant).toBe(0);
    const piles = construirePiles(etat.plis);
    expect(piles[2]).toEqual(PLI1);
    expect(piles[0]).toEqual(PLI2);
  });

  it("`null` revient aux règles du tarot", () => {
    const etat = corrigerGagnant(corrigerGagnant(deuxPlis(), 1, 2), 1, null);
    expect(etat.plis[0].gagnant).toBe(4);
    expect(etat.plis[0].surcharge).toBeUndefined();
  });
});

describe("corrections — général", () => {
  it("efface toutes les corrections d'un pli", () => {
    let etat = corrigerEntame(deuxPlis(), 1, 0);
    etat = corrigerGagnant(etat, 1, 2);
    etat = effacerCorrections(etat, 1);
    expect(etat.plis[0].surcharge).toBeUndefined();
    expect(joueursDuPli(etat, 0)).toEqual([1, 2, 3, 4, 0]);
    expect(etat.plis[0].gagnant).toBe(4);
  });

  it("ne modifie jamais l'état reçu", () => {
    const avant = deuxPlis();
    const copie = JSON.stringify(avant);
    corrigerEntame(avant, 1, 0);
    corrigerJoueur(avant, 1, "coeur-14", 0);
    corrigerGagnant(avant, 2, 3);
    expect(JSON.stringify(avant)).toBe(copie);
  });

  it("refait les alertes déduites des plis (renonces) après une correction", () => {
    // Joueur 2 pose un atout sur du cœur au pli 1, puis du cœur au pli 2 : renonce. En lui rendant la carte de cœur
    // du pli 1 (et son atout au joueur 3), il n'y a plus de renonce du joueur 2.
    const pli1 = ["coeur-2", "atout-9", "coeur-5", "coeur-14", "coeur-3"];
    let etat = poserPli(etatInitial(CONFIG5), pli1, 0);
    etat = ramasser(etat, pli1, 3000);
    etat = poserPli(etat, ["coeur-4", "coeur-6", "coeur-7", "coeur-8", "coeur-10"], 5000);
    expect(cles(etat)).toContain("renonce-2-coeur-2");
    const corrige = corrigerJoueur(corrigerJoueur(etat, 1, "atout-9", 3), 1, "coeur-5", 2);
    expect(cles(corrige)).not.toContain("renonce-2-coeur-2");
  });
});

describe("ordre ambigu", () => {
  const ambigu = (e: { alertes: { cle: string }[] }) => cles(e).filter((c) => c.startsWith("ordre-ambigu-"));

  it("prévient quand deux cartes arrivent presque ensemble", () => {
    const etat = appliquerTout(etatInitial(CONFIG5), [
      valide("coeur-2", 0), valide("coeur-9", 100), valide("coeur-5", 1000), valide("coeur-14", 2000), valide("coeur-3", 3000),
    ]);
    expect(ambigu(etat)).toEqual(["ordre-ambigu-1-coeur-2-coeur-9"]);
  });

  it("ne dit rien quand les cartes sont espacées", () => {
    expect(ambigu(poserPli(etatInitial(CONFIG5), PLI1, 0))).toEqual([]);
  });

  it("disparaît quand l'utilisateur fixe l'une des deux cartes", () => {
    const etat = appliquerTout(etatInitial(CONFIG5), [
      valide("coeur-2", 0), valide("coeur-9", 100), valide("coeur-5", 1000), valide("coeur-14", 2000), valide("coeur-3", 3000),
    ]);
    expect(ambigu(corrigerJoueur(etat, 1, "coeur-9", 2))).toEqual([]);
  });
});
