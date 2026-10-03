import { describe, it, expect } from "vitest";
import {
  toutesLesCartes, valeurCarte, deduireAttaque, deduireMains, trierCartes, libelleCarte, libelleCourt, nbPlis, gagnantDuPli, deriverPlis, entameDeLaDonne, estBout,
} from "../src/utils/cartes";
import type { Donne } from "../src/utils/regles";

describe("cartes", () => {
  it("expose les 78 cartes, libellées lisiblement", () => {
    const toutes = toutesLesCartes();
    expect(toutes).toHaveLength(78);
    expect(new Set(toutes).size).toBe(78);
    expect(libelleCarte("excuse")).toBe("L'Excuse");
    expect(libelleCarte("atout-21")).toBe("XXI");
    expect(libelleCarte("coeur-14")).toBe("Roi de cœur");
    expect(libelleCarte("pique-11")).toBe("Valet de pique");
    expect(libelleCourt("carreau-1")).toBe("A♦");
    expect(libelleCourt("trefle-10")).toBe("10♣");
    expect(["atout-1", "atout-21", "excuse"].every(estBout)).toBe(true);
    expect(estBout("atout-20")).toBe(false);
  });

  it("calcule le nombre de plis selon les joueurs à table", () => {
    expect(nbPlis(5)).toBe(15);
    expect(nbPlis(4)).toBe(18);
    expect(nbPlis(3)).toBe(24);
  });

  it("désigne le gagnant d'un pli", () => {
    // Le plus fort atout bat les couleurs.
    expect(gagnantDuPli(["coeur-14", "atout-2", "coeur-1", "atout-9", "excuse"])).toBe(3);
    // Sans atout : la plus forte carte de la couleur d'entame, une autre couleur ne gagne pas.
    expect(gagnantDuPli(["pique-5", "coeur-14", "pique-12", "pique-2", "trefle-14"])).toBe(2);
    // L'Excuse ne gagne jamais, même en entame : la couleur d'entame est celle de la carte suivante.
    expect(gagnantDuPli(["excuse", "carreau-3", "carreau-9", "pique-14", "carreau-1"])).toBe(2);
  });

  it("déduit les plis : le gagnant entame le suivant", () => {
    const table = [0, 1, 2, 3, 4];
    // Siège 1 entame ; atout-12 (siège 3) gagne le pli 1 puis entame le pli 2.
    const cartes = ["atout-5", "coeur-14", "atout-12", "excuse", "atout-3", "pique-2", "pique-9"];
    const { plis, prochainJoueur, termine } = deriverPlis(table, 1, cartes);
    expect(plis).toHaveLength(2);
    expect(plis[0].joueurs).toEqual([1, 2, 3, 4, 0]);
    expect(plis[0].gagnant).toBe(3);
    expect(plis[1].joueurs).toEqual([3, 4]);
    expect(plis[1].gagnant).toBeNull();
    expect(prochainJoueur).toBe(0);
    expect(termine).toBe(false);
  });

  it("gère une table à 4 joueurs et la fin de main", () => {
    const table = [2, 3, 0, 1];
    const toutes = toutesLesCartes().filter((c) => c !== "excuse").slice(0, nbPlis(4) * 4);
    const { plis, prochainJoueur, termine } = deriverPlis(table, 3, toutes);
    expect(plis).toHaveLength(18);
    expect(plis[0].joueurs).toEqual([3, 0, 1, 2]);
    expect(termine).toBe(true);
    expect(prochainJoueur).toBeNull();
  });

  it("retrouve l'entame d'une donne inscrite depuis son donneur", () => {
    const d = { table: [3, 4, 0, 1, 2], donneur: 0 } as Donne;
    expect(entameDeLaDonne(d)).toBe(1);
    expect(entameDeLaDonne({ table: [3, 4, 0, 1, 2] } as Donne)).toBe(4);
  });

  it("valorise les cartes : le jeu complet vaut 91 points", () => {
    expect(toutesLesCartes().reduce((t, c) => t + valeurCarte(c), 0)).toBe(91);
    expect(valeurCarte("coeur-14")).toBe(4.5);
    expect(valeurCarte("pique-13")).toBe(3.5);
    expect(valeurCarte("trefle-12")).toBe(2.5);
    expect(valeurCarte("carreau-11")).toBe(1.5);
    expect(valeurCarte("atout-15")).toBe(0.5);
  });

  describe("deduireAttaque", () => {
    const table = [0, 1, 2, 3, 4];
    const ecart = ["pique-2", "pique-3", "trefle-2"]; // 3 × 0,5 pt, jamais joués
    const main = (fin: string[] = []) => [
      ...toutesLesCartes().filter((c) => !ecart.includes(c) && !fin.includes(c)),
      ...fin,
    ];
    const arg = (cartes: string[], preneur: number, appele: number | null = null, contrat = "garde") => ({
      table, entame: 1, cartes, preneur, appele, contrat,
    });

    it("renvoie null sans carte, et un minimum non complet si la main est inachevée", () => {
      expect(deduireAttaque(arg([], 0))).toBeNull();
      const d = deduireAttaque(arg(["atout-5", "coeur-14", "atout-12", "excuse", "atout-3"], 0))!;
      expect(d.complet).toBe(false);
    });

    it("une main complète répartit les 91 points, l'écart allant au preneur", () => {
      const cartes = main();
      const seul = deduireAttaque(arg(cartes, 0))!;
      const contre = deduireAttaque(arg(cartes, 1, 2))!; // camp {1,2}
      expect(seul.complet).toBe(true);
      const autres = deduireAttaque(arg(cartes, 3, 4))!;
      const trois = [seul.points, contre.points, autres.points];
      expect(trois.every((p) => p >= 1.5 && p <= 91)).toBe(true);
      // Trois camps disjoints : les 89,5 pts des plis + l'écart (1,5) compté une fois par camp = 91 + 2 × 1,5.
      expect(seul.points + contre.points + autres.points).toBe(91 + 2 * 1.5);
    });

    it("l'écart ne compte pas pour l'attaque en Garde contre, et l'appelé partage le camp", () => {
      const cartes = main();
      const garde = deduireAttaque(arg(cartes, 0))!;
      const contre = deduireAttaque(arg(cartes, 0, null, "garde_contre"))!;
      expect(garde.points - contre.points).toBe(1.5);
      expect(deduireAttaque(arg(cartes, 0, 0))!.points).toBe(garde.points); // appelé = preneur : seul
      expect(deduireAttaque(arg(cartes, 0, 1))!.points).toBeGreaterThanOrEqual(garde.points);
    });

    it("déduit le petit au bout (camp du gagnant du dernier pli) et les bouts de l'attaque", () => {
      const fin = ["atout-1", "pique-4", "pique-5", "pique-6", "pique-7"]; // Petit seul atout du dernier pli
      const cartes = main(fin);
      const { plis } = deriverPlis(table, 1, cartes);
      const dernier = plis[plis.length - 1];
      const gagnant = dernier.gagnant as number;
      const pour = deduireAttaque(arg(cartes, gagnant))!;
      const contre = deduireAttaque(arg(cartes, (gagnant + 1) % 5))!;
      expect(pour.petitAuBout).toBe("attaque");
      expect(pour.boutsPrecis).toContain("petit");
      expect(contre.petitAuBout).toBe("defense");
      expect(pour.bouts).toBe(pour.boutsPrecis.length);
    });

    it("reconnaît un chelem : l'attaque, seule, remporte tous les plis", () => {
      // Le preneur 1 entame, joue le seul atout fort de chaque pli : on fabrique 15 plis où il gagne.
      const atouts = Array.from({ length: 21 }, (_, i) => `atout-${21 - i}`);
      const basses = toutesLesCartes().filter((c) => !c.startsWith("atout-") && c !== "excuse" && !ecart.includes(c));
      const cartes: string[] = [];
      let h = 0;
      let a = 0;
      for (let k = 0; k < 15; k++) {
        // Le preneur (siège 1 au 1er pli, puis lui-même à chaque fois) joue en premier un atout haut.
        cartes.push(atouts[a++ % 21]);
        for (let j = 0; j < 4; j++) cartes.push(basses[h++ % basses.length]);
      }
      const d = deduireAttaque({ table, entame: 1, cartes, preneur: 1, appele: null, contrat: "garde" })!;
      expect(d.chelem).toBe(d.complet);
    });
  });
});

