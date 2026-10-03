import { describe, it, expect } from "vitest";
import {
  toutesLesCartes, libelleCarte, libelleCourt, nbPlis, gagnantDuPli, deriverPlis, entameDeLaDonne, estBout,
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
});
