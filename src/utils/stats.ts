/**
 * Statistiques par joueur, calculées à la volée à partir des parties
 * archivées (pas d'agrégat stocké). Aucune dépendance React : testable
 * isolément, comme regles.ts et identite.ts.
 */
import { calculer } from "./regles";
import type { Bout, Donne, ResultatDonne, Roi } from "./regles";

export type Role = "preneur" | "appele" | "defense" | "repos";

/** Rôle d'un joueur (par index de siège) sur une donne, à partir du résultat
 *  déjà calculé — réutilise resultat.table/avecAppele, aucune logique
 *  dupliquée avec calculer(). */
export function roleDe(donne: Donne, resultat: ResultatDonne, i: number): Role {
  if (!resultat.table.includes(i)) return "repos";
  if (donne.preneur === i) return "preneur";
  if (resultat.avecAppele && donne.appele === i) return "appele";
  return "defense";
}

export interface PartieAnalysee {
  archiveId: string;
  date: string;
  joueursId: string[];
  donnes: Donne[];
}

export interface StatsRole {
  donnes: number;
  victoires: number;
}

export interface StatsRoi {
  roi: Roi;
  fois: number;
}

export interface DonneReference {
  archiveId: string;
  date: string;
  indexDonne: number;
  points: number;
}

/** Une donne prise par le joueur en tant que preneur, avec son issue. */
export interface AppelPreneur {
  archiveId: string;
  date: string;
  indexDonne: number;
  contrat: string;
  bouts: 0 | 1 | 2 | 3;
  boutsPrecis: Bout[];
  /** Points bruts réalisés par l'attaque sur cette donne (sur 91) — pas le
   * score signé (`resultat.scores[idx]`, déjà utilisé ailleurs dans ce
   * fichier pour les totaux) : c'est bien `d.points` qu'il faut lire ici. */
  points: number;
  reussi: boolean;
}

export interface PartieResume {
  archiveId: string;
  date: string;
  points: number;
  nbDonnes: number;
}

/** Un point de la trajectoire personnelle du joueur : axe dense (uniquement
 * les donnes qu'il a réellement jouées, toutes parties confondues, dans
 * l'ordre chronologique), cumul de points après cette donne. */
export interface PointTrajectoire {
  index: number;
  cumul: number;
}

export interface StatsJoueur {
  partiesJouees: number;
  donneesJouees: number;
  pointsTotaux: number;
  parRole: Record<Role, StatsRole>;
  appelsReussis: AppelPreneur[];
  appelsEchoues: AppelPreneur[];
  roisAppelesParLui: StatsRoi[];
  foisAppele: number;
  meilleureDonne: DonneReference | null;
  pireDonne: DonneReference | null;
  parties: PartieResume[];
  trajectoire: PointTrajectoire[];
}

const roleVide = (): StatsRole => ({ donnes: 0, victoires: 0 });

const trierParFrequence = <K extends string>(compte: Map<K, number>) =>
  [...compte.entries()].sort((a, b) => b[1] - a[1]);

interface DetailJoueur {
  role: Role;
  points: number;
  reussi: boolean;
}

/** Détail d'une donne pour un joueur donné (par index de siège), ou `null`
 * s'il était au repos — centralise le calcul réutilisé par l'agrégation
 * principale et par la trajectoire chronologique. */
function detailPourJoueur(d: Donne, idx: number, nbTotal: number): DetailJoueur | null {
  const resultat = calculer(d, nbTotal);
  const role = roleDe(d, resultat, idx);
  if (role === "repos") return null;
  return { role, points: resultat.scores[idx] as number, reussi: resultat.reussi };
}

/**
 * Calcule les statistiques cumulées d'un joueur (par son identifiant)
 * à travers un ensemble de parties déjà chargées. Une partie où l'id n'est
 * pas trouvé dans joueursId est ignorée silencieusement (ex. partie qui ne
 * concerne pas ce joueur).
 */
export function calculerStatsJoueur(joueurId: string, parties: PartieAnalysee[]): StatsJoueur {
  const parRole: Record<Role, StatsRole> = {
    preneur: roleVide(),
    appele: roleVide(),
    defense: roleVide(),
    repos: roleVide(),
  };
  const appelsReussis: AppelPreneur[] = [];
  const appelsEchoues: AppelPreneur[] = [];
  const roisCompte = new Map<Roi, number>();
  let partiesJouees = 0;
  let donneesJouees = 0;
  let pointsTotaux = 0;
  let foisAppele = 0;
  let meilleureDonne: DonneReference | null = null;
  let pireDonne: DonneReference | null = null;
  const partiesResume: PartieResume[] = [];

  parties.forEach((partie) => {
    const idx = partie.joueursId.indexOf(joueurId);
    if (idx === -1) return;
    const nbTotal = partie.joueursId.length;
    let joueDansCettePartie = false;
    let pointsCettePartie = 0;

    partie.donnes.forEach((d, indexDonne) => {
      const detail = detailPourJoueur(d, idx, nbTotal);
      if (!detail) return;
      const { role, points, reussi } = detail;

      joueDansCettePartie = true;
      donneesJouees += 1;
      pointsTotaux += points;
      pointsCettePartie += points;

      const victoire = role === "defense" ? !reussi : reussi;
      parRole[role].donnes += 1;
      if (victoire) parRole[role].victoires += 1;

      if (role === "preneur") {
        const appel: AppelPreneur = {
          archiveId: partie.archiveId,
          date: partie.date,
          indexDonne,
          contrat: d.contrat,
          bouts: d.bouts,
          boutsPrecis: d.boutsPrecis ?? [],
          points: d.points, // brut, pas `points` (le score signé de la donne)
          reussi,
        };
        (reussi ? appelsReussis : appelsEchoues).push(appel);
        if (d.roiAppele) roisCompte.set(d.roiAppele, (roisCompte.get(d.roiAppele) || 0) + 1);
      }
      if (role === "appele") foisAppele += 1;

      const ref: DonneReference = { archiveId: partie.archiveId, date: partie.date, indexDonne, points };
      if (!meilleureDonne || points > meilleureDonne.points) meilleureDonne = ref;
      if (!pireDonne || points < pireDonne.points) pireDonne = ref;
    });

    if (joueDansCettePartie) {
      partiesJouees += 1;
      partiesResume.push({
        archiveId: partie.archiveId,
        date: partie.date,
        points: pointsCettePartie,
        nbDonnes: partie.donnes.length,
      });
    }
  });

  // Trajectoire : passe séparée, triée chronologiquement (contrairement à
  // `partiesResume` ci-dessus qui garde l'ordre reçu en entrée).
  const partiesTriees = [...parties].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const trajectoire: PointTrajectoire[] = [];
  let cumul = 0;
  partiesTriees.forEach((partie) => {
    const idx = partie.joueursId.indexOf(joueurId);
    if (idx === -1) return;
    const nbTotal = partie.joueursId.length;
    partie.donnes.forEach((d) => {
      const detail = detailPourJoueur(d, idx, nbTotal);
      if (!detail) return;
      cumul += detail.points;
      trajectoire.push({ index: trajectoire.length + 1, cumul });
    });
  });

  return {
    partiesJouees,
    donneesJouees,
    pointsTotaux,
    parRole,
    appelsReussis,
    appelsEchoues,
    roisAppelesParLui: trierParFrequence(roisCompte).map(([roi, fois]) => ({ roi, fois })),
    foisAppele,
    meilleureDonne,
    pireDonne,
    parties: partiesResume,
    trajectoire,
  };
}
