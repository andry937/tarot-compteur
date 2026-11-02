/**
 * Soirées : plusieurs parties jouées à moins de 24 h les unes des autres forment une seule soirée
 * (chaînage : tant que l'écart entre deux parties consécutives reste sous 24 h, c'est la même soirée).
 * Le classement d'une soirée additionne les points de toutes ses parties. Rien n'est stocké.
 * Aucune dépendance React.
 * @module
 */

import { resumerDonnees } from "@/domain/score/regles";
import { resoudreFiche, resoudreNom } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import type { PartieAnalysee } from "@/domain/stats/stats";

/** Écart maximal entre deux parties consécutives d'une même soirée : 24 h. */
export const ECART_SOIREE_MS = 24 * 60 * 60 * 1000;

/** Parties jouées d'affilée (à moins de 24 h les unes des autres). */
export interface Soiree {
  /** Date de la première partie (ISO) : identifiant de la soirée. */
  id: string;
  /** Date de la première partie. */
  debut: string;
  /** Date de la dernière partie. */
  fin: string;
  /** Parties de la soirée, de la plus ancienne à la plus récente. */
  parties: PartieAnalysee[];
}

/** Ligne du classement d'une soirée. */
export interface LigneSoiree {
  /** Identifiant de la fiche (fusions résolues). */
  id: string;
  /** Nom actuel du joueur. */
  nom: string;
  /** Total de points sur toute la soirée. */
  pts: number;
  /** Donnes jouées sur la soirée. */
  donnes: number;
  /** Parties auxquelles il a pris part. */
  parties: number;
}

/** Regroupe les parties en soirées, de la plus récente à la plus ancienne. */
export function grouperSoirees(parties: PartieAnalysee[]): Soiree[] {
  const triees = [...parties].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const soirees: Soiree[] = [];
  for (const p of triees) {
    const courante = soirees[soirees.length - 1];
    const dernier = courante?.parties[courante.parties.length - 1];
    if (courante && dernier && new Date(p.date).getTime() - new Date(dernier.date).getTime() < ECART_SOIREE_MS) {
      courante.parties.push(p);
      courante.fin = p.date;
    } else {
      soirees.push({ id: p.date, debut: p.date, fin: p.date, parties: [p] });
    }
  }
  return soirees.reverse();
}

/** La soirée qui contient la partie datée de `date`, ou `undefined`. */
export function soireeDeLaPartie(soirees: Soiree[], date: string): Soiree | undefined {
  return soirees.find((s) => s.parties.some((p) => p.date === date));
}

/**
 * Classement d'une soirée : points cumulés sur ses parties, les plus gros d'abord.
 * Les joueurs sans nom (« ∅ ») sont écartés ; ceux qui ont changé d'identité par fusion sont regroupés.
 */
export function classementSoiree(soiree: Soiree, roster: Fiche[]): LigneSoiree[] {
  const lignes = new Map<string, LigneSoiree>();
  for (const p of soiree.parties) {
    const { totaux, jouees } = resumerDonnees(p.donnes, p.joueursId.length);
    p.joueursId.forEach((brut, i) => {
      if (jouees[i] === 0) return; // au repos toute la partie
      const id = resoudreFiche(brut, roster)?.id ?? brut;
      const l = lignes.get(id) ?? { id, nom: resoudreNom(id, roster, "?"), pts: 0, donnes: 0, parties: 0 };
      l.pts += totaux[i];
      l.donnes += jouees[i];
      l.parties += 1;
      lignes.set(id, l);
    });
  }
  return [...lignes.values()]
    .filter((l) => l.nom.trim() !== "" && l.nom.trim() !== "∅")
    .sort((a, b) => b.pts - a.pts);
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Libellé d'une soirée : « samedi 1 novembre 2026 » (jour de sa première partie, heure locale). */
export function libelleSoiree(soiree: Soiree): string {
  const d = new Date(soiree.debut);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}
