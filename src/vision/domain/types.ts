/** Types partagés de la détection. Aucune dépendance à React ni à la caméra. */

/**
 * Emplacement d'une carte : le chien, l'écart, ou « table » (partout ailleurs). Pendant le jeu, la position
 * d'une carte ne dit pas qui l'a jouée : c'est l'ordre d'arrivée qui l'attribue (voir `machinePli`).
 */
export type ZoneId = "table" | "chien" | "ecart";

/** Une détection brute du modèle : un coin de carte, boîte normalisée (0..1) dans l'image. */
export interface Detection {
  /** Identifiant de carte (`"atout-12"`, `"coeur-14"`, `"excuse"`…). */
  carte: string;
  confiance: number;
  /** Coin haut-gauche et taille de la boîte, normalisés. */
  x: number;
  y: number;
  l: number;
  h: number;
}

/** Une carte reconnue après fusion de ses coins (le jeu est unique : une classe = une carte). */
export interface CarteVue {
  carte: string;
  confiance: number;
  /** Centre estimé (milieu des coins vus ; avec un seul coin, c'est ce coin). */
  cx: number;
  cy: number;
  /** Nombre de coins vus (1 ou 2). */
  nbCoins: number;
}

/** Rectangle normalisé du chien ou de l'écart. */
export interface Zone {
  id: ZoneId;
  x: number;
  y: number;
  l: number;
  h: number;
}

/** Ce qu'une image apporte au suivi après seuils et affectation aux zones. */
export interface ObsCarte {
  carte: string;
  /** `null` : carte vue hors de tout emplacement. */
  zone: ZoneId | null;
}

export interface Observation {
  /** Horodatage de l'image, en millisecondes. */
  t: number;
  cartes: ObsCarte[];
}
