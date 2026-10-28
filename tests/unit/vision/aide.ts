import { toutesLesCartes, deriverPlis } from "@/domain/cartes/cartes";
import { appliquer, etatInitial } from "@/vision/domain/machinePli";
import type { ConfigSuivi, EtatSuivi } from "@/vision/domain/machinePli";
import type { EvenementStab } from "@/vision/domain/stabilisation";
import type { ZoneId } from "@/vision/domain/types";

export const TABLE5 = [0, 1, 2, 3, 4];
export const CONFIG5: ConfigSuivi = { table: TABLE5, entameInitiale: 1 };

/** Une carte validée à l'instant `t` : par défaut sur la table (sa position ne dit pas qui l'a jouée), sinon au chien / à l'écart. */
export const valide = (carte: string, t: number, zone: ZoneId | null = "table"): EvenementStab => ({
  type: "validee", carte, zone, horodatage: t, valideeA: t + 4,
});
export const retire = (carte: string, t: number, zone: ZoneId | null = "table"): EvenementStab => ({
  type: "retiree", carte, zone, t,
});

export function appliquerTout(etat: EtatSuivi, evenements: EvenementStab[]): EtatSuivi {
  return evenements.reduce(appliquer, etat);
}

/** Pose un pli : les cartes arrivent dans l'ordre, une toutes les 500 ms à partir de `t0` (assez espacées pour que leur ordre ne soit pas jugé ambigu) ; le joueur se déduit de l'ordre. */
export function poserPli(etat: EtatSuivi, cartes: string[], t0: number): EtatSuivi {
  return appliquerTout(etat, cartes.map((c, i) => valide(c, t0 + i * 500)));
}

/** Ramasse le pli : toutes les cartes quittent la table. */
export function ramasser(etat: EtatSuivi, cartes: string[], t: number): EtatSuivi {
  return appliquerTout(etat, cartes.map((c, i) => retire(c, t + i)));
}

/** Une main complète à 5 joueurs : 75 cartes dans l'ordre du jeu, écart = 3 cartes sans importance. */
export const ECART5 = ["pique-2", "pique-3", "trefle-2"];
export const MAIN5 = toutesLesCartes().filter((c) => !ECART5.includes(c));

/** Joue une main complète en suivant `deriverPlis` (donc un ordre de jeu parfaitement cohérent). */
export function jouerMainComplete(config: ConfigSuivi = CONFIG5, cartes: string[] = MAIN5): EtatSuivi {
  const { plis } = deriverPlis(config.table, config.entameInitiale, cartes);
  let etat = etatInitial(config);
  let t = 0;
  for (const pli of plis) {
    etat = poserPli(etat, pli.cartes, t);
    etat = ramasser(etat, pli.cartes, t + 3000);
    t += 4000;
  }
  return etat;
}
