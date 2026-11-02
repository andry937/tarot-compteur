import { describe, it, expect } from "vitest";
import type { Donne } from "@/domain/score/regles";
import type { PartieAnalysee } from "@/domain/stats/stats";
import type { Fiche } from "@/domain/joueurs/identite";
import { attribuerBadges } from "@/domain/stats/badges";

const base: Donne = {
  table: [0, 1, 2, 3, 4],
  preneur: 0,
  appele: 1,
  contrat: "garde",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
  points: 60,
};
const ids = ["a", "b", "c", "d", "e"];
const roster: Fiche[] = ids.map((id) => ({ id, nom: id, creee: "", actif: true, redirigeVers: null }));

/** n donnes où `preneur` prend `contrat` seul-ou-appelant l'`appele`, avec `points` pour l'attaque. */
const donnes = (n: number, o: Partial<Donne>): Donne[] => Array.from({ length: n }, () => ({ ...base, ...o }));
const partie = (i: number, d: Donne[]): PartieAnalysee => ({
  archiveId: `p${i}`,
  date: `2026-01-0${i + 1}T00:00:00.000Z`,
  joueursId: ids,
  donnes: d,
});

describe("attribuerBadges", () => {
  it("met tout le monde en Recrue sans historique", () => {
    const r = attribuerBadges(ids, [], roster);
    expect(r).toHaveLength(5);
    expect(r.every((b) => b.badge === "recrue")).toBe(true);
  });

  it("donne Kamikaze au joueur qui prend le plus de Garde contre, sans Recrue", () => {
    // a : 10 Garde contre ; b : 10 Garde — chacun appelle c.
    const parties = [
      partie(1, [
        ...donnes(10, { preneur: 0, appele: 2, contrat: "garde_contre", points: 40 }),
        ...donnes(10, { preneur: 1, appele: 2, contrat: "garde", points: 60 }),
      ]),
    ];
    const r = attribuerBadges(ids, parties, roster);
    expect(r.find((b) => b.badge === "kamikaze")?.joueurId).toBe("a");
    expect(r.filter((b) => b.badge === "recrue")).toHaveLength(0);
  });

  it("n'attribue pas un badge sans écart net (deux joueurs à égalité)", () => {
    const parties = [
      partie(1, [
        ...donnes(10, { preneur: 0, appele: 2, contrat: "garde_contre", points: 40 }),
        ...donnes(10, { preneur: 1, appele: 2, contrat: "garde_contre", points: 40 }),
      ]),
    ];
    expect(attribuerBadges(ids, parties, roster).some((b) => b.badge === "kamikaze")).toBe(false);
  });

  it("compte les donnes jouées sous une identité fusionnée", () => {
    const fusion: Fiche[] = [
      ...roster,
      { id: "z", nom: "z", creee: "", actif: false, redirigeVers: "a" },
    ];
    const p: PartieAnalysee = {
      archiveId: "p1",
      date: "2026-01-01T00:00:00.000Z",
      joueursId: ["z", "b", "c", "d", "e"],
      donnes: donnes(20, { points: 60 }),
    };
    const r = attribuerBadges(["a", "b", "c", "d", "e"], [p], fusion);
    expect(r.find((b) => b.joueurId === "a")?.badge).not.toBe("recrue");
  });
});

describe("Meilleur Ami", () => {
  it("va au joueur dont les contrats réussissent le plus souvent quand il est appelé", () => {
    // b est appelé 10 fois et le contrat réussit à chaque fois ; c est appelé 10 fois et il chute à chaque fois.
    const parties = [
      partie(1, [
        ...donnes(10, { preneur: 0, appele: 1, contrat: "garde", points: 60 }),
        ...donnes(10, { preneur: 0, appele: 2, contrat: "garde", points: 30 }),
      ]),
    ];
    const r = attribuerBadges(ids, parties, roster);
    expect(r.find((b) => b.badge === "meilleur_ami")?.joueurId).toBe("b");
    expect(r.find((b) => b.badge === "pigeon")?.joueurId).toBe("c");
  });
});

describe("Meilleur Défenseur", () => {
  it("n'attribue rien quand les défenseurs ont le même bilan", () => {
    const donnesJouees = [...donnes(10, { points: 30 }), ...donnes(10, { points: 70 })];
    const r = attribuerBadges(ids, [partie(1, donnesJouees)], roster);
    expect(r.find((b) => b.badge === "mur")).toBeUndefined();
  });

  it("attribue le badge quand un défenseur se détache", () => {
    // Table de 5 avec rotation : f (siège 5) ne défend que quand l'attaque chute.
    const idsSix = ["a", "b", "c", "d", "e", "f"];
    const rosterSix: Fiche[] = idsSix.map((id) => ({ id, nom: id, creee: "", actif: true, redirigeVers: null }));
    const avecF = donnes(20, { preneur: 0, appele: 1, points: 30, table: [0, 1, 2, 3, 5] }); // f défend, contrat chute
    const sansF = donnes(20, { preneur: 0, appele: 1, points: 70, table: [0, 1, 2, 3, 4] }); // e défend, contrat réussit
    const p: PartieAnalysee = { archiveId: "p1", date: "2026-01-01T00:00:00.000Z", joueursId: idsSix, donnes: [...avecF, ...sansF] };
    const r = attribuerBadges(idsSix, [p], rosterSix);
    expect(r.find((b) => b.badge === "mur")?.joueurId).toBe("f");
  });
});

describe("Meilleur Attaquant", () => {
  it("va au joueur dont le camp attaquant réussit le plus souvent, preneur ou appelé", () => {
    // a prend 24 fois et réussit toujours (appelé tournant entre b, c, d) ; e prend 20 fois et chute une fois sur deux.
    const parties = [
      partie(1, [
        ...donnes(8, { preneur: 0, appele: 1, points: 70 }),
        ...donnes(8, { preneur: 0, appele: 2, points: 70 }),
        ...donnes(8, { preneur: 0, appele: 3, points: 70 }),
        ...donnes(10, { preneur: 4, appele: 1, points: 70 }),
        ...donnes(10, { preneur: 4, appele: 1, points: 30 }),
      ]),
    ];
    const r = attribuerBadges(ids, parties, roster);
    expect(r.filter((b) => b.badge === "attaquant")).toHaveLength(1);
    expect(r.find((b) => b.badge === "attaquant")?.joueurId).toBe("a");
  });
});

describe("Seuils sur des données réalistes", () => {
  it("décerne Meilleur Défenseur même si personne ne fait chuter l'attaque plus d'une fois sur deux", () => {
    const idsSix = ["a", "b", "c", "d", "e", "f"];
    const rosterSix: Fiche[] = idsSix.map((id) => ({ id, nom: id, creee: "", actif: true, redirigeVers: null }));
    // L'attaque réussit en général : f défend et fait chuter 18 fois sur 40 (45 %), e 10 fois sur 40 (25 %), c et d 28 sur 80 (35 %).
    const avecF = [...donnes(18, { points: 30, table: [0, 1, 2, 3, 5] }), ...donnes(22, { points: 70, table: [0, 1, 2, 3, 5] })];
    const avecE = [...donnes(10, { points: 30, table: [0, 1, 2, 3, 4] }), ...donnes(30, { points: 70, table: [0, 1, 2, 3, 4] })];
    const p: PartieAnalysee = { archiveId: "p1", date: "2026-01-01T00:00:00.000Z", joueursId: idsSix, donnes: [...avecF, ...avecE] };
    expect(attribuerBadges(idsSix, [p], rosterSix).find((b) => b.badge === "mur")?.joueurId).toBe("f");
  });
});
