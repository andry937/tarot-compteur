import { describe, it, expect } from "vitest";
import {
  DONNES_MIN_PERIODE,
  championsParPeriode,
  classementPeriode,
  clePeriode,
  libellePeriode,
  partiesDeLaPeriode,
  periodesDisponibles,
} from "@/domain/stats/periodes";
import type { Donne } from "@/domain/score/regles";
import type { PartieAnalysee } from "@/domain/stats/stats";
import type { Fiche } from "@/domain/joueurs/identite";

const ids = ["a", "b", "c", "d"];
const roster: Fiche[] = ids.map((id) => ({ id, nom: id.toUpperCase(), creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null }));
const donne = (preneur: number, points: number): Donne => ({
  table: [0, 1, 2, 3],
  preneur,
  appele: null,
  contrat: "garde",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
  points,
});
/** `n` donnes où le joueur `preneur` réussit (points 70 avec 1 bout) ou chute (points 20). */
const partie = (date: string, archiveId: string, preneur: number, reussit: boolean, n = DONNES_MIN_PERIODE.mois): PartieAnalysee => ({
  archiveId,
  date,
  joueursId: ids,
  donnes: Array.from({ length: n }, () => donne(preneur, reussit ? 70 : 20)),
});

// Dates à midi, au milieu du mois : insensibles au fuseau horaire.
const parties = [
  partie("2025-12-15T12:00:00.000Z", "dec", 3, true),
  partie("2026-01-15T12:00:00.000Z", "jan", 0, true),
  partie("2026-02-15T12:00:00.000Z", "fev", 1, true),
  partie("2026-02-16T12:00:00.000Z", "fev2", 1, true, 3),
];

describe("périodes", () => {
  it("donne la clé du mois et de l'année d'une date", () => {
    expect(clePeriode("2026-02-15T12:00:00.000Z", "mois")).toBe("2026-02");
    expect(clePeriode("2026-02-15T12:00:00.000Z", "annee")).toBe("2026");
  });

  it("met en forme le libellé", () => {
    expect(libellePeriode("2026-02", "mois")).toBe("février 2026");
    expect(libellePeriode("2026", "annee")).toBe("2026");
  });

  it("ne garde que les parties de la période", () => {
    expect(partiesDeLaPeriode(parties, "mois", "2026-02").map((p) => p.archiveId)).toEqual(["fev", "fev2"]);
    expect(partiesDeLaPeriode(parties, "annee", "2026")).toHaveLength(3);
  });

  it("liste les périodes de la plus récente à la plus ancienne, avec la période courante", () => {
    const maintenant = new Date("2026-04-10T12:00:00.000Z");
    expect(periodesDisponibles(parties, "mois", maintenant)).toEqual(["2026-04", "2026-02", "2026-01", "2025-12"]);
    expect(periodesDisponibles(parties, "annee", maintenant)).toEqual(["2026", "2025"]);
  });

  it("classe une saison sur ses seules parties, au seuil de la période", () => {
    const fev = classementPeriode(parties, roster, "mois", "2026-02");
    expect(fev[0].id).toBe("b");
    expect(fev.every((c) => c.matchs >= DONNES_MIN_PERIODE.mois)).toBe(true);
    // Chaque joueur a 13 donnes en février (10 + 3) : tous passent le seuil de 10.
    expect(fev).toHaveLength(4);
    // Janvier ne sait rien de février : son meneur est a.
    expect(classementPeriode(parties, roster, "mois", "2026-01")[0].id).toBe("a");
  });

  it("écarte les joueurs sous le seuil de la période", () => {
    const peu = [partie("2026-02-15T12:00:00.000Z", "x", 0, true, DONNES_MIN_PERIODE.mois - 1)];
    expect(classementPeriode(peu, roster, "mois", "2026-02")).toEqual([]);
  });

  it("exige plus de donnes pour une année que pour un mois", () => {
    // 23 donnes sur 2026 (10 + 10 + 3) : assez pour un mois, pas pour une année (30).
    expect(classementPeriode(parties, roster, "annee", "2026")).toEqual([]);
    const assez = [...parties, partie("2026-03-15T12:00:00.000Z", "mar", 2, true, 10)];
    expect(classementPeriode(assez, roster, "annee", "2026").length).toBeGreaterThan(0);
  });

  it("désigne le champion de chaque période, la plus récente d'abord", () => {
    const champions = championsParPeriode(parties, roster, "mois", new Date("2026-04-10T12:00:00.000Z"));
    expect(champions.map((c) => [c.cle, c.champion.id])).toEqual([
      ["2026-02", "b"],
      ["2026-01", "a"],
      ["2025-12", "d"],
    ]);
  });
});
