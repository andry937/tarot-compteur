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

describe("repos équilibré d'après l'historique", () => {
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
      const table = tableEquilibree(t.donnes, TOTAL, PAR_DONNE, t.partie.depart);
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

describe("repos équilibré : parties réelles", () => {
  const tableSans = (repos: number[], total: number) =>
    ({ table: Array.from({ length: total }, (_, i) => i).filter((i) => !repos.includes(i)) } as unknown as Donne);
  const comptes = (donnes: Donne[], total: number) =>
    Array.from({ length: total }, (_, i) => donnes.filter((d) => d.table.includes(i)).length);

  it("part d'un historique déséquilibré (8 joueurs) : fait jouer les moins servis", () => {
    // Julie, Fabrice, Fara, Xander, Liantsoa, Koto, Andry, Cedric : Cedric n'a joué que 3 donnes sur 7.
    const repos = [[5, 6, 7], [2, 5, 7], [0, 3, 6], [1, 4, 7], [0, 2, 5], [1, 3, 6], [2, 4, 7]];
    const donnes = repos.map((r) => tableSans(r, 8));
    expect(comptes(donnes, 8)).toEqual([5, 5, 4, 5, 5, 4, 4, 3]);
    const table = tableEquilibree(donnes, 8, 5, 0);
    expect(table[0]).toBe(7); // Cedric distribue, donc joue
    // Les trois moins servis (Fara, Koto, Andry) jouent tous.
    expect(table).toEqual(expect.arrayContaining([2, 5, 6, 7]));
    expect(table).toHaveLength(5);
  });

  it("rattrape un historique déséquilibré : écart d'au plus 1 après quelques cycles", () => {
    const repos = [[5, 6, 7], [2, 5, 7], [0, 3, 6], [1, 4, 7], [0, 2, 5], [1, 3, 6], [2, 4, 7]];
    let donnes = repos.map((r) => tableSans(r, 8));
    for (let k = 7; k < 16; k++) donnes = [...donnes, { table: tableEquilibree(donnes, 8, 5, 0) } as unknown as Donne];
    expect(comptes(donnes, 8)).toEqual(new Array(8).fill(10));
  });

  it.each([6, 7, 8, 9, 10])("%i joueurs, depuis zéro : tout le monde joue autant (écart d'au plus 1 en cours de route)", (total) => {
    let donnes: Donne[] = [];
    for (let k = 0; k < total * 2; k++) {
      donnes = [...donnes, { table: tableEquilibree(donnes, total, 5, 0) } as unknown as Donne];
      const c = comptes(donnes, total);
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
    }
    expect(comptes(donnes, total)).toEqual(new Array(total).fill(10));
  });

  it("personne ne se repose deux donnes de suite quand on peut l'éviter (7 joueurs)", () => {
    let donnes: Donne[] = [];
    for (let k = 0; k < 14; k++) {
      const table = tableEquilibree(donnes, 7, 5, 0);
      const dernier = donnes[donnes.length - 1]?.table;
      if (dernier) {
        const reposes = [...Array(7).keys()].filter((i) => !table.includes(i));
        expect(reposes.some((i) => !dernier.includes(i))).toBe(false);
      }
      donnes = [...donnes, { table } as unknown as Donne];
    }
  });
});
