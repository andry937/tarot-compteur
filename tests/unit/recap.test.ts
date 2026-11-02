import { describe, it, expect } from "vitest";
import type { Donne } from "@/domain/score/regles";
import { calculerRecap, texteRecap } from "@/domain/stats/recap";

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
const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];

describe("calculerRecap", () => {
  it("renvoie null sans donne", () => {
    expect(calculerRecap([], noms, 5)).toBeNull();
  });

  it("classe les joueurs et relève les faits marquants", () => {
    const donnes: Donne[] = [
      { ...base, preneur: 0, appele: 1, contrat: "garde", points: 60 }, // Andry réussit une Garde
      { ...base, preneur: 2, appele: 3, contrat: "garde_contre", points: 30 }, // Chloé chute une Garde contre
      { ...base, preneur: 2, appele: 3, contrat: "petite", points: 30 }, // Chloé chute encore
      { ...base, preneur: 4, appele: 0, contrat: "garde_sans", points: 70 }, // Eva réussit une Garde sans
    ];
    const r = calculerRecap(donnes, noms, 5)!;
    expect(r.nbDonnes).toBe(4);
    expect(r.reussies).toBe(2);
    expect(r.chutees).toBe(2);
    expect(r.classement).toHaveLength(5);
    expect(r.classement[0].pts).toBeGreaterThanOrEqual(r.classement[1].pts);
    expect(r.pireChute).toMatchObject({ nom: "Chloé", contrat: "Garde contre", numero: 2 });
    expect(r.plusBeauContrat).toMatchObject({ nom: "Eva", contrat: "Garde sans", numero: 4 });
    expect(r.casseur).toEqual({ nom: "Chloé", chutes: 2 });
    expect(r.plusGrosseDonne?.pts).toBeGreaterThan(0);
  });

  it("n'inclut pas un joueur resté au repos toute la partie", () => {
    const r = calculerRecap([{ ...base, table: [0, 1, 2, 3], appele: null }], noms, 5)!;
    expect(r.classement.map((l) => l.nom)).not.toContain("Eva");
  });

  it("ne désigne un casseur qu'à partir de deux chutes", () => {
    const r = calculerRecap([{ ...base, points: 30 }], noms, 5)!;
    expect(r.casseur).toBeNull();
  });
});

describe("texteRecap", () => {
  it("produit un texte partageable avec podium, faits et badges", () => {
    const r = calculerRecap([{ ...base, points: 60 }, { ...base, preneur: 2, appele: 3, points: 30 }], noms, 5)!;
    const t = texteRecap(r, { titre: "Récap de la soirée du 02/11", badges: [{ nom: "Andry", titre: "🏆 Le Patron" }] });
    expect(t).toContain("Récap de la soirée du 02/11 — 2 donnes");
    expect(t).toContain("🥇");
    expect(t).toContain("💀 Dernier :");
    expect(t).toContain("🪦 Pire chute : Chloé");
    expect(t).toContain("🏆 Le Patron : Andry");
  });
});
