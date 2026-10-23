import type { Roi } from "@/domain/score/regles";
import { plisRestants } from "./machinePli";
import type { EtatSuivi } from "./machinePli";
import { construirePiles, pointsDe } from "./piles";

/** Ce que l'on sait avant la première carte : qui a pris, et quel roi a été appelé (à 5 joueurs). */
export interface Annonce {
  preneur: number;
  roiAppele: Roi | null;
}

/**
 * Appelé découvert au fil du jeu : le joueur qui pose le roi appelé. `undefined` tant que ce roi
 * n'a pas été posé ; `null` si aucun roi n'a été appelé ou si le preneur l'a posé lui-même (il joue
 * seul) ; sinon le siège de l'appelé.
 */
export function appeleDetecte(etat: EtatSuivi, annonce: Annonce): number | null | undefined {
  if (!annonce.roiAppele) return null;
  const carte = `${annonce.roiAppele}-14`;
  const pose = [...etat.plis.flatMap((p) => p.poses), ...etat.poseCourante].find((p) => p.carte === carte);
  if (!pose) return undefined;
  return pose.joueur === annonce.preneur ? null : pose.joueur;
}

export interface ScoresDirects {
  attaque: number;
  defense: number;
  plisRestants: number;
  /** Siège de l'appelé, `null` s'il n'y en a pas (ou si le preneur joue seul), `undefined` s'il n'est pas encore découvert. */
  appele: number | null | undefined;
}

/**
 * Points déjà engrangés par chaque camp d'après les piles des plis terminés. Tant que l'appelé n'est
 * pas découvert, seul le preneur est compté dans l'attaque. L'écart du preneur n'est connu qu'en fin de
 * manche (cartes jamais jouées) : l'appli l'ajoute à l'inscription de la donne, pas ici.
 */
export function scoresDirects(etat: EtatSuivi, annonce: Annonce): ScoresDirects {
  const appele = appeleDetecte(etat, annonce);
  const attaque = new Set<number>([annonce.preneur]);
  if (typeof appele === "number") attaque.add(appele);
  let pa = 0;
  let pd = 0;
  for (const [joueur, cartes] of Object.entries(construirePiles(etat.plis))) {
    if (attaque.has(Number(joueur))) pa += pointsDe(cartes);
    else pd += pointsDe(cartes);
  }
  return { attaque: pa, defense: pd, plisRestants: plisRestants(etat), appele };
}
