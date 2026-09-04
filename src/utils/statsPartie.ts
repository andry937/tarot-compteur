/**
 * Statistiques sur les donnes d'une seule partie (en cours ou archivée).
 * Distinct de `stats.ts` (cumulé par joueur sur tout l'historique, avec
 * résolution de fusion) : ici on travaille sur une seule liste de `donnes`
 * et les noms de sièges de cette partie, sans identité ni historique.
 * Aucune dépendance React : pur, testable isolément.
 */
import { calculer } from "./regles";
import type { Donne, Roi } from "./regles";

export interface FrequenceRoi {
  roi: Roi;
  fois: number;
}

export interface FrequenceJoueur {
  joueur: string;
  fois: number;
}

export interface StatsPartie {
  nbDonnes: number;
  reussies: number;
  chutees: number;
  avecAppele: number;
  preneurSeul: number;
  roisAppeles: FrequenceRoi[];
  joueursAppeles: FrequenceJoueur[];
}

export function calculerStatsPartie(donnes: Donne[], joueurs: string[], nbTotal: number): StatsPartie {
  let reussies = 0;
  let avecAppele = 0;
  let preneurSeul = 0;
  const roisCompte = new Map<Roi, number>();
  const joueursCompte = new Map<string, number>();

  donnes.forEach((d) => {
    const res = calculer(d, nbTotal);
    if (res.reussi) reussies++;
    if (res.table.length === 5) {
      if (res.avecAppele) {
        avecAppele++;
        const nomAppele = joueurs[d.appele as number];
        joueursCompte.set(nomAppele, (joueursCompte.get(nomAppele) || 0) + 1);
      } else {
        preneurSeul++;
      }
    }
    if (d.roiAppele) {
      roisCompte.set(d.roiAppele, (roisCompte.get(d.roiAppele) || 0) + 1);
    }
  });

  return {
    nbDonnes: donnes.length,
    reussies,
    chutees: donnes.length - reussies,
    avecAppele,
    preneurSeul,
    roisAppeles: [...roisCompte.entries()]
      .map(([roi, fois]) => ({ roi, fois }))
      .sort((a, b) => b.fois - a.fois),
    joueursAppeles: [...joueursCompte.entries()]
      .map(([joueur, fois]) => ({ joueur, fois }))
      .sort((a, b) => b.fois - a.fois),
  };
}
