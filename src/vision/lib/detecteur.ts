import type { Detection } from "@/vision/domain/types";

/** Une image à analyser : n'importe quelle source dessinable (vidéo, canvas, bitmap). */
export interface ImageEntree {
  source: CanvasImageSource;
  largeur: number;
  hauteur: number;
  /** Horodatage de la capture, en millisecondes. */
  t: number;
}

/** Où passe le temps d'une détection, en millisecondes (dernière image). */
export interface DetailTemps {
  /** Copie de l'image du flux (createImageBitmap), sur le fil de l'interface. */
  copie: number;
  /** Dessin dans l'entrée carrée du modèle et lecture des pixels. */
  dessin: number;
  /** Conversion des pixels en tenseur. */
  tenseur: number;
  /** Exécution du modèle (session.run, lecture des sorties comprise). */
  modele: number;
  /** Décodage des sorties (seuils, suppression des doublons). */
  decodage: number;
  /** Échanges avec le worker et file d'attente : le reste du temps. */
  attente: number;
}

/** Ce que la boucle attend d'un détecteur : le modèle réel et le détecteur factice le respectent. */
export interface Detecteur {
  nom: string;
  /** À montrer à l'utilisateur, si quelque chose s'écarte du cas nominal (ex. le modèle tourne sur le processeur). */
  avertissement?: string;
  /** Détail du temps de la dernière détection, si le détecteur le mesure. */
  temps?: DetailTemps;
  detecter(image: ImageEntree): Promise<Detection[]>;
  fermer(): void;
}

/** Détecteur scripté : rejoue des détections déterminées par le temps (mode test, démo, tests). */
export class DetecteurFactice implements Detecteur {
  nom = "Détecteur factice";
  constructor(private scenario: (t: number) => Detection[]) {}
  async detecter(image: ImageEntree): Promise<Detection[]> {
    return this.scenario(image.t);
  }
  fermer(): void {
    /* rien à libérer */
  }
}

export type CodeErreurModele = "absent" | "incompatible" | "backend" | "inconnue";

export class ErreurModele extends Error {
  constructor(public code: CodeErreurModele, message: string) {
    super(message);
    this.name = "ErreurModele";
  }
}
