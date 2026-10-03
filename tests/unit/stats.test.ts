import { describe, it, expect } from "vitest";
import { calculer } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import { roleDe, calculerStatsJoueur } from "@/domain/stats/stats";
import type { PartieAnalysee } from "@/domain/stats/stats";

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

describe("roleDe", () => {
  const d: Donne = { ...donneBase, points: 60 }; // seuil 51, réussi
  const resultat = calculer(d, 5);

  it("identifie le preneur", () => {
    expect(roleDe(d, resultat, 0)).toBe("preneur");
  });

  it("identifie l'appelé", () => {
    expect(roleDe(d, resultat, 1)).toBe("appele");
  });

  it("identifie la défense", () => {
    expect(roleDe(d, resultat, 2)).toBe("defense");
  });

  it("identifie le repos (joueur absent de la table)", () => {
    const d4: Donne = { ...donneBase, table: [0, 1, 2, 3], appele: null, points: 60 };
    const res4 = calculer(d4, 5); // 5 joueurs au total, seuls 4 à table -> le 5e est au repos
    expect(roleDe(d4, res4, 4)).toBe("repos");
  });
});

describe("calculerStatsJoueur", () => {
  it("cumule points, rôles, contrats, rois appelés et meilleure/pire donne sur plusieurs parties", () => {
    const partie1: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d", "e"],
      donnes: [
        // a preneur, réussi, roi Cœur appelé
        { ...donneBase, preneur: 0, appele: 1, contrat: "garde", roiAppele: "coeur", points: 60 },
        // b preneur (chute), a appelé
        { ...donneBase, preneur: 1, appele: 0, contrat: "petite", roiAppele: "pique", points: 40 },
      ],
    };
    const partie2: PartieAnalysee = {
      archiveId: "p2",
      date: "2026-01-02T00:00:00.000Z",
      joueursId: ["a", "x", "y", "z"],
      donnes: [
        // table à 4 : b (index 1) preneur réussi, a (index 0) en défense
        { ...donneBase, table: [0, 1, 2, 3], preneur: 1, appele: null, contrat: "garde_sans", points: 60 },
      ],
    };

    const stats = calculerStatsJoueur("a", [partie1, partie2]);

    expect(stats.partiesJouees).toBe(2);
    expect(stats.donneesJouees).toBe(3);
    expect(stats.pointsTotaux).toBe(-36);

    expect(stats.parRole.preneur).toEqual({ donnes: 1, victoires: 1 });
    expect(stats.parRole.appele).toEqual({ donnes: 1, victoires: 0 });
    expect(stats.parRole.defense).toEqual({ donnes: 1, victoires: 0 });

    expect(stats.appelsReussis).toEqual([
      {
        archiveId: "p1",
        date: partie1.date,
        indexDonne: 0,
        contrat: "garde",
        bouts: 1,
        boutsPrecis: [],
        points: 60,
        reussi: true,
      },
    ]);
    expect(stats.appelsEchoues).toEqual([]);
    expect(stats.roisAppelesParLui).toEqual([{ roi: "coeur", fois: 1 }]);
    expect(stats.foisAppele).toBe(1);

    expect(stats.meilleureDonne).toMatchObject({ archiveId: "p1", points: 136 });
    expect(stats.pireDonne).toMatchObject({ archiveId: "p2", points: -136 });

    expect(stats.parties).toEqual([
      { archiveId: "p1", date: partie1.date, points: 100, nbDonnes: 2 },
      { archiveId: "p2", date: partie2.date, points: -136, nbDonnes: 1 },
    ]);

    // Trajectoire chronologique et dense : 136 (p1/d0) -> 136-36=100 (p1/d1) -> 100-136=-36 (p2/d0)
    expect(stats.trajectoire).toEqual([
      { index: 1, cumul: 136 },
      { index: 2, cumul: 100 },
      { index: 3, cumul: -36 },
    ]);
  });

  it("classe les appels du joueur en réussis/échoués, avec bouts et points bruts", () => {
    const partie1: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d", "e"],
      donnes: [
        { ...donneBase, preneur: 0, appele: 1, contrat: "garde", points: 60 }, // a preneur, réussi
        {
          ...donneBase,
          preneur: 1,
          appele: 0,
          contrat: "petite",
          points: 40,
          boutsPrecis: ["petit"],
        }, // b preneur, chute, avec Le Petit précisément en main
      ],
    };

    const stats = calculerStatsJoueur("b", [partie1]);

    expect(stats.appelsReussis).toEqual([]);
    expect(stats.appelsEchoues).toEqual([
      {
        archiveId: "p1",
        date: partie1.date,
        indexDonne: 1,
        contrat: "petite",
        bouts: 1,
        boutsPrecis: ["petit"],
        points: 40,
        reussi: false,
      },
    ]);
  });

  it("trie la trajectoire chronologiquement même si les parties sont reçues dans le désordre, sans changer l'ordre de `parties`", () => {
    const ancienne: PartieAnalysee = {
      archiveId: "vieille",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d", "e"],
      donnes: [{ ...donneBase, preneur: 0, appele: 1, points: 60 }], // a preneur, +136
    };
    const recente: PartieAnalysee = {
      archiveId: "neuve",
      date: "2026-02-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d", "e"],
      donnes: [{ ...donneBase, preneur: 1, appele: 0, points: 60 }], // a appelé, +68
    };

    // Reçues récente d'abord, ancienne ensuite.
    const stats = calculerStatsJoueur("a", [recente, ancienne]);

    // `parties` garde l'ordre reçu en entrée (récente d'abord)...
    expect(stats.parties.map((p) => p.archiveId)).toEqual(["neuve", "vieille"]);
    // ...mais la trajectoire reste chronologique (ancienne d'abord).
    expect(stats.trajectoire).toEqual([
      { index: 1, cumul: 136 },
      { index: 2, cumul: 204 },
    ]);
  });

  it("ignore une partie où le joueur n'apparaît pas", () => {
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["x", "y", "z", "w"],
      donnes: [{ ...donneBase, table: [0, 1, 2, 3], preneur: 0, appele: null, points: 60 }],
    };

    const stats = calculerStatsJoueur("absent", [partie]);

    expect(stats.partiesJouees).toBe(0);
    expect(stats.donneesJouees).toBe(0);
    expect(stats.parties).toEqual([]);
  });

  it("ne compte pas les donnes de repos pour un joueur au repos pendant une rotation", () => {
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d", "e"],
      donnes: [{ ...donneBase, table: [0, 1, 2, 3], appele: null, points: 60 }], // e (index 4) au repos
    };

    const stats = calculerStatsJoueur("e", [partie]);

    expect(stats.partiesJouees).toBe(0);
    expect(stats.donneesJouees).toBe(0);
  });
});
