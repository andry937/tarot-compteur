/**
 * Prépare ce dont le suivi a besoin pour démarrer : la webcam, affichée dans un élément <video>, et le détecteur
 * ONNX (`public/models/`). Lève `ErreurCamera` si la caméra est inaccessible et `ErreurModele` si le modèle manque.
 * @module
 */

import { arreterFlux, ouvrirCamera } from "./camera";
import type { Detecteur } from "./detecteur";
import { creerDetecteurOnnx } from "./detecteurOnnx";
import { sourceVideo } from "./source";
import type { Source } from "./source";

/** Réglages de la webcam. */
export interface OptionsSource {
  deviceId?: string;
  largeur: number;
  hauteur: number;
  fps: number;
  video: HTMLVideoElement;
}

/** Ouvre la webcam et la branche sur l'élément <video> ; l'arrêt de la source libère la caméra. */
export async function preparerSource(o: OptionsSource): Promise<Source> {
  const flux = await ouvrirCamera({ deviceId: o.deviceId, largeur: o.largeur, hauteur: o.hauteur, fps: o.fps });
  o.video.srcObject = flux;
  await o.video.play();
  return sourceVideo(o.video, "Webcam", () => {
    arreterFlux(flux);
    o.video.srcObject = null;
  });
}

/** Charge le détecteur ONNX (modèle et liste des classes servis avec l'appli). */
export function preparerDetecteur(): Promise<Detecteur> {
  return creerDetecteurOnnx({ urlModele: "/models/cartes.onnx", urlClasses: "/models/classes.json" });
}
