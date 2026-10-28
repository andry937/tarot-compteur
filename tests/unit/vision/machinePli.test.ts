import { describe, it, expect } from "vitest";
import { deriverPlis } from "@/domain/cartes/cartes";
import { appliquer, cartesJoueesDe, etatInitial, plisRestants } from "@/vision/domain/machinePli";
import { versSortie } from "@/vision/contrat";
import {
  CONFIG5, ECART5, MAIN5, TABLE5, appliquerTout, jouerMainComplete, poserPli, ramasser, retire, valide,
} from "./aide";

// Pli de référence : le joueur 1 entame, le XII du joueur 3 l'emporte (l'Excuse ne gagne jamais).
const CARTES = ["atout-5", "coeur-14", "atout-12", "excuse", "atout-3"];
const JOUEURS = [1, 2, 3, 4, 0];

const cles = (etat: { alertes: { cle: string }[] }) => etat.alertes.map((a) => a.cle);

describe("machinePli — un pli", () => {
  it("attend le pli, puis le complète et désigne le gagnant avec les règles existantes", () => {
    let etat = etatInitial(CONFIG5);
    expect(etat.phase).toBe("attente");
    etat = poserPli(etat, CARTES.slice(0, 3), 0);
    expect(etat.phase).toBe("enCours");
    expect(etat.plis).toHaveLength(0);
    etat = poserPli(etat, CARTES.slice(3), 1500);
    expect(etat.phase).toBe("complet");
    expect(etat.plis).toHaveLength(1);
    expect(etat.plis[0]).toMatchObject({ numero: 1, entame: 1, gagnant: 3 });
    expect(etat.plis[0].poses.map((p) => p.joueur)).toEqual(JOUEURS);
    expect(cartesJoueesDe(etat)).toEqual(CARTES);
    expect(etat.entameAttendue).toBe(3);
    expect(plisRestants(etat)).toBe(14);
  });

  it("reconstitue l'ordre de jeu d'après les horodatages, même si les événements arrivent dans le désordre", () => {
    const etat = appliquerTout(etatInitial(CONFIG5), [
      valide("atout-12", 200), valide("coeur-14", 100), valide("atout-3", 400),
      valide("atout-5", 0), valide("excuse", 300),
    ]);
    expect(etat.plis[0].poses.map((p) => p.joueur)).toEqual(JOUEURS);
  });

  it("passe en ramassage puis en attente quand la table se vide, et le gagnant entame le pli suivant", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES, 0);
    etat = appliquer(etat, retire("atout-5", 1000));
    expect(etat.phase).toBe("ramassage");
    etat = ramasser(etat, CARTES.slice(1), 1100);
    expect(etat.phase).toBe("attente");
    const suite = ["coeur-2", "coeur-3", "coeur-4", "coeur-5", "coeur-6"];
    etat = poserPli(etat, suite, 2000);
    expect(etat.plis[1]).toMatchObject({ numero: 2, entame: 3, gagnant: 2 });
    expect(etat.alertes.filter((a) => a.gravite !== "info")).toEqual([]);
  });

  it("ignore, sans alerte, les cartes du dernier pli qui réapparaissent avant le ramassage", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES, 0);
    etat = appliquer(etat, valide("atout-12", 900));
    expect(etat.plis).toHaveLength(1);
    expect(etat.alertes.filter((a) => a.cle.startsWith("deja-jouee"))).toEqual([]);
  });

  it("attribue les cartes par l'ordre d'arrivée : la première au joueur qui entame, puis le tour de table", () => {
    const inverse = [...CARTES].reverse();
    const etat = poserPli(etatInitial(CONFIG5), inverse, 0);
    expect(etat.plis[0].poses.map((p) => [p.carte, p.joueur])).toEqual(inverse.map((c, i) => [c, JOUEURS[i]]));
    expect(etat.plis[0].entame).toBe(1);
  });

  it("signale l'Excuse sans bloquer", () => {
    const etat = poserPli(etatInitial(CONFIG5), CARTES, 0);
    expect(etat.alertes.find((a) => a.cle === "excuse-1")).toMatchObject({ gravite: "info" });
  });

});

