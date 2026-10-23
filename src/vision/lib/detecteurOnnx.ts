import type { Detection } from "@/vision/domain/types";
import { ErreurModele } from "./detecteur";
import type { DetailTemps, Detecteur, ImageEntree } from "./detecteur";
import type { MessageDepuisWorker, MessageVersWorker } from "./onnx.worker";
import type { Roi } from "./yolo";

export interface OptionsDetecteurOnnx {
  urlModele: string;
  urlClasses: string;
  taille?: number;
  roi?: Roi;
  fournisseurs?: string[];
}

const CACHE = "tarot-vision-modeles-v1";

/** Récupère un fichier de modèle, le met en cache (hors ligne), et retombe sur le cache si le réseau échoue. */
export async function recuperer(url: string): Promise<Response> {
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE).catch(() => null) : null;
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    // Un serveur d'appli à page unique renvoie index.html (code 200) pour un fichier qui n'existe pas.
    if ((reponse.headers.get("content-type") ?? "").includes("text/html")) throw new Error("le serveur a renvoyé une page web au lieu du fichier");
    await cache?.put(url, reponse.clone()).catch(() => undefined);
    return reponse;
  } catch (e) {
    const enCache = await cache?.match(url);
    if (enCache) return enCache;
    throw new ErreurModele("absent", `Fichier de modèle introuvable : ${url} (${e instanceof Error ? e.message : String(e)}). Placez cartes.onnx et classes.json dans public/models/ (voir tools/README).`);
  }
}

/** Détecteur réel : modèle YOLO/ONNX exécuté dans un Web Worker (WebGPU, sinon WASM). */
export async function creerDetecteurOnnx(options: OptionsDetecteurOnnx): Promise<Detecteur> {
  const [repModele, repClasses] = await Promise.all([recuperer(options.urlModele), recuperer(options.urlClasses)]);
  const brut: unknown = await repClasses.json();
  // `classes.json` : une liste d'identifiants, ou `{ "classes": [...], "taille": 960 }` (taille d'entrée du modèle).
  const meta = Array.isArray(brut) ? { classes: brut as string[], taille: undefined } : (brut as { classes?: string[]; taille?: number });
  const classes = meta.classes;
  if (!classes || classes.length === 0) throw new ErreurModele("incompatible", "classes.json doit être une liste d'identifiants de cartes.");
  const tailleEntree = options.taille ?? meta.taille ?? 960;
  const octetsModele = await repModele.arrayBuffer();

  const worker = new Worker(new URL("./onnx.worker.ts", import.meta.url), { type: "module" });
  const envoyer = (m: MessageVersWorker, transfert: Transferable[] = []) => worker.postMessage(m, transfert);

  let fournisseur = "";
  let repli: string | undefined;
  await new Promise<void>((resoudre, rejeter) => {
    worker.onmessage = (e: MessageEvent<MessageDepuisWorker>) => {
      if (e.data.type === "pret") {
        fournisseur = e.data.fournisseur;
        repli = e.data.repli;
        resoudre();
      }
      else if (e.data.type === "erreur") rejeter(new ErreurModele(e.data.code === "incompatible" ? "incompatible" : "backend", e.data.message));
    };
    worker.onerror = (e) => rejeter(new ErreurModele("backend", `Le worker d'inférence a échoué : ${e.message}`));
    envoyer(
      { type: "init", octetsModele, classes, taille: tailleEntree, roi: options.roi, fournisseurs: options.fournisseurs },
      [octetsModele]
    );
  });

  let compteur = 0;
  const attente = new Map<number, { ok: (d: Detection[], temps?: Omit<DetailTemps, "copie" | "attente">) => void; ko: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<MessageDepuisWorker>) => {
    const m = e.data;
    if (m.type === "detections") attente.get(m.id)?.ok(m.detections, m.temps);
    else if (m.type === "erreur" && m.id !== undefined) attente.get(m.id)?.ko(new ErreurModele("inconnue", m.message));
    if ("id" in m && m.id !== undefined) attente.delete(m.id);
  };

  const moteur = fournisseur === "webgpu" ? "WebGPU" : fournisseur === "wasm" ? "processeur (WASM)" : fournisseur;
  const detecteur: Detecteur = {
    nom: `Modèle ONNX, ${moteur}`,
    avertissement:
      fournisseur === "wasm" && repli
        ? `WebGPU n'est pas disponible sur cet appareil ou ce navigateur : le modèle tourne sur le processeur, 2 à 4 fois plus lentement (${repli}).`
        : undefined,
    async detecter(image: ImageEntree) {
      const debut = performance.now();
      const bitmap = await createImageBitmap(image.source);
      const copie = performance.now() - debut;
      const id = ++compteur;
      return new Promise<Detection[]>((ok, ko) => {
        attente.set(id, {
          ok: (detections, temps) => {
            if (temps) {
              const total = performance.now() - debut;
              detecteur.temps = { copie, ...temps, attente: Math.max(0, total - copie - temps.dessin - temps.tenseur - temps.modele - temps.decodage) };
            }
            ok(detections);
          },
          ko,
        });
        envoyer({ type: "detecter", id, bitmap }, [bitmap]);
      });
    },
    fermer() {
      worker.terminate();
    },
  };
  return detecteur;
}
