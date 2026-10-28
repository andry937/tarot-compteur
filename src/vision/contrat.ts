/**
 * CONTRAT D'INTÉGRATION avec `tarot-compteur` — le seul point de contact entre le suivi
 * webcam et l'appli. Identifiants de cartes identiques à ceux de l'appli (`"atout-12"`,
 * `"excuse"`, `"coeur-14"`…). À l'intégration, on branche :
 *   cartesJouees → onModifierCartes   (brouillon `cartesEnCours`)
 *   chien        → onModifierChien    (brouillon `chienEnCours`)
 */
import { cartesJoueesDe, plisRestants } from "@/vision/domain/machinePli";
import type { Alerte, EtatSuivi, PliJoue } from "@/vision/domain/machinePli";

export interface SortieSuivi {
  /** Cartes jouées dans l'ordre de jeu (entame = suivant du donneur, puis gagnant du pli précédent). */
  cartesJouees: string[];
  chien: string[];
  /** Cartes de l'écart, si elles ont été scannées (sinon déduites des cartes jamais jouées par l'appli). */
  ecart: string[];
  /** Détail (ordre, entame, gagnant) ; `surcharge` indique les plis corrigés à la main, que `deriverPlis` ne retrouverait pas seul. */
  plis: PliJoue[];
  alertes: Alerte[];
  plisRestants: number;
  /** Tous les plis sont joués et la table est vide : la saisie de la donne peut s'ouvrir. */
  termine: boolean;
}

export function versSortie(etat: EtatSuivi): SortieSuivi {
  return {
    cartesJouees: cartesJoueesDe(etat),
    chien: etat.chien,
    ecart: etat.ecart,
    plis: etat.plis,
    alertes: etat.alertes,
    plisRestants: plisRestants(etat),
    termine: etat.phase === "termine",
  };
}
