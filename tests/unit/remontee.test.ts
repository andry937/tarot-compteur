import { describe, it, expect } from "vitest";
import { conseilsRemontee, DONNES_PAR_JOUEUR } from "@/domain/stats/remontee";
import { resumerDonnees } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";

const noms = ["A", "B", "C", "D", "E"];
const table = [0, 1, 2, 3, 4];
const donne = (preneur: number, appele: number, contrat: string, points: number): Donne => ({
  table,
  preneur,
  appele,
  contrat,
  bouts: 2,
  points,
  petitAuBout: "aucun",
  chelem: "aucun",
  miseres: [],
  roiAppele: "coeur",
});

/** 3 donnes de B (et C appelé) qui réussissent, puis une de A qui réussit : tout le monde a 4 donnes. */
const quatreDonnes = [donne(1, 2, "garde", 60), donne(1, 2, "garde", 60), donne(1, 2, "garde", 60), donne(0, 3, "petite", 45)];

describe("Pour remonter", () => {
  it("ne dit rien tant que personne n'a joué 4 donnes", () => {
    expect(conseilsRemontee(quatreDonnes.slice(0, 3), noms, 5, table)).toEqual([]);
  });

  it("ne conseille pas le leader, seulement ceux qui ont 4 donnes et sont derrière", () => {
    const conseils = conseilsRemontee(quatreDonnes, noms, 5, table);
    const totaux = resumerDonnees(quatreDonnes, 5).totaux;
    const leader = totaux.indexOf(Math.max(...totaux));
    expect(DONNES_PAR_JOUEUR).toBe(5);
    expect(conseils.map((c) => c.siege)).not.toContain(leader);
    expect(conseils).toHaveLength(4);
  });

  it("calcule l'écart avec le joueur juste devant et avec le leader", () => {
    const totaux = resumerDonnees(quatreDonnes, 5).totaux;
    const conseils = conseilsRemontee(quatreDonnes, noms, 5, table);
    const dernier = conseils[conseils.length - 1];
    const leader = totaux.indexOf(Math.max(...totaux));
    expect(dernier.leader?.ecart).toBe(totaux[leader] - totaux[dernier.siege]);
    expect(dernier.devant.ecart).toBeGreaterThan(0);
    expect(dernier.devant.ecart).toBeLessThanOrEqual(dernier.leader!.ecart);
  });

  /** Totaux après avoir joué la proposition de `c` (preneur = le joueur conseillé, appelé = un autre que la cible). */
  const apresProposition = (siege: number, cible: number, contratId: string, points: number) => {
    const appele = [0, 1, 2, 3, 4].find((i) => i !== siege && i !== cible)!;
    return resumerDonnees([...quatreDonnes, donne(siege, appele, contratId, points)], 5).totaux;
  };

  it("propose un contrat qui fait réellement passer devant, au minimum de points", () => {
    for (const c of conseilsRemontee(quatreDonnes, noms, 5, table)) {
      const p = c.devant.proposition!;
      expect(p).not.toBeNull();
      const cible = noms.indexOf(c.devant.cible);
      const apres = apresProposition(c.siege, cible, p.contratId, p.points);
      expect(apres[c.siege]).toBeGreaterThan(apres[cible]);
      if (p.points > 41) {
        const moins = apresProposition(c.siege, cible, p.contratId, p.points - 1);
        expect(moins[c.siege]).toBeLessThanOrEqual(moins[cible]);
      }
    }
  });

  it("choisit le contrat le plus modeste quand l'écart est faible", () => {
    // Après 4 donnes, C a une petite avance sur A et B : une Petite suffit à les dépasser.
    const proche = [donne(2, 3, "petite", 42), donne(0, 3, "garde", 41), donne(1, 3, "garde", 41), donne(4, 3, "petite", 41)];
    const conseils = conseilsRemontee(proche, noms, 5, table);
    expect(conseils.length).toBeGreaterThan(0);
    const plusProche = conseils.reduce((a, b) => (a.devant.ecart <= b.devant.ecart ? a : b));
    expect(plusProche.devant.proposition?.contrat).toBe("Petite");
  });

  it("déclare hors de portée un retard qu'une Garde contre ne comble pas", () => {
    const enorme = Array.from({ length: 4 }, () => donne(1, 2, "garde_contre", 91));
    const conseils = conseilsRemontee(enorme, noms, 5, table);
    const retard = conseils.find((c) => c.nom === "A")!;
    expect(retard.devant.proposition).toBeNull();
  });

  it("ne propose rien à un joueur au repos à la prochaine donne", () => {
    const conseils = conseilsRemontee(quatreDonnes, noms, 5, [1, 2, 3, 4]);
    const repos = conseils.find((c) => c.siege === 0);
    if (repos) {
      expect(repos.joue).toBe(false);
      expect(repos.devant.proposition).toBeNull();
    }
  });
});
