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
  /** Sièges (indices de `joueurs`) au repos pour la première donne, quand il y a plus de joueurs que de places. */
  auRepos: number[];
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
