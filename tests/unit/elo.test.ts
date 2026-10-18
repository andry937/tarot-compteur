import { describe, it, expect } from "vitest";
import { calculerClassementElo, MU_DEPART, SIGMA_DEPART, noteAffichee } from "@/domain/stats/elo";
import type { ClassementElo } from "@/domain/stats/elo";
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

const partie = (joueursId: string[], donnes: Donne[], date = "2026-01-01T00:00:00.000Z", archiveId = "p1"): PartieAnalysee => ({
  archiveId,
  date,
  joueursId,
  donnes,
});

const parIdDe = (classement: ClassementElo[]) => Object.fromEntries(classement.map((c) => [c.id, c]));
const ids = (n: number) => ["a", "b", "c", "d", "e"].slice(0, n);
const rosterDe = (n: number) => ids(n).map((id) => fiche(id, id.toUpperCase()));

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function aleatoire(graine: number): () => number {
  let s = graine;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("calculerClassementElo", () => {
  it("un nouveau joueur sans donne a une note de 0", () => {
    expect(noteAffichee(MU_DEPART, SIGMA_DEPART)).toBe(0);
  });

  it("réussite du preneur à 4 : il monte, chaque défenseur baisse du tiers, somme nulle", () => {
    const classement = calculerClassementElo(
      [partie(ids(4), [{ ...donneBase, preneur: 0, points: 60 }])],
      rosterDe(4)
    );
    const p = parIdDe(classement);
    const gain = p.a.mu - MU_DEPART;
    expect(gain).toBeGreaterThan(0);
    for (const id of ["b", "c", "d"]) expect(p[id].mu - MU_DEPART).toBeCloseTo(-gain / 3, 10);
    expect(p.a.matchs).toBe(1);
    expect(p.b.matchs).toBe(1);
  });

  it("à 5 avec appelé : le preneur gagne deux fois plus que l'appelé, somme nulle", () => {
    const classement = calculerClassementElo(
      [partie(ids(5), [{ ...donneBase, table: [0, 1, 2, 3, 4], preneur: 0, appele: 1, points: 60 }])],
      rosterDe(5)
    );
    const p = parIdDe(classement);
    const dA = p.a.mu - MU_DEPART;
    const dB = p.b.mu - MU_DEPART;
    expect(dB).toBeGreaterThan(0);
    expect(dA).toBeCloseTo(2 * dB, 10);
    const somme = ids(5).reduce((s, id) => s + p[id].mu - MU_DEPART, 0);
    expect(somme).toBeCloseTo(0, 10);
  });

  it.each([
    { n: 3, appele: null },
    { n: 4, appele: null },
    { n: 5, appele: null },
    { n: 5, appele: 2 },
  ])("somme nulle à $n joueurs (appelé : $appele), réussite comme chute", ({ n, appele }) => {
    for (const points of [70, 30]) {
      const table = [...Array(n).keys()];
      const classement = calculerClassementElo(
        [partie(ids(n), [{ ...donneBase, table, preneur: 0, appele, points }])],
        rosterDe(n)
      );
      const somme = classement.reduce((s, c) => s + c.mu - MU_DEPART, 0);
      expect(somme).toBeCloseTo(0, 10);
    }
  });

  it("un contrat risqué réussi largement pèse plus qu'une victoire ric-rac", () => {
    const gain = (d: Donne) =>
      calculerClassementElo([partie(ids(4), [d])], rosterDe(4)).find((c) => c.id === "a")!.mu - MU_DEPART;
    const ricRac = gain({ ...donneBase, contrat: "petite", points: 51 });
    const risque = gain({ ...donneBase, contrat: "garde_contre", points: 91 });
    expect(ricRac).toBeGreaterThan(0);
    expect(risque).toBeGreaterThan(ricRac);
  });

  it("chute du preneur : l'attaque perd, la défense gagne", () => {
    const p = parIdDe(calculerClassementElo([partie(ids(4), [{ ...donneBase, points: 30 }])], rosterDe(4)));
    expect(p.a.mu).toBeLessThan(MU_DEPART);
    expect(p.b.mu).toBeGreaterThan(MU_DEPART);
  });

  it("l'incertitude diminue à chaque donne jouée, sans jamais devenir négative", () => {
    const d: Donne = { ...donneBase, points: 60 };
    const un = parIdDe(calculerClassementElo([partie(ids(4), [d])], rosterDe(4)));
    const dix = parIdDe(calculerClassementElo([partie(ids(4), Array(10).fill(d))], rosterDe(4)));
    expect(un.b.sigma).toBeLessThan(SIGMA_DEPART);
    expect(dix.b.sigma).toBeLessThan(un.b.sigma);
    expect(dix.b.sigma).toBeGreaterThan(0);
  });

  it("les donnes se cumulent dans l'ordre chronologique entre deux parties", () => {
    const victoire: Donne = { ...donneBase, points: 60 };
    const chute: Donne = { ...donneBase, points: 30 };
    // La plus récente en premier dans le tableau : doit être traitée en second.
    const recente = partie(ids(4), [chute], "2026-02-01T00:00:00.000Z", "p2");
    const ancienne = partie(ids(4), [victoire], "2026-01-01T00:00:00.000Z", "p1");
    const trie = calculerClassementElo([recente, ancienne], rosterDe(4)).find((c) => c.id === "a")!;
    const attendu = calculerClassementElo([partie(ids(4), [victoire, chute])], rosterDe(4)).find((c) => c.id === "a")!;
    expect(trie.mu).toBeCloseTo(attendu.mu, 10);
    expect(trie.matchs).toBe(2);
  });

  it("un joueur absent d'une donne (au repos) n'est pas affecté par celle-ci", () => {
    const classement = calculerClassementElo(
      [partie(ids(5), [{ ...donneBase, table: [0, 1, 2, 3], points: 60 }])], // e au repos
      rosterDe(5)
    );
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
    const d: Donne = { ...donneBase, points: 60 };
    const classement = calculerClassementElo([partie(["a-old", "b", "c", "d"], [d])], roster);
    expect(classement.find((c) => c.id === "a-old")).toBeUndefined();
    const cible = classement.find((c) => c.id === "a-new")!;
    expect(cible.nom).toBe("Nouveau nom");
    const reference = calculerClassementElo([partie(ids(4), [d])], rosterDe(4)).find((c) => c.id === "a")!;
    expect(cible.note).toBe(reference.note);
  });

  it("trie le classement par note décroissante", () => {
    const classement = calculerClassementElo([partie(ids(4), [{ ...donneBase, points: 60 }])], rosterDe(4));
    for (let i = 1; i < classement.length; i++) {
      expect(classement[i - 1].note).toBeGreaterThanOrEqual(classement[i].note);
    }
  });

  describe("simulation d'une longue série de donnes", () => {
    // 5 habitués, 300 donnes : chacun prend à tour de rôle, appelle un voisin
    // au hasard ; « a » réussit 75 % de ses prises, les autres 60 %.
    const habitues = ids(5);
    const tirer = aleatoire(42);
    const donnes: Donne[] = [];
    for (let k = 0; k < 300; k++) {
      const preneur = k % 5;
      const appele = (preneur + 1 + Math.floor(tirer() * 4)) % 5;
      const reussite = tirer() < (preneur === 0 ? 0.75 : 0.6);
      const ecart = 1 + Math.floor(tirer() * 20);
      donnes.push({ ...donneBase, table: [0, 1, 2, 3, 4], preneur, appele, points: reussite ? 51 + ecart : 51 - ecart });
    }
    const serie = partie(habitues, donnes, "2026-01-01T00:00:00.000Z", "serie");
    // Puis un nouveau « n » remplace « e » et gagne ses 3 premières prises.
    const arrivee = partie(
      ["a", "b", "c", "d", "n"],
      [0, 1, 2].map(() => ({ ...donneBase, table: [0, 1, 2, 3, 4], preneur: 4, appele: 0, points: 70 })),
      "2026-02-01T00:00:00.000Z",
      "arrivee"
    );
    const roster = [...rosterDe(5), fiche("n", "N")];
    const classement = calculerClassementElo([serie, arrivee], roster);
    const p = parIdDe(classement);

    it("un nouveau qui gagne ses 3 premières donnes reste derrière les habitués", () => {
      for (const id of habitues) expect(p[id].note).toBeGreaterThan(p.n.note);
    });

    it("le joueur qui réussit le plus souvent finit premier", () => {
      expect(classement[0].id).toBe("a");
    });

    it("la moyenne des niveaux reste au niveau de départ (pas de dérive)", () => {
      const moyenne = classement.reduce((s, c) => s + c.mu, 0) / classement.length;
      expect(Math.abs(moyenne - MU_DEPART)).toBeLessThan(1);
    });
  });
});
