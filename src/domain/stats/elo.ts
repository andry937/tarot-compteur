/**
 * Classement général. Aucune dépendance React : testable isolément.
 *
 * Modèle retenu : notation bayésienne de Weng-Lin (Bradley-Terry, la méthode
 * de la librairie OpenSkill), à la place de l'Elo d'origine. Chaque joueur a
 * un niveau estimé `mu` et une incertitude `sigma` ; le classement se fait
 * sur la note prudente `mu − 3·sigma`. Un nouveau joueur (sigma élevé) part
 * donc de 0 et ne passe devant les habitués qu'en gagnant durablement — l'Elo
 * le plaçait d'emblée à 1500, au niveau d'un habitué moyen.
 *
 * Un match par donne archivée : attaque (preneur + appelé le cas échéant)
 * contre défense. Chaque camp est représenté par la **moyenne** de ses
 * joueurs, pas leur somme comme dans la librairie OpenSkill : avec la somme,
 * une défense à 3 ou 4 paraît toujours plus forte qu'une attaque à 1 ou 2,
 * alors qu'au tarot l'attaque gagne la majorité des donnes. Avec la moyenne,
 * chaque joueur reçoit le delta du camp divisé par la taille de son camp :
 * à incertitudes égales, ce que gagne l'attaque est exactement ce que perd la
 * défense (somme nulle). L'Elo d'origine faisait perdre le delta entier à
 * chaque défenseur, si bien que le total baissait à chaque donne et que les
 * habitués finissaient sous les nouveaux.
 *
 * Côté attaque, le preneur porte 2 parts et l'appelé 1 (même ratio que les
 * points réels de `calculer()`), normalisées pour que leur moyenne reste 1.
 *
 * Résultat continu plutôt que binaire : dérivé du score brut signé de la
 * donne (`calculer().base`, qui intègre multiplicateur, écart au seuil,
 * poignée, petit au bout et chelem) via une logistique. Une victoire ric-rac
 * vaut à peine plus que 0.5, un contrat risqué réussi largement se rapproche
 * de 1.
 *
 * Recalcul complet à chaque affichage, en rejouant toutes les donnes
 * archivées dans l'ordre chronologique : pas d'agrégat stocké, donc pas de
 * désynchronisation possible après une fusion de fiches joueurs.
 * @module
 */

import { calculer } from "@/domain/score/regles";
import type { PartieAnalysee } from "./stats";
import { resoudreFiche, resoudreNom } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";

/** Constantes par défaut d'OpenSkill. */
export const MU_DEPART = 25;
/** Incertitude de départ d'un joueur sans historique. */
export const SIGMA_DEPART = 25 / 3;
const BETA = 25 / 6;
/** Remontée de l'incertitude avant chaque donne (le niveau peut évoluer). */
const TAU = 25 / 300;
/** Plancher du facteur de réduction de sigma. */
const KAPPA = 1e-4;

/** Échelle de la logistique convertissant le score brut d'une donne en un
 * résultat dans ]0,1[ : une victoire typique (base ≈ 60) donne ≈ 0.75. */
const ECHELLE_RESULTAT = 125;

/** Ligne du classement général pour un joueur. */
export interface ClassementElo {
  /** Identifiant de la fiche (après résolution des fusions). */
  id: string;
  /** Nom affiché. */
  nom: string;
  /** Note affichée et triée : (mu − 3·sigma) × 10, arrondie. */
  note: number;
  /** Niveau estimé du joueur. */
  mu: number;
  /** Incertitude sur ce niveau : elle baisse à mesure que le joueur joue. */
  sigma: number;
  /** Nombre de donnes jouées. */
  matchs: number;
}

interface Niveau {
  mu: number;
  sigma: number;
}

/** Note prudente affichée : 0 pour un nouveau joueur. */
export function noteAffichee(mu: number, sigma: number): number {
  return Math.round((mu - 3 * sigma) * 10);
}

/** Écart de note entre deux niveaux affichés sur la fiche joueur. */
export const NOTE_PAR_NIVEAU = 3;
/** Niveau maximal affiché. */
export const NIVEAU_MAX = 100;

/** Niveau de 1 à 100 dérivé de la note, plus parlant qu'un nombre brut : 1 pour
 * un nouveau joueur (note 0 ou négative), un niveau de plus tous les 3 points. */
export function niveauDeNote(note: number): number {
  return Math.min(NIVEAU_MAX, Math.max(1, 1 + Math.floor(note / NOTE_PAR_NIVEAU)));
}

