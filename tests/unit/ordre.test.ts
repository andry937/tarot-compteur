import { describe, it, expect } from "vitest";
import { permuterSieges } from "@/domain/score/ordre";
import { calculer, tableDeLaDonne } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";

const donne: Donne = {
  table: [1, 2, 3, 4, 0],
  donneur: 1,
  preneur: 3,
  appele: 0,
  contrat: "garde",
  bouts: 2,
  points: 50,
  petitAuBout: "aucun",
  poignees: [{ id: "p", joueur: 2, taille: "simple" }],
  chelem: "aucun",
  miseres: [{ id: "m", joueur: 4, type: "atout", aTort: false }],
  roiAppele: "coeur",
} as Donne;

const base = {
  partie: { joueursId: ["a", "b", "c", "d", "e"], joueursNomFige: ["A", "B", "C", "D", "E"], parDonne: 5, depart: 1 },
  donnes: [donne],
  annulations: [],
};

describe("permuterSieges", () => {
  const ordre = [4, 3, 2, 1, 0]; // inversion
  const r = permuterSieges(base, ordre);

  it("réordonne les joueurs", () => {
    expect(r.partie.joueursId).toEqual(["e", "d", "c", "b", "a"]);
    expect(r.partie.joueursNomFige).toEqual(["E", "D", "C", "B", "A"]);
  });

  it("garde les scores de chaque joueur", () => {
    const avant = calculer(donne, 5).scores;
    const apres = calculer(r.donnes[0], 5).scores;
    ordre.forEach((ancien, nouveau) => expect(apres[nouveau]).toBe(avant[ancien]));
  });

  it("garde le même donneur pour la prochaine donne", () => {
    const avant = tableDeLaDonne(1, 5, 5, base.partie.depart)[0];
    const apres = tableDeLaDonne(1, 5, 5, r.partie.depart)[0];
    expect(r.partie.joueursId[apres]).toBe(base.partie.joueursId[avant]);
  });
});
