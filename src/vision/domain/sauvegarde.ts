/**
 * Sérialisation de l'état du suivi pour le reprendre après un rechargement de la page. L'état de
 * stabilisation contient des `Map`, que JSON ne sait pas écrire : on les écrit en listes de paires. À la
 * lecture, la forme est validée : une sauvegarde abîmée ou d'une autre version est refusée (`null`), elle
 * ne doit pas faire planter le suivi.
 */

import type { EtatPipeline } from "./pipeline";
import type { Alerte, EtatSuivi, Phase, PliJoue, Pose, SurchargePli } from "./machinePli";
import type { EtatStabilisation } from "./stabilisation";
import type { ZoneId } from "./types";

type Paire = [string, ZoneId | null];

export interface PipelineJson {
  suivi: EtatSuivi;
  stab: { fenetre: { t: number; vues: Paire[] }[]; presentes: Paire[] };
}

export function pipelineVersJson(e: EtatPipeline): PipelineJson {
  return {
    suivi: e.suivi,
    stab: {
      fenetre: e.stab.fenetre.map((img) => ({ t: img.t, vues: [...img.vues.entries()] })),
      presentes: [...e.stab.presentes.entries()],
    },
  };
}

const PHASES: ReadonlySet<string> = new Set<Phase>(["attente", "enCours", "complet", "ramassage", "termine"]);
const GRAVITES: ReadonlySet<string> = new Set(["info", "avertissement", "erreur"]);

const estNombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const estChaine = (v: unknown): v is string => typeof v === "string";
const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const estListe = <T,>(v: unknown, test: (x: unknown) => x is T): v is T[] => Array.isArray(v) && v.every(test);
const estZone = (v: unknown): v is ZoneId | null => v === null || estNombre(v) || v === "chien" || v === "ecart" || v === "table";
const estPaire = (v: unknown): v is Paire => Array.isArray(v) && v.length === 2 && estChaine(v[0]) && estZone(v[1]);
const estPose = (v: unknown): v is Pose =>
  estObjet(v) && estChaine(v.carte) && estNombre(v.joueur) && estNombre(v.horodatage) && (v.observee === undefined || estChaine(v.observee));
const estSurcharge = (v: unknown): v is SurchargePli =>
  estObjet(v) &&
  (v.entame === undefined || estNombre(v.entame)) &&
  (v.gagnant === undefined || estNombre(v.gagnant)) &&
  (v.joueurs === undefined || (estObjet(v.joueurs) && Object.values(v.joueurs).every(estNombre))) &&
  (v.cartes === undefined || (estObjet(v.cartes) && Object.values(v.cartes).every(estChaine)));
const estPli = (v: unknown): v is PliJoue =>
  estObjet(v) && estNombre(v.numero) && estListe(v.poses, estPose) && v.poses.length > 0 && estNombre(v.entame) && estNombre(v.gagnant) &&
  (v.ordreInattendu === undefined || typeof v.ordreInattendu === "boolean") &&
  (v.surcharge === undefined || estSurcharge(v.surcharge));
const estAlerte = (v: unknown): v is Alerte =>
  estObjet(v) && estChaine(v.cle) && estChaine(v.message) && estChaine(v.gravite) && GRAVITES.has(v.gravite) && (v.pli === undefined || estNombre(v.pli));

function suiviValide(v: unknown): v is EtatSuivi {
  if (!estObjet(v) || !estObjet(v.config)) return false;
  const c = v.config;
  return (
    estListe(c.table, estNombre) && c.table.length >= 3 && estNombre(c.entameInitiale) && c.table.includes(c.entameInitiale) &&
    estChaine(v.phase) && PHASES.has(v.phase) &&
    estListe(v.poseCourante, estPose) && estListe(v.plis, estPli) && estSurcharge(v.surchargeCourante) &&
    estListe(v.chien, estChaine) && estListe(v.ecart, estChaine) &&
    estObjet(v.presentes) && Object.values(v.presentes).every(estZone) &&
    estNombre(v.entameAttendue) && estListe(v.alertes, estAlerte)
  );
}

/** Relit un état sauvegardé ; `null` si la forme n'est pas celle d'un état du suivi. */
export function pipelineDepuisJson(v: unknown): EtatPipeline | null {
  if (!estObjet(v) || !estObjet(v.stab) || !suiviValide(v.suivi)) return null;
  const { fenetre, presentes } = v.stab;
  const fenetreOk = Array.isArray(fenetre) && fenetre.every((img) => estObjet(img) && estNombre(img.t) && estListe(img.vues, estPaire));
  if (!fenetreOk || !estListe(presentes, estPaire)) return null;
  const stab: EtatStabilisation = {
    fenetre: (fenetre as { t: number; vues: Paire[] }[]).map((img) => ({ t: img.t, vues: new Map(img.vues) })),
    presentes: new Map(presentes),
  };
  return { suivi: v.suivi, stab };
}