/** Résultat continu du camp attaque à partir du score brut signé de la donne. */
function resultatContinu(base: number): number {
  return 1 / (1 + Math.pow(10, -base / ECHELLE_RESULTAT));
}

/** Niveau d'un camp : moyenne des mu, variance de cette moyenne. */
function niveauCamp(joueurs: Niveau[]): { mu: number; sigma2: number; somme2: number } {
  const n = joueurs.length;
  const somme2 = joueurs.reduce((a, j) => a + j.sigma * j.sigma, 0);
  return {
    mu: joueurs.reduce((a, j) => a + j.mu, 0) / n,
    sigma2: somme2 / (n * n),
    somme2,
  };
}

/**
 * Calcule le classement de tous les joueurs à partir des parties archivées,
 * dans l'ordre chronologique. `roster` sert à résoudre les fusions : les
 * donnes jouées sous une identité fusionnée comptent pour la fiche cible.
 */
export function calculerClassementElo(parties: PartieAnalysee[], roster: Fiche[]): ClassementElo[] {
  const niveaux = new Map<string, Niveau>();
  const matchs = new Map<string, number>();

  const idFinal = (idBrut: string): string => resoudreFiche(idBrut, roster)?.id ?? idBrut;
  const niveauDe = (id: string): Niveau => niveaux.get(id) ?? { mu: MU_DEPART, sigma: SIGMA_DEPART };

  const partiesTriees = [...parties].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const partie of partiesTriees) {
    const idsResolus = partie.joueursId.map(idFinal);
    for (const donne of partie.donnes) {
      const res = calculer(donne, partie.joueursId.length);
      if (res.table.length === 0) continue;

      const attaque = [donne.preneur, ...(res.avecAppele ? [donne.appele as number] : [])].map(
        (i) => idsResolus[i]
      );
      const defense = res.defenseurs.map((i) => idsResolus[i]);
      if (attaque.length === 0 || defense.length === 0) continue;

      // L'incertitude remonte un peu avant chaque donne jouée.
      const avant = (ids: string[]): Niveau[] =>
        ids.map((id) => {
          const { mu, sigma } = niveauDe(id);
          return { mu, sigma: Math.sqrt(sigma * sigma + TAU * TAU) };
        });
      const niveauxAttaque = avant(attaque);
      const niveauxDefense = avant(defense);

      const campA = niveauCamp(niveauxAttaque);
      const campD = niveauCamp(niveauxDefense);
      const c = Math.sqrt(campA.sigma2 + campD.sigma2 + 2 * BETA * BETA);
      const espere = 1 / (1 + Math.exp((campD.mu - campA.mu) / c));
      const reel = resultatContinu(res.base);

      // Répartition 2 parts (preneur) / 1 part (appelé), moyenne des facteurs = 1.
      const poidsAttaque = res.avecAppele ? [2, 1] : [1];
      const sommePoids = poidsAttaque.reduce((a, b) => a + b, 0);

      const mettreAJour = (
        ids: string[],
        joueurs: Niveau[],
        camp: { sigma2: number; somme2: number },
        signe: 1 | -1,
        facteur: (idx: number) => number
      ) => {
        const n = ids.length;
        const delta = (Math.sqrt(camp.sigma2) / c) * (camp.sigma2 / (c * c)) * espere * (1 - espere);
        ids.forEach((id, idx) => {
          const { mu, sigma } = joueurs[idx];
          const s2 = sigma * sigma;
          niveaux.set(id, {
            mu: mu + (signe * facteur(idx) * s2 * (reel - espere)) / (n * c),
            sigma: Math.sqrt(s2 * Math.max(1 - (s2 / camp.somme2) * delta, KAPPA)),
          });
          matchs.set(id, (matchs.get(id) || 0) + 1);
        });
      };

      mettreAJour(attaque, niveauxAttaque, campA, 1, (idx) => (poidsAttaque[idx] * poidsAttaque.length) / sommePoids);
      mettreAJour(defense, niveauxDefense, campD, -1, () => 1);
    }
  }

  return [...niveaux.entries()]
    .map(([id, { mu, sigma }]) => ({
      id,
      nom: resoudreNom(id, roster, "?"),
      note: noteAffichee(mu, sigma),
      mu,
      sigma,
      matchs: matchs.get(id) || 0,
    }))
    .sort((a, b) => b.note - a.note || b.mu - a.mu);
}
