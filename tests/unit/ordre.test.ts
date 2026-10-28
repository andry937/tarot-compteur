import { describe, it, expect } from "vitest";
import { permuterSieges, tableEquilibree } from "@/domain/score/ordre";
import type { TablePermutable } from "@/domain/score/ordre";
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

describe("repos équilibré après un changement d'ordre", () => {
  const TOTAL = 7;
  const PAR_DONNE = 5;
  const vide = (table: number[]) => ({ table, preneur: table[0], appele: null, miseres: [] } as unknown as Donne);

  /** Joue 7 donnes en changeant l'ordre juste après la donne `apres` ; rend le nombre de donnes jouées par joueur (par identifiant). */
  function simuler(apres: number, ordre: number[]) {
    let t: TablePermutable = {
      partie: { joueursId: ["a", "b", "c", "d", "e", "f", "g"], joueursNomFige: [], parDonne: PAR_DONNE, depart: 0 },
      donnes: [],
      annulations: [],
    };
    for (let k = 0; k < TOTAL; k++) {
      if (k === apres) t = permuterSieges(t, ordre);
      const table = t.partie.ordreModifie
        ? tableEquilibree(t.donnes, TOTAL, PAR_DONNE, t.partie.depart)
        : tableDeLaDonne(k, TOTAL, PAR_DONNE, t.partie.depart);
      t = { ...t, donnes: [...t.donnes, vide(table)] };
    }
    const jouees: Record<string, number> = {};
    t.partie.joueursId.forEach((id, i) => (jouees[id] = t.donnes.filter((d) => d.table.includes(i)).length));
    return jouees;
  }

  const ordres = [
    [1, 0, 2, 3, 4, 5, 6],
    [6, 5, 4, 3, 2, 1, 0],
    [3, 4, 5, 6, 0, 1, 2],
    [0, 2, 1, 4, 3, 6, 5],
    [2, 0, 1, 5, 6, 3, 4],
  ];

  it("chacun a joué 5 donnes au bout de 7, quel que soit le moment et le nouvel ordre", () => {
    for (let apres = 1; apres <= 5; apres++) {
      for (const ordre of ordres) {
        expect(Object.values(simuler(apres, ordre)), `après ${apres} donnes, ordre ${ordre}`).toEqual(
          new Array(TOTAL).fill(5)
        );
      }
    }
  });

  it("ne met jamais le donneur au repos", () => {
    const donnes = [vide([0, 1, 2, 3, 4]), vide([1, 2, 3, 4, 5])];
    expect(tableEquilibree(donnes, TOTAL, PAR_DONNE, 0)[0]).toBe(2);
  });
});
