/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/webgpu";
// Fichiers WASM d'onnxruntime, importés comme des ressources de l'appli (hors ligne, sans CDN, sans copie manuelle).
import mjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import { CoeurOnnx } from "./onnxCoeur";
import type { OrtMinimal, OptionsCoeur } from "./onnxCoeur";
import { calculerLetterbox, ROI_COMPLETE } from "./yolo";
import type { Roi } from "./yolo";
import { ErreurModele } from "./detecteur";

/** Worker d'inférence : le modèle tourne hors du fil de l'interface. Messages : init → pret|erreur ; detecter → detections|erreur. */

export type MessageVersWorker =
  | { type: "init"; octetsModele: ArrayBuffer; classes: string[]; taille: number; roi?: Roi; fournisseurs?: string[] }
  | { type: "detecter"; id: number; bitmap: ImageBitmap };

export type MessageDepuisWorker =
  | { type: "pret"; fournisseur: string; repli?: string }
  | { type: "erreur"; id?: number; code: string; message: string }
  | { type: "detections"; id: number; detections: import("@/vision/domain/types").Detection[]; temps: { dessin: number; tenseur: number; modele: number; decodage: number } };

let coeur: CoeurOnnx | null = null;
let taille = 960;
let roi: Roi = ROI_COMPLETE;
let canvas: OffscreenCanvas | null = null;

const envoyer = (m: MessageDepuisWorker) => (self as unknown as Worker).postMessage(m);

interface InfoAdaptateur {
  isFallbackAdapter?: boolean;
  architecture?: string;
  device?: string;
  description?: string;
}

/**
 * WebGPU n'est utile que sur un vrai processeur graphique. Chrome propose parfois un adaptateur logiciel
 * (SwiftShader) : l'inférence y est si lente, voire bloquée, que le WASM va bien plus vite.
 */
async function webgpuMateriel(): Promise<boolean> {
  try {
    const gpu = (self.navigator as unknown as { gpu?: { requestAdapter(): Promise<{ info?: InfoAdaptateur } | null> } }).gpu;
    const adaptateur = await gpu?.requestAdapter();
    if (!adaptateur) return false;
    const i = adaptateur.info ?? {};
    return !i.isFallbackAdapter && !/swiftshader|llvmpipe|software/i.test(`${i.architecture} ${i.device} ${i.description}`);
  } catch {
    return false;
  }
}

// Un message à la fois : onnxruntime n'accepte pas deux `run` simultanés sur la même session (la lecture en direct et
// « Figer un pli » envoient chacune leurs images).
let file: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent<MessageVersWorker>) => {
  file = file.then(() => traiter(e.data));
};

async function traiter(m: MessageVersWorker): Promise<void> {
  if (m.type === "init") {
    try {
      ort.env.wasm.wasmPaths = { mjs: mjsUrl, wasm: wasmUrl };
      taille = m.taille;
      roi = m.roi ?? ROI_COMPLETE;
      const fournisseurs = m.fournisseurs ?? ((await webgpuMateriel()) ? ["webgpu", "wasm"] : ["wasm"]);
      const options: OptionsCoeur = { taille, classes: m.classes, roi, fournisseurs };
      coeur = await CoeurOnnx.creer(ort as unknown as OrtMinimal, new Uint8Array(m.octetsModele), options);
      canvas = new OffscreenCanvas(taille, taille);
      envoyer({ type: "pret", fournisseur: coeur.fournisseur, repli: coeur.repli });
    } catch (err) {
      const code = err instanceof ErreurModele ? err.code : "inconnue";
      envoyer({ type: "erreur", code, message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (m.type === "detecter") {
    try {
      if (!coeur || !canvas) throw new ErreurModele("inconnue", "Modèle non initialisé.");
      const debut = performance.now();
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const lb = calculerLetterbox(m.bitmap.width, m.bitmap.height, taille, roi);
      ctx.fillStyle = "rgb(114,114,114)";
      ctx.fillRect(0, 0, taille, taille);
      ctx.drawImage(m.bitmap, lb.sx, lb.sy, lb.sl, lb.sh, lb.dx, lb.dy, lb.sl * lb.echelle, lb.sh * lb.echelle);
      const rgba = ctx.getImageData(0, 0, taille, taille).data;
      const dessin = performance.now() - debut;
      const detections = await coeur.inferer(rgba, m.bitmap.width, m.bitmap.height);
      m.bitmap.close();
      envoyer({ type: "detections", id: m.id, detections, temps: { dessin, ...coeur.dernierTemps } });
    } catch (err) {
      m.bitmap.close();
      console.error("Inférence en échec", err);
      envoyer({ type: "erreur", id: m.id, code: err instanceof ErreurModele ? err.code : "inconnue", message: err instanceof Error ? err.message : String(err) });
    }
  }
}
