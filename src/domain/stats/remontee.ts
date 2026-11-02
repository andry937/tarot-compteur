/**
 * « Pour remonter » : à 5 donnes par joueur, un joueur qui en a joué 4 n'a plus qu'une donne pour
 * rattraper son retard. On calcule l'écart avec le joueur juste devant et avec le leader, et, si
 * c'est possible, le contrat le plus raisonnable à annoncer à sa prochaine donne pour passer devant.
 * Calculé à la volée via `resumerDonnees()` donc `calculer()` (aucun barème recopié). Aucune dépendance React.
 * @module
 */
import { CONTRATS, SEUILS, resumerDonnees } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";

/** Donnes que chaque joueur joue dans une partie. */
export const DONNES_PAR_JOUEUR = 5;

/** Bouts supposés pour la proposition (seuil de 41 points). */
const BOUTS_SUPPOSES = 2;

/** Marge au-dessus du seuil jusqu'à laquelle un contrat reste jugé raisonnable. */
const MARGE_RAISONNABLE = 15;

/** Contrat à annoncer et points à faire pour passer devant une cible. */
export interface Proposition {
  /** Identifiant du contrat (voir `CONTRATS`). */
  contratId: string;
  /** Nom du contrat. */
  contrat: string;
  /** Points à réaliser par l'attaque, sur 91 (avec les bouts supposés). */
  points: number;
  /** Bouts supposés pour ce nombre de points. */
  bouts: number;
  /** `true` si ce nombre de points dépasse nettement le seuil (contrat risqué). */
  difficile: boolean;
}

/** Retard sur un joueur, et façon de le combler. */
export interface Rattrapage {
  /** Nom du joueur à rattraper. */
  cible: string;
  /** Points d'écart. */
  ecart: number;
  /** Façon de passer devant à la prochaine donne ; `null` si c'est hors de portée ou impossible. */
  proposition: Proposition | null;
}

/** Conseil pour un joueur qui n'a plus qu'une donne à jouer. */
export interface ConseilRemontee {
  /** Siège du joueur. */
  siege: number;
  /** Nom du joueur. */
  nom: string;
  /** Rang actuel (1 = leader). */
  rang: number;
  /** `false` si le joueur est au repos à la prochaine donne : rien à proposer pour l'instant. */
  joue: boolean;
  /** Retard sur le joueur juste devant. */
  devant: Rattrapage;
  /** Retard sur le leader ; `null` s'il est aussi le joueur juste devant. */
  leader: Rattrapage | null;
}

/**
 * Plus petit contrat raisonnable qui fait passer `siege` strictement devant `cible` en une donne,
 * en supposant que `cible` défend et que `siege` fait 2 bouts. À défaut de contrat raisonnable,
 * le contrat qui demande le moins de points ; `null` si même une Garde contre à 91 ne suffit pas.
 */
function chercherProposition(donnes: Donne[], nbTotal: number, table: number[], siege: number, cible: number): Proposition | null {
  const autre = table.find((i) => i !== siege && i !== cible);
  const passeDevant = (contrat: string, points: number): boolean => {
    const hypothese: Donne = {
      table,
      preneur: siege,
      appele: table.length === 5 && autre !== undefined ? autre : null,
      contrat,
      bouts: BOUTS_SUPPOSES,
      points,
      petitAuBout: "aucun",
      chelem: "aucun",
      miseres: [],
      roiAppele: "coeur",
    };
    const { totaux } = resumerDonnees([...donnes, hypothese], nbTotal);
    return totaux[siege] > totaux[cible];
  };

  const seuil = SEUILS[BOUTS_SUPPOSES];
  let moinsExigeant: Proposition | null = null;
  for (const c of [...CONTRATS].sort((a, b) => a.mult - b.mult)) {
    for (let points = seuil; points <= 91; points++) {
      if (!passeDevant(c.id, points)) continue;
      const difficile = points > seuil + MARGE_RAISONNABLE;
      const p: Proposition = { contratId: c.id, contrat: c.nom, points, bouts: BOUTS_SUPPOSES, difficile };
      if (!difficile) return p;
      if (!moinsExigeant || points < moinsExigeant.points) moinsExigeant = p;
      break;
    }
  }
  return moinsExigeant;
}

/**
 * Conseils pour les joueurs qui ont joué `DONNES_PAR_JOUEUR − 1` donnes et ne sont pas en tête.
 * `prochaineTable` : sièges à table à la prochaine donne ; `joueurs` : noms par siège.
 */
export function conseilsRemontee(donnes: Donne[], joueurs: string[], nbTotal: number, prochaineTable: number[]): ConseilRemontee[] {
  const { totaux, jouees } = resumerDonnees(donnes, nbTotal);
  const ordre = joueurs.map((_, i) => i).sort((a, b) => totaux[b] - totaux[a]);
  const conseils: ConseilRemontee[] = [];

  ordre.forEach((siege, idx) => {
    if (jouees[siege] !== DONNES_PAR_JOUEUR - 1) return;
    const devantSiege = [...ordre.slice(0, idx)].reverse().find((i) => totaux[i] > totaux[siege]);
    if (devantSiege === undefined) return; // en tête (ou à égalité avec la tête) : rien à rattraper
    const leaderSiege = ordre[0];
    const joue = prochaineTable.includes(siege);
    const rattrapage = (cible: number): Rattrapage => ({
      cible: joueurs[cible],
      ecart: totaux[cible] - totaux[siege],
      proposition: joue ? chercherProposition(donnes, nbTotal, prochaineTable, siege, cible) : null,
    });
    conseils.push({
      siege,
      nom: joueurs[siege],
      rang: idx + 1,
      joue,
      devant: rattrapage(devantSiege),
      leader: leaderSiege === devantSiege ? null : rattrapage(leaderSiege),
    });
  });
  return conseils;
}
