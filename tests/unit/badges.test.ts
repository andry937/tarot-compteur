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

  it("donne Kamikaze au joueur qui prend le plus de Garde contre, sans Recrue ni doublon", () => {
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
    expect(r.filter((b) => b.joueurId === "a").length).toBeLessThanOrEqual(2);
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
