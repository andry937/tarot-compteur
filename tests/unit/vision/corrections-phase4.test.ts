import { describe, expect, it } from "vitest";
import { annulerDernierPli, ajouterCarte, carteDejaJouee, corrigerCarte, corrigerJoueur } from "@/vision/domain/corrections";
import { cartesJoueesDe, etatInitial, poser } from "@/vision/domain/machinePli";
import type { EtatSuivi } from "@/vision/domain/machinePli";
import { CONFIG5, jouerMainComplete, poserPli, ramasser } from "./aide";

const PLI1 = ["coeur-3", "coeur-9", "coeur-5", "coeur-12", "coeur-2"]; // gagné par le joueur 4
const PLI2 = ["trefle-7", "trefle-8", "trefle-1", "trefle-4", "trefle-10"]; // gagné par le joueur 3

function deuxPlis(): EtatSuivi {
  let e = etatInitial(CONFIG5);
  e = ramasser(poserPli(e, PLI1, 0), PLI1, 1000);
  return ramasser(poserPli(e, PLI2, 2000), PLI2, 3000);
}

describe("annulerDernierPli", () => {
  it("retire le dernier pli : ses cartes ne sont plus comptées, l'entame revient au gagnant du précédent", () => {
    const e = deuxPlis();
    const r = annulerDernierPli(e);
    expect(r.plis).toHaveLength(1);
    expect(cartesJoueesDe(r)).toEqual(PLI1);
    expect(r.entameAttendue).toBe(4);
    expect(r.phase).toBe("attente");
  });

  it("efface les alertes de ce pli, mais pas celles des plis précédents", () => {
    let e = deuxPlis();
    e = { ...e, alertes: [...e.alertes, { cle: "excuse-2", gravite: "info", pli: 2, message: "x" }, { cle: "autre", gravite: "info", pli: 1, message: "y" }] };
    const r = annulerDernierPli(e);
    expect(r.alertes.map((a) => a.cle)).toContain("autre");
    expect(r.alertes.some((a) => a.pli === 2)).toBe(false);
  });

  it("sans pli, ne fait rien ; les cartes du pli annulé peuvent être rejouées", () => {
    const vide = etatInitial(CONFIG5);
    expect(annulerDernierPli(vide)).toBe(vide);
    const r = poserPli(annulerDernierPli(deuxPlis()), PLI2, 2000);
    expect(r.plis).toHaveLength(2);
    expect(r.plis[1].gagnant).toBe(3);
  });

  it("annule aussi après la fin de la manche", () => {
    const fin = jouerMainComplete();
    expect(fin.phase).toBe("termine");
    expect(annulerDernierPli(fin).phase).toBe("attente");
  });
});

describe("corrigerCarte (identité d'une carte d'un pli terminé)", () => {
  it("le gagnant est recalculé, et l'entame du pli suivant avec", () => {
    // Le cavalier de cœur (rang d'arrivée 3, joueur 4) est lu « 4 de cœur » : le 9 de cœur gagne.
    const r = corrigerCarte(deuxPlis(), 1, 3, "coeur-4");
    expect(r.plis[0].poses.map((p) => p.carte)).toContain("coeur-4");
    expect(r.plis[0].gagnant).toBe(2);
    expect(r.plis[1].entame).toBe(2);
  });

  it("l'identité lue est gardée : remettre la carte d'origine redonne exactement l'état d'avant", () => {
    const avant = deuxPlis();
    const modifie = corrigerCarte(avant, 1, 3, "coeur-4");
    const retour = corrigerCarte(modifie, 1, 3, "coeur-12");
    expect(retour.plis).toEqual(avant.plis);
    expect(retour.entameAttendue).toBe(avant.entameAttendue);
  });

  it("refuse une carte déjà jouée, une carte inconnue, un rang ou un pli inexistant : état inchangé", () => {
    const e = deuxPlis();
    expect(corrigerCarte(e, 1, 0, "trefle-7")).toBe(e);
    expect(corrigerCarte(e, 1, 0, "atout-22")).toBe(e);
    expect(corrigerCarte(e, 1, 9, "coeur-4")).toBe(e);
    expect(corrigerCarte(e, 9, 0, "coeur-4")).toBe(e);
    expect(corrigerCarte(e, 1, 0, "coeur-3")).toBe(e); // déjà la bonne carte
  });

  it("un joueur imposé sur l'ancienne carte le reste sur la nouvelle", () => {
    let e = deuxPlis();
    e = corrigerJoueur(e, 1, "coeur-12", 1); // joueur imposé sur le cavalier
    const r = corrigerCarte(e, 1, 3, "coeur-4");
    expect(r.plis[0].surcharge?.joueurs).toEqual({ "coeur-4": 1 });
  });

  it("la correction se défait, et laisse le pli sans surcharge", () => {
    const e = corrigerCarte(deuxPlis(), 1, 3, "coeur-4");
    const back = corrigerCarte(e, 1, 3, "coeur-12");
    expect(back.plis[0].surcharge).toBeUndefined();
  });

  it("annuler le pli corrigé supprime aussi sa correction (les cartes sont relues)", () => {
    const r = annulerDernierPli(corrigerCarte(deuxPlis(), 2, 0, "trefle-2"));
    expect(r.plis).toHaveLength(1);
    expect(r.plis[0].surcharge).toBeUndefined();
  });
});

