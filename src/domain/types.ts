/**
 * Types d'état partagés entre les écrans, les stores et le stockage : composition d'une table,
 * annulations (Petit sec), index de l'historique et enregistrement complet d'une table ou d'une archive.
 * @module
 */

import type { Donne } from "@/domain/score/regles";

/** Composition et paramètres d'une table (sans les donnes). */
export interface Partie {
  /** Identifiants stables des joueurs, dans l'ordre des sièges. */
  joueursId: string[];
  /** Noms saisis à la création, parallèles à `joueursId` — repli d'affichage si la fiche est introuvable. */
  joueursNomFige: string[];
  /** Nombre de joueurs à table pour chaque donne (3, 4 ou 5) ; les autres sont au repos. */
  parDonne: number;
  /** Index du siège du donneur de la première donne. */
  depart: number;
  /** `true` une fois l'ordre des sièges changé en cours de partie : les repos suivants sont alors
   * choisis pour équilibrer le nombre de donnes jouées (voir `tableEquilibree`). */
  ordreModifie?: boolean;
}

/** Table en cours de composition, avant l'ouverture de la feuille (jamais persistée). */
export interface TirageEnCours {
  /** Identifiant de la future table. */
  id: string;
  /** Noms saisis, dans l'ordre des sièges. */
  joueurs: string[];
  /** Identifiants des fiches correspondantes (créées au besoin). */
  joueursId: string[];
  /** Nombre de joueurs à table pour chaque donne. */
  parDonne: number;
}

/** Ce que l'écran « Qui distribue ? » renvoie : indices dans `TirageEnCours.joueurs`. */
export interface ChoixDonneur {
  /** Ordre des sièges autour de la table. */
  ordre: number[];
  /** Joueurs au repos pour la première donne. */
  auRepos: number[];
  /** Siège du donneur de la première donne (jamais un joueur au repos). */
  donneur: number;
}

/** Donne annulée et redonnée par le même donneur (Petit sec) ; sans effet sur le score. */
export interface Annulation {
  /** Identifiant unique de l'annulation. */
  id: string;
  /** Nombre de donnes déjà inscrites au moment de l'annulation. */
  avantDonne: number;
  /** Sièges à table pour la donne annulée. */
  table: number[];
  /** Siège du donneur, qui redonne. */
  donneur: number;
  /** Siège du joueur qui avait le Petit sec. */
  joueur: number;
  /** Date d'enregistrement, au format ISO. */
  date: string;
}

/** Résumé léger d'une table ouverte ou d'une partie archivée (index `tarot:tables` / `tarot:historique`). */
export interface HistoriqueEntree {
  /** Identifiant de la table, aussi celui de son enregistrement complet. */
  id: string;
  /** Date de création ou de clôture, au format ISO. */
  date: string;
  /** Noms des joueurs, dans l'ordre des sièges. */
  joueurs: string[];
  /** Identifiants des fiches, dans l'ordre des sièges (nécessaire au garde-fou de fusion). */
  joueursId: string[];
  /** Nombre de joueurs à table pour chaque donne. */
  parDonne: number;
  /** Nombre de donnes inscrites. */
  nbDonnes: number;
  /** Total de points de chaque joueur, dans l'ordre des sièges. */
  totaux: number[];
}

/**
 * Enregistrement complet d'une table ouverte (`tarot:table:{id}`) ou d'une partie archivée (`tarot:archive:{id}`).
 */
export interface ArchiveRecord extends Partie {
  /** Donnes inscrites, dans l'ordre de jeu. */
  donnes: Donne[];
  /** Donnes annulées par un Petit sec. */
  annulations: Annulation[];
  /** Brouillon de la main en cours (cartes notées avant l'inscription de la donne). */
  cartesEnCours?: string[];
  /** Brouillon du chien de la main en cours. */
  chienEnCours?: string[];
}
