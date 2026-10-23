import { pipelineInitial, traiterImage } from "@/vision/domain/pipeline";
import { stabilisationPourDebit } from "@/vision/domain/stabilisation";
import type { EtatPipeline, ReglagesPipeline } from "@/vision/domain/pipeline";
import type { ConfigSuivi, EtatSuivi } from "@/vision/domain/machinePli";
import type { Detection } from "@/vision/domain/types";
import type { Detecteur } from "./detecteur";
import { horloge } from "./horloge";
import type { Source } from "./source";

export interface ImageTraitee {
  etat: EtatPipeline;
  /** Détections brutes de cette image (pour l'affichage superposé). */
  detections: Detection[];
  t: number;
  /** Images analysées par seconde (moyenne glissante). */
  fps: number;
  /** Durée de l'inférence de cette image, en ms. */
  dureeMs: number;
}

export interface OptionsBoucle {
  source: Source;
  detecteur: Detecteur;
  config: ConfigSuivi;
  /** Lus à chaque image : les réglages peuvent changer en direct. */
  reglages: () => ReglagesPipeline;
  onImage: (r: ImageTraitee) => void;
  onErreur: (e: Error) => void;
  maintenant?: () => number;
  /** Planifie l'image suivante ; renvoie une fonction d'annulation. Remplaçable dans les tests. */
  planifier?: (cb: () => void) => () => void;
  /** État de départ (reprise d'une partie sauvegardée). */
  etatDepart?: EtatPipeline;
}

export interface Boucle {
  demarrer(): void;
  pause(): void;
  reprendre(): void;
  arreter(): void;
  estEnPause(): boolean;
  /** Traite une image tout de suite (la boucle l'appelle en continu ; exposé pour les tests). */
  pas(): Promise<void>;
  etat(): EtatPipeline;
  /** Applique une correction manuelle au suivi (voir `domain/vision/corrections`) et renvoie le nouvel état. */
  corriger(f: (suivi: EtatSuivi) => EtatSuivi): EtatPipeline;
}

/**
 * Boucle de suivi : image de la source → détecteur → chaîne de traitement → affichage. Les images
 * qui arrivent pendant qu'une inférence est en cours sont ignorées (on analyse toujours la plus
 * récente), si bien que le débit s'adapte à la machine au lieu de s'accumuler en retard.
 */
export function creerBoucle(o: OptionsBoucle): Boucle {
  const maintenant = o.maintenant ?? horloge;
  const planifier = o.planifier ?? ((cb) => {
    const id = setTimeout(cb, 1);
    return () => clearTimeout(id);
  });
  let etat = o.etatDepart ?? pipelineInitial(o.config);
  let actif = false;
  let enPause = false;
  let occupe = false;
  let annuler: (() => void) | null = null;
  const dernieres: number[] = [];

  async function pas(): Promise<void> {
    if (occupe || enPause) return;
    const image = o.source.image();
    if (!image) return;
    occupe = true;
    try {
      const debut = maintenant();
      const { largeur, hauteur } = o.source.taille();
      const detections = await o.detecteur.detecter({ source: image, largeur, hauteur, t: debut });
      const fin = maintenant();
      dernieres.push(fin);
      if (dernieres.length > 15) dernieres.shift();
      const duree = dernieres[dernieres.length - 1] - dernieres[0];
      const fps = dernieres.length > 1 && duree > 0 ? ((dernieres.length - 1) * 1000) / duree : 0;
      // Les seuils de stabilisation sont ramenés au débit réel (voir `stabilisationPourDebit`).
      const reglages = o.reglages();
      const { etat: suivant } = traiterImage(etat, { t: debut, detections }, { ...reglages, stabilisation: stabilisationPourDebit(reglages.stabilisation, fps) });
      etat = suivant;
      o.onImage({ etat, detections, t: debut, fps, dureeMs: fin - debut });
    } catch (e) {
      o.onErreur(e instanceof Error ? e : new Error(String(e)));
    } finally {
      occupe = false;
    }
  }

  function boucler() {
    if (!actif) return;
    void pas().finally(() => {
      if (actif) annuler = planifier(boucler);
    });
  }

  return {
    demarrer() {
      if (actif) return;
      actif = true;
      boucler();
    },
    pause() {
      enPause = true;
    },
    reprendre() {
      enPause = false;
    },
    arreter() {
      actif = false;
      annuler?.();
    },
    estEnPause: () => enPause,
    pas,
    etat: () => etat,
    corriger(f) {
      // Lu à chaque image après l'inférence : une correction faite pendant l'analyse d'une image n'est pas perdue.
      etat = { ...etat, suivi: f(etat.suivi) };
      return etat;
    },
  };
}
