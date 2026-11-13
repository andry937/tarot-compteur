/**
 * Durées d'une partie et de ses donnes, déduites d'horodatages : le début de la partie
 * (`Partie.debut`) et la fin de chaque donne (`Donne.finA`, posée à son inscription).
 * Pure, rien n'est stocké en plus ; les anciennes données sans horodatage donnent `null`.
 * @module
 */

import type { Donne } from "@/domain/score/regles";

/** Durée (ms) de chaque donne : de la fin de la précédente (ou du début de la partie) à sa propre fin. */
export function dureesDonnes(debut: number | undefined, donnes: Donne[]): (number | null)[] {
  let precedent = debut;
  return donnes.map((d) => {
    const fin = d.finA;
    if (fin === undefined) {
      precedent = undefined;
      return null;
    }
    const duree = precedent !== undefined && fin >= precedent ? fin - precedent : null;
    precedent = fin;
    return duree;
  });
}

/** Durée totale (ms) d'une partie terminée : du début à la fin de la dernière donne ; `null` si inconnue. */
export function dureePartie(debut: number | undefined, donnes: Donne[]): number | null {
  const fin = donnes.length ? donnes[donnes.length - 1].finA : undefined;
  if (debut === undefined || fin === undefined || fin < debut) return null;
  return fin - debut;
}

/** « 7 min 05 s » ou « 1 h 12 min » : lisible, sans secondes au-delà d'une heure. */
export function formaterDuree(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, "0")} s`;
  return `${sec} s`;
}
