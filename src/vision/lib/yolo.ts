import type { Detection } from "@/vision/domain/types";

/**
 * Pré- et post-traitement d'un détecteur YOLO exporté en ONNX (sortie type YOLOv8 :
 * `[1, 4 + nbClasses, N]`, boîtes `cx, cy, l, h` en pixels de l'image d'entrée, puis un
 * score par classe). Fonctions pures, testables sans modèle ni navigateur.
 */

/** Zone de l'image source analysée, normalisée (0..1). Par défaut, toute l'image. */
export interface Roi {
  x: number;
  y: number;
  l: number;
  h: number;
}

export const ROI_COMPLETE: Roi = { x: 0, y: 0, l: 1, h: 1 };

/** Passage de l'image source (recadrée sur la ROI) à l'entrée carrée du modèle, avec bandes de remplissage. */
export interface Letterbox {
  taille: number;
  echelle: number;
  /** Décalage des bandes dans l'entrée du modèle (pixels). */
  dx: number;
  dy: number;
  /** Région source analysée, en pixels. */
  sx: number;
  sy: number;
  sl: number;
  sh: number;
  /** Dimensions de l'image source complète, pour normaliser le résultat. */
  largeurSource: number;
  hauteurSource: number;
}

export function calculerLetterbox(largeurSource: number, hauteurSource: number, taille: number, roi: Roi = ROI_COMPLETE): Letterbox {
  const sx = roi.x * largeurSource;
  const sy = roi.y * hauteurSource;
  const sl = roi.l * largeurSource;
  const sh = roi.h * hauteurSource;
  const echelle = Math.min(taille / sl, taille / sh);
  return {
    taille, echelle,
    dx: (taille - sl * echelle) / 2,
    dy: (taille - sh * echelle) / 2,
    sx, sy, sl, sh, largeurSource, hauteurSource,
  };
}

/** RGBA (taille × taille) → tenseur float32 CHW (R, G, B) normalisé entre 0 et 1. */
export function rgbaVersTenseur(rgba: Uint8ClampedArray | Uint8Array, taille: number): Float32Array {
  const n = taille * taille;
  const sortie = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    sortie[i] = rgba[i * 4] / 255;
    sortie[n + i] = rgba[i * 4 + 1] / 255;
    sortie[2 * n + i] = rgba[i * 4 + 2] / 255;
  }
  return sortie;
}

export interface OptionsDecodage {
  /** Score minimal d'une détection brute (le filtrage fin par classe est fait ensuite par `seuils.ts`). */
  seuil: number;
  /** Recouvrement (IoU) au-delà duquel deux boîtes de la même classe sont fusionnées. */
  iou: number;
}

export const DECODAGE_DEFAUT: OptionsDecodage = { seuil: 0.25, iou: 0.5 };

const iou = (a: Detection, b: Detection): number => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.l, b.x + b.l);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.l * a.h + b.l * b.h - inter;
  return union > 0 ? inter / union : 0;
};

/**
 * Décode la sortie du modèle en détections normalisées dans l'image source, puis applique une
 * suppression des doublons par classe. Les deux coins d'une même carte, éloignés l'un de l'autre,
 * ne se recouvrent pas : ils sont conservés (la fusion en carte est faite par `fusionCoins`).
 */
export function decoderYolo(
  sortie: Float32Array,
  dims: readonly number[],
  lb: Letterbox,
  classes: readonly string[],
  options: OptionsDecodage = DECODAGE_DEFAUT
): Detection[] {
  const nbClasses = classes.length;
  // [1, 4 + nc, N] (YOLOv8) ou [1, N, 4 + nc] (export transposé) : on reconnaît la disposition au
  // nombre de canaux attendu, pas à la taille relative des dimensions (qui dépend du nombre de boîtes).
  const attendus = 4 + nbClasses;
  const transpose = dims[1] !== attendus && dims[2] === attendus;
  const n = transpose ? dims[1] : dims[2];
  const canaux = transpose ? dims[2] : dims[1];
  if (canaux !== attendus) {
    throw new Error(`Sortie du modèle incompatible : ${canaux} canaux pour ${nbClasses} classes (attendu ${attendus}).`);
  }
  const lire = (canal: number, i: number) => (transpose ? sortie[i * canaux + canal] : sortie[canal * n + i]);

  const brutes: Detection[] = [];
  for (let i = 0; i < n; i++) {
    let meilleur = -1;
    let score = options.seuil;
    for (let c = 0; c < nbClasses; c++) {
      const s = lire(4 + c, i);
      if (s >= score) {
        score = s;
        meilleur = c;
      }
    }
    if (meilleur < 0) continue;
    const cx = lire(0, i);
    const cy = lire(1, i);
    const l = lire(2, i);
    const h = lire(3, i);
    // Entrée du modèle → pixels de la région source → coordonnées normalisées de l'image.
    const xs = (cx - l / 2 - lb.dx) / lb.echelle + lb.sx;
    const ys = (cy - h / 2 - lb.dy) / lb.echelle + lb.sy;
    brutes.push({
      carte: classes[meilleur],
      confiance: score,
      x: xs / lb.largeurSource,
      y: ys / lb.hauteurSource,
      l: l / lb.echelle / lb.largeurSource,
      h: h / lb.echelle / lb.hauteurSource,
    });
  }

  const gardees: Detection[] = [];
  for (const d of brutes.sort((a, b) => b.confiance - a.confiance)) {
    if (!gardees.some((g) => g.carte === d.carte && iou(g, d) > options.iou)) gardees.push(d);
  }
  return gardees;
}
