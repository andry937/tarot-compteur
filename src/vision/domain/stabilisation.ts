import type { Observation, ZoneId } from "./types";

export interface ParamsStabilisation {
  /** Une carte est validée si elle est vue dans au moins `n` des `m` dernières images. */
  n: number;
  m: number;
  /** Une carte validée est retirée si elle est absente d'au moins `absenceN` des `m` dernières images. */
  absenceN: number;
}

export const PARAMS_DEFAUT: ParamsStabilisation = { n: 5, m: 8, absenceN: 5 };

/** Durée pendant laquelle une carte doit rester (ou manquer) pour être validée (ou retirée), quand le débit est faible. */
const DUREE_STABLE_MS = 500;

/**
 * Adapte les seuils au débit réel d'images. Les seuils sont des nombres d'images : à 30 images/s, 5 images durent
 * 170 ms, mais à 3 images/s (iPhone, modèle de 960 px) elles durent 1,7 s, et une carte posée puis ramassée en
 * moins de temps n'est jamais validée — le pli entier est alors perdu. On vise donc `DUREE_STABLE_MS`, sans
 * jamais dépasser les seuils demandés (un débit élevé garde les réglages d'origine) ni descendre sous 2 images
 * (une seule image ne suffit pas à écarter une fausse détection). `fps` inconnu (0) : réglages inchangés.
 */
export function stabilisationPourDebit(params: ParamsStabilisation, fps: number): ParamsStabilisation {
  if (!(fps > 0)) return params;
  const images = Math.round((fps * DUREE_STABLE_MS) / 1000);
  const n = Math.min(params.n, Math.max(2, images));
  const m = Math.min(params.m, Math.max(n, n + 3));
  const absenceN = Math.min(m, params.absenceN, Math.max(2, images));
  return { n, m, absenceN };
}

export type EvenementStab =
  | { type: "validee"; carte: string; zone: ZoneId | null; /** Début de la séquence stable. */ horodatage: number; /** Image de validation. */ valideeA: number }
  | { type: "retiree"; carte: string; t: number; zone: ZoneId | null }
  | { type: "deplacee"; carte: string; de: ZoneId | null; vers: ZoneId | null; t: number };

interface Image {
  t: number;
  vues: Map<string, ZoneId | null>;
}

export interface EtatStabilisation {
  fenetre: Image[];
  presentes: Map<string, ZoneId | null>;
}

export const stabilisationInitiale = (): EtatStabilisation => ({ fenetre: [], presentes: new Map() });

/** Zone la plus fréquente parmi les images où la carte est vue (en cas d'égalité, la plus récente). */
function zoneMajoritaire(fenetre: Image[], carte: string): ZoneId | null {
  const compte = new Map<ZoneId | null, number>();
  let derniere: ZoneId | null = null;
  for (const img of fenetre) {
    if (!img.vues.has(carte)) continue;
    const z = img.vues.get(carte) ?? null;
    compte.set(z, (compte.get(z) ?? 0) + 1);
    derniere = z;
  }
  let meilleure = derniere;
  let max = -1;
  for (const [z, c] of compte) {
    if (c > max || (c === max && z === derniere)) {
      meilleure = z;
      max = c;
    }
  }
  return meilleure;
}

/**
 * Fait avancer le suivi d'une image : renvoie le nouvel état et les événements
 * (carte validée, retirée, déplacée). Pur : aucune horloge, le temps vient de l'image.
 */
export function avancerStabilisation(
  etat: EtatStabilisation,
  obs: Observation,
  params: ParamsStabilisation = PARAMS_DEFAUT
): { etat: EtatStabilisation; evenements: EvenementStab[] } {
  const vues = new Map<string, ZoneId | null>(obs.cartes.map((c) => [c.carte, c.zone]));
  const fenetre = [...etat.fenetre, { t: obs.t, vues }].slice(-params.m);
  const presentes = new Map(etat.presentes);
  const evenements: EvenementStab[] = [];

  const cartes = new Set<string>([...presentes.keys()]);
  for (const img of fenetre) for (const c of img.vues.keys()) cartes.add(c);

  for (const carte of [...cartes].sort()) {
    const nbVues = fenetre.filter((img) => img.vues.has(carte)).length;
    const zone = zoneMajoritaire(fenetre, carte);
    if (!presentes.has(carte)) {
      if (nbVues >= params.n) {
        const premiere = fenetre.find((img) => img.vues.has(carte))!;
        presentes.set(carte, zone);
        evenements.push({ type: "validee", carte, zone, horodatage: premiere.t, valideeA: obs.t });
      }
    } else {
      const absences = fenetre.length - nbVues;
      if (absences >= params.absenceN) {
        const zonePrecedente = presentes.get(carte) ?? null;
        presentes.delete(carte);
        evenements.push({ type: "retiree", carte, t: obs.t, zone: zonePrecedente });
      } else if (nbVues >= params.n && zone !== presentes.get(carte)) {
        const de = presentes.get(carte) ?? null;
        presentes.set(carte, zone);
        evenements.push({ type: "deplacee", carte, de, vers: zone, t: obs.t });
      }
    }
  }
  evenements.sort((a, b) => {
    const ta = a.type === "validee" ? a.horodatage : a.t;
    const tb = b.type === "validee" ? b.horodatage : b.t;
    return ta - tb || a.carte.localeCompare(b.carte);
  });
  return { etat: { fenetre, presentes }, evenements };
}
