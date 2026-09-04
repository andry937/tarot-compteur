import { describe, it, expect } from "vitest";
import { calculerClassementElo, ELO_DEPART, ELO_K } from "../src/utils/elo";
import type { Donne } from "../src/utils/regles";
import type { PartieAnalysee } from "../src/utils/stats";
import type { Fiche } from "../src/utils/identite";

const fiche = (id: string, nom: string, patch: Partial<Fiche> = {}): Fiche => ({
  id,
  nom,
  creee: "2026-01-01T00:00:00.000Z",
  actif: true,
  redirigeVers: null,
  ...patch,
});

const donneBase: Omit<Donne, "points"> = {
  table: [0, 1, 2, 3],
  preneur: 0,
  appele: null,
  contrat: "garde",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
};

describe("calculerClassementElo", () => {
  it("applique le même delta (non divisé) à chaque défenseur quand le preneur gagne à 4", () => {
    const roster = ["a", "b", "c", "d"].map((id) => fiche(id, id.toUpperCase()));
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d"],
      donnes: [{ ...donneBase, preneur: 0, points: 60 }], // seuil 51, réussi
    };

    const classement = calculerClassementElo([partie], roster);
    const parId = Object.fromEntries(classement.map((c) => [c.id, c]));

    // Elo de départ égal des deux côtés -> espérance 0.5 -> delta = K * 0.5
    const delta = ELO_K * 0.5;
    expect(parId.a.elo).toBe(Math.round(ELO_DEPART + delta));
    expect(parId.b.elo).toBe(Math.round(ELO_DEPART - delta));
    expect(parId.c.elo).toBe(Math.round(ELO_DEPART - delta));
    expect(parId.d.elo).toBe(Math.round(ELO_DEPART - delta));
    expect(parId.a.matchs).toBe(1);
    expect(parId.b.matchs).toBe(1);
  });

  it("prend en compte l'appelé du côté attaque à 5 joueurs", () => {
    const roster = ["a", "b", "c", "d", "e"].map((id) => fiche(id, id.toUpperCase()));
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d", "e"],
      donnes: [
        { ...donneBase, table: [0, 1, 2, 3, 4], preneur: 0, appele: 1, points: 60 }, // réussi
      ],
    };

    const classement = calculerClassementElo([partie], roster);
    const parId = Object.fromEntries(classement.map((c) => [c.id, c]));
    const delta = ELO_K * 0.5;
    // a (preneur) et b (appelé) montent tous les deux du même delta, camp attaque gagnant
    expect(parId.a.elo).toBe(Math.round(ELO_DEPART + delta));
    expect(parId.b.elo).toBe(Math.round(ELO_DEPART + delta));
    expect(parId.c.elo).toBe(Math.round(ELO_DEPART - delta));
  });

  it("chute du preneur : l'attaque perd, la défense gagne", () => {
    const roster = ["a", "b", "c", "d"].map((id) => fiche(id, id.toUpperCase()));
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d"],
      donnes: [{ ...donneBase, preneur: 0, points: 30 }], // seuil 51, chute
    };

    const classement = calculerClassementElo([partie], roster);
    const parId = Object.fromEntries(classement.map((c) => [c.id, c]));
    expect(parId.a.elo).toBeLessThan(ELO_DEPART);
    expect(parId.b.elo).toBeGreaterThan(ELO_DEPART);
  });

  it("les ratings se cumulent dans l'ordre chronologique entre deux parties", () => {
    const roster = ["a", "b", "c", "d"].map((id) => fiche(id, id.toUpperCase()));
    // Partie la plus récente en premier dans le tableau, mais doit être
    // traitée en second (tri par date croissante).
    const partieRecente: PartieAnalysee = {
      archiveId: "p2",
      date: "2026-02-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d"],
      donnes: [{ ...donneBase, preneur: 0, points: 60 }],
    };
    const partieAncienne: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d"],
      donnes: [{ ...donneBase, preneur: 0, points: 60 }],
    };

    const classement = calculerClassementElo([partieRecente, partieAncienne], roster);
    const parId = Object.fromEntries(classement.map((c) => [c.id, c]));

    // 1ère donne (ancienne) : ratings égaux -> delta = K*0.5
    const eloApres1 = ELO_DEPART + ELO_K * 0.5;
    // 2e donne (récente) : a est désormais mieux noté que ses adversaires,
    // son espérance de gain augmente donc le delta de la 2e victoire diminue.
    const espere2 = 1 / (1 + Math.pow(10, ((ELO_DEPART - ELO_K * 0.5) - eloApres1) / 400));
    const delta2 = ELO_K * (1 - espere2);
    expect(parId.a.elo).toBe(Math.round(eloApres1 + delta2));
    expect(parId.a.matchs).toBe(2);
  });

  it("un joueur absent d'une donne (au repos) n'est pas affecté par celle-ci", () => {
    const roster = ["a", "b", "c", "d", "e"].map((id) => fiche(id, id.toUpperCase()));
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d", "e"],
      donnes: [{ ...donneBase, table: [0, 1, 2, 3], preneur: 0, points: 60 }], // e (index 4) au repos
    };

    const classement = calculerClassementElo([partie], roster);
    expect(classement.find((c) => c.id === "e")).toBeUndefined();
  });

  it("résout la fusion : les donnes jouées sous l'ancienne identité comptent pour la fiche cible", () => {
    const roster: Fiche[] = [
      fiche("a-old", "Ancien nom", { actif: false, redirigeVers: "a-new" }),
      fiche("a-new", "Nouveau nom"),
      fiche("b", "B"),
      fiche("c", "C"),
      fiche("d", "D"),
    ];
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a-old", "b", "c", "d"],
      donnes: [{ ...donneBase, preneur: 0, points: 60 }],
    };

    const classement = calculerClassementElo([partie], roster);
    expect(classement.find((c) => c.id === "a-old")).toBeUndefined();
    const cible = classement.find((c) => c.id === "a-new");
    expect(cible).toBeDefined();
    expect(cible!.nom).toBe("Nouveau nom");
    expect(cible!.elo).toBe(Math.round(ELO_DEPART + ELO_K * 0.5));
  });

  it("trie le classement par Elo décroissant", () => {
    const roster = ["a", "b", "c", "d"].map((id) => fiche(id, id.toUpperCase()));
    const partie: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d"],
      donnes: [{ ...donneBase, preneur: 0, points: 60 }],
    };
    const classement = calculerClassementElo([partie], roster);
    for (let i = 1; i < classement.length; i++) {
      expect(classement[i - 1].elo).toBeGreaterThanOrEqual(classement[i].elo);
    }
  });
});
