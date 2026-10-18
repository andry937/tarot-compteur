import type { Donne } from "@/domain/score/regles";

export interface Partie {
  joueursId: string[];
  joueursNomFige: string[];
  parDonne: number;
  depart: number;
}

export interface TirageEnCours {
  id: string;
  joueurs: string[];
  joueursId: string[];
  parDonne: number;
}

/** Ce que l'écran « Qui distribue ? » renvoie : indices dans `TirageEnCours.joueurs`. */
export interface ChoixDonneur {
  /** Ordre des sièges autour de la table. */
  ordre: number[];
  /** Joueurs au repos pour la première donne. */
  auRepos: number[];
  donneur: number;
}

export interface Annulation {
  id: string;
  avantDonne: number;
  table: number[];
  donneur: number;
  joueur: number;
  date: string;
}

export interface HistoriqueEntree {
  id: string;
  date: string;
  joueurs: string[];
  joueursId: string[];
  parDonne: number;
  nbDonnes: number;
  totaux: number[];
}

export interface ArchiveRecord extends Partie {
  donnes: Donne[];
  annulations: Annulation[];
  /** Brouillon de la main en cours (cartes notées avant l'inscription de la donne). */
  cartesEnCours?: string[];
  /** Brouillon du chien de la main en cours. */
  chienEnCours?: string[];
}
