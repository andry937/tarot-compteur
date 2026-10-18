/**
 * Statistiques sur les donnes d'une seule partie (en cours ou archivée).
 * Distinct de `stats.ts` (cumulé par joueur sur tout l'historique, avec
 * résolution de fusion) : ici on travaille sur une seule liste de `donnes`
 * et les noms de sièges de cette partie, sans identité ni historique.
 * Aucune dépendance React : pur, testable isolément.
 * @module
 */
import { calculer } from "@/domain/score/regles";
import type { Donne, Roi } from "@/domain/score/regles";

/** Nombre de fois qu'un roi a été appelé. */
export interface FrequenceRoi {
  /** Couleur du roi appelé. */
  roi: Roi;
  /** Nombre d'appels. */
  fois: number;
}

/** Nombre de fois qu'un joueur a été appelé. */
export interface FrequenceJoueur {
  /** Nom du joueur appelé. */
  joueur: string;
  /** Nombre de fois où il a été appelé. */
  fois: number;
}

/** Statistiques d'une partie, calculées à la volée par `calculerStatsPartie`. */
export interface StatsPartie {
  /** Nombre de donnes inscrites. */
  nbDonnes: number;
  /** Donnes où l'attaque a réussi son contrat. */
  reussies: number;
  /** Donnes où l'attaque a chuté. */
  chutees: number;
  /** Donnes à 5 joueurs où le preneur a appelé un autre joueur. */
  avecAppele: number;
  /** Donnes à 5 joueurs où le preneur s'est appelé lui-même (il joue seul). */
  preneurSeul: number;
  /** Rois appelés, du plus fréquent au moins fréquent. */
  roisAppeles: FrequenceRoi[];
  /** Joueurs appelés, du plus fréquent au moins fréquent. */
  joueursAppeles: FrequenceJoueur[];
}

/**
 * Calcule les statistiques d'une partie à partir de ses donnes.
 * @param donnes - Donnes inscrites, dans l'ordre de jeu.
 * @param joueurs - Noms des sièges de cette partie.
 * @param nbTotal - Nombre de joueurs de la partie, au repos compris.
 */
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