describe("machinePli — incohérences (alertes non bloquantes)", () => {
  it("refuse une carte déjà jouée à un pli précédent", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES, 0);
    etat = ramasser(etat, CARTES, 1000);
    etat = appliquer(etat, valide("atout-12", 2000));
    expect(etat.alertes.find((a) => a.cle === "deja-jouee-atout-12")).toMatchObject({ gravite: "erreur" });
    expect(etat.poseCourante).toHaveLength(0);
  });

  it("ignore une carte inconnue", () => {
    let etat = etatInitial({ table: [0, 1, 2, 3], entameInitiale: 1 });
    etat = appliquer(etat, valide("n-importe-quoi", 0));
    expect(cles(etat)).toEqual(["inconnue-n-importe-quoi"]);
    expect(etat.poseCourante).toHaveLength(0);
    expect(etat.phase).toBe("attente");
  });

  it("donne deux cartes qui arrivent de suite à deux joueurs successifs", () => {
    let etat = appliquer(etatInitial(CONFIG5), valide("atout-3", 0));
    etat = appliquer(etat, valide("atout-4", 100));
    expect(etat.poseCourante.map((p) => [p.carte, p.joueur])).toEqual([["atout-3", 1], ["atout-4", 2]]);
    expect(etat.alertes).toEqual([]);
  });

  it("retire du pli une carte qui disparaît avant la fin (fausse détection)", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES.slice(0, 2), 0);
    etat = appliquer(etat, retire("coeur-14", 500));
    expect(etat.poseCourante.map((p) => p.carte)).toEqual(["atout-5"]);
    etat = appliquer(etat, retire("atout-5", 600));
    expect(etat.phase).toBe("attente");
    expect(etat.poseCourante).toEqual([]);
  });

  it("note qu'un pli démarre avant que la table soit vidée", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES, 0);
    etat = appliquer(etat, valide("coeur-2", 2000));
    expect(etat.phase).toBe("enCours");
    expect(cles(etat)).toContain("ramassage-incomplet-1");
  });

  it("retire du pli une carte déplacée vers le chien, et redonne leur place aux suivantes", () => {
    let etat = poserPli(etatInitial(CONFIG5), ["atout-3", "coeur-2"], 0);
    etat = appliquer(etat, { type: "deplacee", carte: "atout-3", de: "table", vers: "chien", t: 500 });
    expect(etat.poseCourante).toEqual([{ carte: "coeur-2", joueur: 1, horodatage: 500 }]);
  });

  it("n'altère pas un pli terminé quand une carte est déplacée après coup", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES, 0);
    etat = appliquer(etat, { type: "deplacee", carte: "atout-12", de: "table", vers: "chien", t: 900 });
    expect(etat.plis[0].gagnant).toBe(3);
    expect(cles(etat)).toContain("deplacee-trop-tard-atout-12");
  });

  it("ne modifie jamais l'état précédent", () => {
    const avant = etatInitial(CONFIG5);
    const copie = JSON.stringify(avant);
    appliquer(avant, valide("atout-3", 0));
    expect(JSON.stringify(avant)).toBe(copie);
  });
});

describe("machinePli — chien et écart", () => {
  it("enregistre le chien scanné avant le jeu, sans le dépasser", () => {
    let etat = etatInitial(CONFIG5);
    for (const c of ["atout-1", "coeur-14", "pique-3", "trefle-2"]) etat = appliquer(etat, valide(c, 0, "chien"));
    expect(etat.chien).toEqual(["atout-1", "coeur-14", "pique-3"]);
    expect(cles(etat)).toContain("chien-trop-trefle-2");
    expect(etat.phase).toBe("attente");
  });

  it("autorise le jeu d'une carte du chien (le preneur l'a gardée) mais pas d'une carte de l'écart", () => {
    let etat = appliquer(etatInitial(CONFIG5), valide("atout-1", 0, "chien"));
    etat = appliquer(etat, valide("pique-2", 0, "ecart"));
    etat = poserPli(etat, ["atout-1", "coeur-14", "atout-12", "excuse", "atout-3"], 1000);
    expect(etat.plis).toHaveLength(1);
    expect(cles(etat).filter((c) => c.includes("atout-1"))).toEqual([]);
    const fautif = poserPli(appliquer(etatInitial(CONFIG5), valide("pique-2", 0, "ecart")), ["pique-2"], 1000);
    expect(cles(fautif)).toContain("ecart-jouee-pique-2");
  });

  it("ignore une carte vue dans la zone du chien pendant le jeu", () => {
    let etat = poserPli(etatInitial(CONFIG5), CARTES.slice(0, 2), 0);
    etat = appliquer(etat, valide("coeur-9", 500, "chien"));
    expect(etat.chien).toEqual([]);
    expect(cles(etat)).toContain("chien-pendant-jeu-coeur-9");
  });

  it("ne compte pas les cartes du chien comme une table non vidée", () => {
    let etat = appliquer(etatInitial(CONFIG5), valide("atout-1", 0, "chien"));
    etat = poserPli(etat, CARTES, 1000);
    etat = ramasser(etat, CARTES, 2000);
    expect(etat.phase).toBe("attente");
  });
});

describe("machinePli — manche complète", () => {
  const etat = jouerMainComplete();

  it("suit 15 plis, termine la manche et rend exactement la liste plate du comptage existant", () => {
    expect(etat.plis).toHaveLength(15);
    expect(etat.phase).toBe("termine");
    expect(plisRestants(etat)).toBe(0);
    expect(cartesJoueesDe(etat)).toEqual(MAIN5);
  });

  it("donne les mêmes gagnants que `deriverPlis`, sans alerte d'incohérence", () => {
    const { plis } = deriverPlis(TABLE5, 1, MAIN5);
    expect(etat.plis.map((p) => p.gagnant)).toEqual(plis.map((p) => p.gagnant));
    expect(etat.alertes.filter((a) => a.cle.startsWith("incoherence") || a.cle.startsWith("entame") || a.cle.startsWith("ordre"))).toEqual([]);
  });

  it("alimente le contrat d'intégration", () => {
    const sortie = versSortie(etat);
    expect(sortie.termine).toBe(true);
    expect(sortie.plisRestants).toBe(0);
    expect(sortie.cartesJouees).toHaveLength(75);
    expect(sortie.cartesJouees.some((c) => ECART5.includes(c))).toBe(false);
    expect(sortie.chien).toEqual([]);
  });

  it("ne passe en « terminé » qu'une fois la table vidée", () => {
    const { plis } = deriverPlis(TABLE5, 1, MAIN5);
    const dernier = plis[14];
    let partiel = etatInitial(CONFIG5);
    plis.slice(0, 14).forEach((p, k) => {
      partiel = ramasser(poserPli(partiel, p.cartes, k * 2000), p.cartes, k * 2000 + 1000);
    });
    partiel = poserPli(partiel, dernier.cartes, 40000);
    expect(partiel.phase).toBe("complet");
    expect(versSortie(partiel).termine).toBe(false);
    partiel = ramasser(partiel, dernier.cartes, 41000);
    expect(partiel.phase).toBe("termine");
  });
});