describe("ajouterCarte (carte manquée par la caméra)", () => {
  it("la carte ajoutée termine le pli et est attribuée au joueur indiqué", () => {
    // Quatre cartes vues ; le joueur 0 (dernier de l'entame) n'a pas été vu.
    let e = etatInitial(CONFIG5);
    e = poser(e, { carte: "coeur-3", joueur: 1, horodatage: 0 });
    e = poser(e, { carte: "coeur-9", joueur: 2, horodatage: 100 });
    e = poser(e, { carte: "coeur-5", joueur: 3, horodatage: 200 });
    e = poser(e, { carte: "coeur-12", joueur: 4, horodatage: 300 });
    const r = ajouterCarte(e, 0, "coeur-2", 400);
    expect(r.plis).toHaveLength(1);
    expect(r.plis[0].poses.find((p) => p.carte === "coeur-2")?.joueur).toBe(0);
    expect(r.plis[0].gagnant).toBe(4);
    expect(r.phase).toBe("complet");
  });

  it("refuse une carte déjà jouée, un joueur déjà servi, un joueur hors table, une carte inconnue, une manche finie", () => {
    const e = poserPli(etatInitial(CONFIG5), PLI1.slice(0, 2), 0);
    expect(ajouterCarte(e, 2, "coeur-4", 500)).toBe(e); // le joueur 2 a déjà joué
    expect(ajouterCarte(e, 4, "coeur-3", 500)).toBe(e); // carte déjà jouée
    expect(ajouterCarte(e, 4, "atout-22", 500)).toBe(e);
    expect(ajouterCarte(e, 9, "atout-1", 500)).toBe(e);
    const fin = jouerMainComplete();
    expect(ajouterCarte(fin, 0, "excuse", 9e9)).toBe(fin);
  });

  it("l'horodatage ajouté est postérieur aux cartes déjà posées", () => {
    const e = poserPli(etatInitial(CONFIG5), PLI1.slice(0, 2), 0);
    const r = ajouterCarte(e, 4, "coeur-4", 0);
    const ajoutee = r.poseCourante.find((p) => p.carte === "coeur-4")!;
    expect(ajoutee.horodatage).toBeGreaterThan(Math.max(...e.poseCourante.map((p) => p.horodatage)));
  });

  it("carteDejaJouee dit où la carte se trouve", () => {
    const e = deuxPlis();
    expect(carteDejaJouee(e, "trefle-7")).toBe(2);
    expect(carteDejaJouee(e, "pique-1")).toBeNull();
  });

  it("une carte du chien ou de l'écart ne peut pas être ajoutée au pli en cours", () => {
    const e = { ...etatInitial(CONFIG5), chien: ["atout-3"], ecart: ["pique-9"] };
    expect(carteDejaJouee(e, "atout-3")).toBe("chien");
    expect(carteDejaJouee(e, "pique-9")).toBe("ecart");
    expect(ajouterCarte(e, 0, "atout-3", 0)).toBe(e);
    expect(ajouterCarte(e, 0, "pique-9", 0)).toBe(e);
  });
});

describe("pureté", () => {
  it("aucune correction de phase 4 ne modifie l'état reçu", () => {
    const e = deuxPlis();
    const avant = JSON.stringify(e);
    annulerDernierPli(e);
    corrigerCarte(e, 1, 3, "coeur-4");
    ajouterCarte(poserPli(etatInitial(CONFIG5), PLI1.slice(0, 2), 0), 4, "coeur-4", 500);
    expect(JSON.stringify(e)).toBe(avant);
  });
});
