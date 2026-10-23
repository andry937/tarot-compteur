/**
 * Sauvegarde locale de la manche en cours (`localStorage`, quelques kilo-octets : un état de suivi, pas des
 * images). Écrite au fil du jeu, relue au démarrage pour proposer de reprendre.
 */

import type { Annonce } from "@/vision/domain/annonce";
import type { EtatPipeline } from "@/vision/domain/pipeline";
import { pipelineDepuisJson, pipelineVersJson } from "@/vision/domain/sauvegarde";
import { ecrire, lire } from "./stockage";

/** Une sauvegarde par table ouverte : plusieurs tables peuvent être suivies sur le même appareil. */
const cle = (table: string) => `partie:${table}`;
const VERSION = 1;

export interface PartieSauvegardee {
  version: number;
  /** Date ISO de la dernière sauvegarde. */
  sauvegardeA: string;
  noms: string[];
  annonce: Annonce;
  pipeline: EtatPipeline;
}

/** Résumé en clair pour la proposition de reprise. */
export function resume(p: PartieSauvegardee): string {
  const s = p.pipeline.suivi;
  const n = s.plis.length;
  const plis = `${n} pli${n > 1 ? "s" : ""} terminé${n > 1 ? "s" : ""}`;
  if (s.phase === "termine") return `${plis}, manche terminée`;
  return s.poseCourante.length ? `${plis}, ${s.poseCourante.length} carte(s) dans le pli en cours` : plis;
}

/** Rien à sauvegarder tant que la caméra n'a rien observé : on n'écrase pas une sauvegarde par du vide. */
export function vaut(e: EtatPipeline): boolean {
  const s = e.suivi;
  return s.plis.length > 0 || s.poseCourante.length > 0 || s.chien.length > 0 || s.ecart.length > 0;
}

export function sauvegarderPartie(table: string, noms: string[], annonce: Annonce, pipeline: EtatPipeline, maintenant: Date = new Date()): void {
  ecrire(cle(table), { version: VERSION, sauvegardeA: maintenant.toISOString(), noms, annonce, pipeline: pipelineVersJson(pipeline) });
}

/** Relit la manche sauvegardée ; `null` s'il n'y en a pas, ou si elle est abîmée ou d'une autre version. */
export function chargerPartie(table: string): PartieSauvegardee | null {
  const brut = lire<unknown>(cle(table), null);
  if (typeof brut !== "object" || brut === null) return null;
  const b = brut as Record<string, unknown>;
  const a = b.annonce as Record<string, unknown> | undefined;
  const pipeline = pipelineDepuisJson(b.pipeline);
  if (b.version !== VERSION || !pipeline || typeof b.sauvegardeA !== "string") return null;
  if (!Array.isArray(b.noms) || !b.noms.every((n) => typeof n === "string")) return null;
  if (!a || typeof a.preneur !== "number" || (a.roiAppele !== null && typeof a.roiAppele !== "string")) return null;
  if (pipeline.suivi.config.table.some((siege) => siege >= (b.noms as string[]).length)) return null; // un siège sans nom : sauvegarde d'une autre table
  return {
    version: VERSION,
    sauvegardeA: b.sauvegardeA,
    noms: b.noms as string[],
    annonce: { preneur: a.preneur, roiAppele: a.roiAppele as Annonce["roiAppele"] },
    pipeline,
  };
}

/** Efface la sauvegarde (nouvelle manche, ou reprise refusée par l'utilisateur). */
export function effacerPartie(table: string): void {
  ecrire(cle(table), null);
}