describe("deduireMains", () => {
  const table = [0, 1, 2, 3, 4];
  const ecart = ["pique-2", "pique-3", "trefle-2"]; // jamais joués
  const cartes = toutesLesCartes().filter((c) => !ecart.includes(c));
  const base = { table, entame: 1, cartes, preneur: 0, contrat: "garde" };

  it("trie une main : atouts décroissants, Excuse, puis ♥ ♦ ♣ ♠ du plus fort au plus faible", () => {
    expect(trierCartes(["pique-1", "coeur-3", "excuse", "atout-2", "atout-20", "coeur-14", "trefle-5"])).toEqual([
      "atout-20", "atout-2", "excuse", "coeur-14", "coeur-3", "trefle-5", "pique-1",
    ]);
  });

  it("renvoie null sans carte", () => {
    expect(deduireMains({ ...base, cartes: [] })).toBeNull();
  });

  it("main complète : 15 cartes par joueur, l'ensemble des mains + l'écart couvre les 78 cartes", () => {
    const r = deduireMains(base)!;
    expect(r.complete).toBe(true);
    expect(r.anomalies).toEqual([]);
    expect(r.mains.map((m) => m.joueur)).toEqual(table);
    expect(r.mains.every((m) => m.cartes.length === 15 && m.attendues === 15)).toBe(true);
    const toutes = [...r.mains.flatMap((m) => m.cartes), ...(r.ecart ?? [])];
    expect(new Set(toutes).size).toBe(78);
    expect(r.ecart).toEqual(trierCartes(ecart));
    expect(r.chienNonVu).toBeNull();
  });

  it("l'Excuse reste dans la main de celui qui l'a posée", () => {
    const r = deduireMains(base)!;
    const { plis } = deriverPlis(table, 1, cartes);
    const pli = plis.find((p) => p.cartes.includes("excuse"))!;
    const joueur = pli.joueurs[pli.cartes.indexOf("excuse")];
    expect(r.mains.find((m) => m.joueur === joueur)!.cartes).toContain("excuse");
    expect(r.mains.filter((m) => m.cartes.includes("excuse"))).toHaveLength(1);
  });

  it("reconstitue la main de départ du preneur : jouées + écart − chien", () => {
    const sa = deduireMains(base)!.mains.find((m) => m.joueur === 0)!.cartes;
    const chien = [ecart[0], sa[0], sa[1]];
    const r = deduireMains({ ...base, chien })!;
    expect(r.departPreneur).toHaveLength(15);
    expect(r.departPreneur).not.toContain(chien[0]);
    expect(r.departPreneur).not.toContain(sa[0]);
    expect(r.departPreneur).toContain(ecart[1]); // écart non repris du chien : il était dans la main de départ
    expect(deduireMains(base)!.departPreneur).toBeNull(); // chien non noté
  });

  it("Garde sans/contre : les cartes jamais jouées sont le chien non vu, pas un écart", () => {
    for (const contrat of ["garde_sans", "garde_contre"]) {
      const r = deduireMains({ ...base, contrat, chien: ecart })!;
      expect(r.ecart).toBeNull();
      expect(r.chienNonVu).toEqual(trierCartes(ecart));
      expect(r.departPreneur).toBeNull();
    }
  });

  it("main incomplète : cartes déjà jouées seulement, pas d'écart", () => {
    const r = deduireMains({ ...base, cartes: cartes.slice(0, 7) })!;
    expect(r.complete).toBe(false);
    expect(r.ecart).toBeNull();
    expect(r.mains.reduce((t, m) => t + m.cartes.length, 0)).toBe(7);
  });

  it("signale sans planter une carte en double ou un chien absent de la main du preneur", () => {
    const double = deduireMains({ ...base, cartes: ["atout-5", "atout-5", ...cartes.slice(2)] })!;
    expect(double.anomalies.some((a) => a.includes("plusieurs fois"))).toBe(true);
    const sa = deduireMains(base)!.mains.find((m) => m.joueur === 0)!.cartes;
    const autre = deduireMains(base)!.mains.find((m) => m.joueur === 1)!.cartes[0];
    expect(sa).not.toContain(autre);
    const absent = deduireMains({ ...base, chien: [autre] })!;
    expect(absent.anomalies.some((a) => a.includes("Chien absent"))).toBe(true);
    expect(absent.departPreneur).toBeNull();
  });
});
