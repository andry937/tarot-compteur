import { describe, it, expect } from "vitest";
import { calculerClassementElo, ELO_DEPART, ELO_K } from "@/domain/stats/elo";
import type { Donne } from "@/domain/score/regles";
import type { PartieAnalysee } from "@/domain/stats/stats";
import type { Fiche } from "@/domain/joueurs/identite";

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

/** Réplique indépendamment la fonction logistique de src/utils/elo.ts pour
 * calculer un résultat attendu à partir du score brut d'une donne (mêmes
 * valeurs que `calculer().base` : garde = mult 2, seuil 51 pour 1 bout). */
const reelAttendu = (base: number) => 1 / (1 + Math.pow(10, -base / 400));
// points=60, bouts=1 (seuil 51) -> écart 9, réussi -> base = (25+9)*2 = 68
const REEL_60_GARDE = reelAttendu(68);

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

    // Elo de départ égal des deux côtés -> espérance 0.5 -> delta = K * (réel - 0.5)
    const delta = ELO_K * (REEL_60_GARDE - 0.5);
    expect(parId.a.elo).toBe(Math.round(ELO_DEPART + delta));
    expect(parId.b.elo).toBe(Math.round(ELO_DEPART - delta));
    expect(parId.c.elo).toBe(Math.round(ELO_DEPART - delta));
    expect(parId.d.elo).toBe(Math.round(ELO_DEPART - delta));
    expect(parId.a.matchs).toBe(1);
    expect(parId.b.matchs).toBe(1);
  });

  it("le preneur gagne plus que l'appelé, du même camp attaque gagnant à 5 joueurs", () => {
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
    const delta = ELO_K * (REEL_60_GARDE - 0.5);
    // a (preneur, 2 parts) et b (appelé, 1 part) montent tous les deux, mais
    // pas du même montant : facteur 4/3 pour le preneur, 2/3 pour l'appelé
    // (moyenne des deux facteurs = 1, donc moyenne des deltas = delta du camp).
    expect(parId.a.elo).toBe(Math.round(ELO_DEPART + delta * (4 / 3)));
    expect(parId.b.elo).toBe(Math.round(ELO_DEPART + delta * (2 / 3)));
    expect(parId.a.elo).toBeGreaterThan(parId.b.elo);
    expect(parId.c.elo).toBe(Math.round(ELO_DEPART - delta));
  });

  it("un contrat risqué réussi largement pèse plus qu'une victoire ric-rac", () => {
    const roster = ["a", "b", "c", "d"].map((id) => fiche(id, id.toUpperCase()));
    const ricRac: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d"],
      donnes: [{ ...donneBase, contrat: "petite", preneur: 0, points: 51 }], // seuil 51, écart 0
    };
    const risque: PartieAnalysee = {
      archiveId: "p2",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["a", "b", "c", "d"],
      donnes: [{ ...donneBase, contrat: "garde_contre", preneur: 0, points: 91 }], // mult 6, gros écart
    };

    const deltaRicRac = calculerClassementElo([ricRac], roster).find((c) => c.id === "a")!.elo - ELO_DEPART;
    const deltaRisque = calculerClassementElo([risque], roster).find((c) => c.id === "a")!.elo - ELO_DEPART;

    expect(deltaRicRac).toBeGreaterThan(0);
    expect(deltaRisque).toBeGreaterThan(deltaRicRac);
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

    // 1ère donne (ancienne) : ratings égaux -> delta = K*(réel-0.5)
    const delta1 = ELO_K * (REEL_60_GARDE - 0.5);
    const eloApres1 = ELO_DEPART + delta1;
    // 2e donne (récente) : a est désormais mieux noté que ses adversaires,
    // son espérance de gain augmente donc le delta de la 2e victoire diminue.
    const espere2 = 1 / (1 + Math.pow(10, ((ELO_DEPART - delta1) - eloApres1) / 400));
    const delta2 = ELO_K * (REEL_60_GARDE - espere2);
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
    expect(cible!.elo).toBe(Math.round(ELO_DEPART + ELO_K * (REEL_60_GARDE - 0.5)));
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
