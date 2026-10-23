import { calculerLetterbox, decoderYolo, DECODAGE_DEFAUT, ROI_COMPLETE, rgbaVersTenseur } from "./yolo";
import type { OptionsDecodage, Roi } from "./yolo";
import { ErreurModele } from "./detecteur";
import type { Detection } from "@/vision/domain/types";

/** Le sous-ensemble d'`onnxruntime-web` utilisé : injecté pour pouvoir le tester sous Node. */
export interface OrtMinimal {
  InferenceSession: {
    create(modele: Uint8Array, options?: { executionProviders?: string[] }): Promise<{
      inputNames: readonly string[];
      outputNames: readonly string[];
      run(entrees: Record<string, unknown>): Promise<Record<string, { data: Float32Array | Uint16Array | number[]; dims: readonly number[] }>>;
      release?(): Promise<void>;
    }>;
  };
  Tensor: new (type: "float32", data: Float32Array, dims: readonly number[]) => unknown;
}

export interface OptionsCoeur {
  taille: number;
  classes: readonly string[];
  roi?: Roi;
  decodage?: OptionsDecodage;
  fournisseurs?: string[];
}

/**
 * Séance d'inférence : pré-traitement (tenseur CHW), exécution du modèle, décodage. Le dessin de
 * l'image dans l'entrée carrée (letterbox) est fait par l'appelant, qui connaît le navigateur.
 */
export class CoeurOnnx {
  private constructor(
    private session: Awaited<ReturnType<OrtMinimal["InferenceSession"]["create"]>>,
    private ort: OrtMinimal,
    private options: Required<Pick<OptionsCoeur, "taille" | "classes">> & OptionsCoeur,
    /** Fournisseur d'exécution retenu (« webgpu » ou « wasm »). */
    readonly fournisseur: string,
    /** Pourquoi les fournisseurs préférés ont échoué, quand on a dû se rabattre sur un autre. */
    readonly repli?: string
  ) {}

  /** Charge le modèle ; essaie les fournisseurs dans l'ordre (WebGPU puis WASM) et explique l'échec. */
  static async creer(ort: OrtMinimal, octetsModele: Uint8Array, options: OptionsCoeur): Promise<CoeurOnnx> {
    const fournisseurs = options.fournisseurs ?? ["webgpu", "wasm"];
    const echecs: string[] = [];
    for (const f of fournisseurs) {
      try {
        const session = await ort.InferenceSession.create(octetsModele, { executionProviders: [f] });
        console.info(`Modèle chargé avec le fournisseur « ${f} ».`);
        return new CoeurOnnx(session, ort, options, f, echecs.length ? echecs.join(" ; ") : undefined);
      } catch (e) {
        console.warn(`Fournisseur « ${f} » indisponible :`, e);
        echecs.push(`${f} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    throw new ErreurModele("incompatible", `Le modèle n'a pas pu être chargé (${echecs.join(" ; ")}).`);
  }

  /** Durées (ms) de la dernière inférence : tenseur, modèle, décodage. */
  dernierTemps = { tenseur: 0, modele: 0, decodage: 0 };

  /** `rgba` : image déjà dessinée dans l'entrée carrée du modèle (taille × taille). */
  async inferer(rgba: Uint8ClampedArray | Uint8Array, largeurSource: number, hauteurSource: number): Promise<Detection[]> {
    const { taille, classes } = this.options;
    const t0 = performance.now();
    const entree = new this.ort.Tensor("float32", rgbaVersTenseur(rgba, taille), [1, 3, taille, taille]);
    const t1 = performance.now();
    const sorties = await this.session.run({ [this.session.inputNames[0]]: entree });
    const sortie = sorties[this.session.outputNames[0]];
    const donnees = sortie.data instanceof Float32Array ? sortie.data : Float32Array.from(sortie.data as ArrayLike<number>);
    const t2 = performance.now();
    const lb = calculerLetterbox(largeurSource, hauteurSource, taille, this.options.roi ?? ROI_COMPLETE);
    try {
      const detections = decoderYolo(donnees, sortie.dims, lb, classes, this.options.decodage ?? DECODAGE_DEFAUT);
      this.dernierTemps = { tenseur: t1 - t0, modele: t2 - t1, decodage: performance.now() - t2 };
      return detections;
    } catch (e) {
      throw new ErreurModele("incompatible", e instanceof Error ? e.message : String(e));
    }
  }

  async fermer(): Promise<void> {
    await this.session.release?.();
  }
}
