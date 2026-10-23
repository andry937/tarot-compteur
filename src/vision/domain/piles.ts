import { valeurCarte } from "@/domain/cartes/cartes";
import type { PliJoue } from "./machinePli";

/**
 * Pile de chaque joueur : un pli revient à son gagnant, sauf l'Excuse qui reste à celui
 * qui l'a jouée (l'échange d'une carte à 0,5 point n'est pas suivi).
 */
export function construirePiles(plis: PliJoue[]): Record<number, string[]> {
  const piles: Record<number, string[]> = {};
  const ajouter = (joueur: number, carte: string) => (piles[joueur] ??= []).push(carte);
  for (const pli of plis) {
    for (const pose of pli.poses) ajouter(pose.carte === "excuse" ? pose.joueur : pli.gagnant, pose.carte);
  }
  return piles;
}

export const pointsDe = (cartes: string[]): number => cartes.reduce((t, c) => t + valeurCarte(c), 0);

/** Points de l'attaque d'après les piles déjà constituées (hors écart, connu seulement en fin de manche). */
export function pointsAttaque(piles: Record<number, string[]>, preneur: number, appele: number | null): number {
  const attaque = new Set<number>([preneur]);
  if (appele !== null) attaque.add(appele);
  return [...attaque].reduce((t, j) => t + pointsDe(piles[j] ?? []), 0);
}
