/**
 * Statistiques par joueur, calculées à la volée à partir des parties
 * archivées (pas d'agrégat stocké). Aucune dépendance React : testable
 * isolément, comme regles.ts et identite.ts.
 * @module
 */
import { calculer } from "@/domain/score/regles";
import type { Bout, Donne, ResultatDonne, Roi } from "@/domain/score/regles";

/** Rôle d'un joueur sur une donne. */
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

/** Partie archivée chargée pour l'analyse (stats, classement). */
export interface PartieAnalysee {
  /** Identifiant de l'archive. */
  archiveId: string;
  /** Date de clôture, au format ISO. */
  date: string;
  /** Identifiants des joueurs, dans l'ordre des sièges. */
  joueursId: string[];
  /** Donnes de la partie. */
  donnes: Donne[];
}

/** Donnes jouées et gagnées dans un rôle. */
export interface StatsRole {
  /** Nombre de donnes jouées dans ce rôle. */
  donnes: number;
  /** Nombre de victoires (côté défense : contrat de l'attaque chuté). */
  victoires: number;
}

/** Nombre de fois qu'un roi a été appelé par le joueur. */
export interface StatsRoi {
  /** Couleur du roi. */
  roi: Roi;
  /** Nombre d'appels. */
  fois: number;
}

/** Renvoi vers une donne précise d'une archive. */
export interface DonneReference {
  /** Identifiant de l'archive. */
  archiveId: string;
  /** Date de l'archive. */
  date: string;
  /** Position de la donne dans la partie (à partir de 0). */
  indexDonne: number;
  /** Points marqués par le joueur sur cette donne. */
  points: number;
}

/** Une donne prise par le joueur en tant que preneur, avec son issue. */
export interface AppelPreneur {
  /** Identifiant de l'archive. */
  archiveId: string;
  /** Date de l'archive. */
  date: string;
  /** Position de la donne dans la partie (à partir de 0). */
  indexDonne: number;
  /** Identifiant du contrat annoncé. */
  contrat: string;
  /** Nombre de bouts de l'attaque. */
  bouts: 0 | 1 | 2 | 3;
  /** Bouts précis détenus, si connus (vide pour les donnes anciennes). */
  boutsPrecis: Bout[];
  /** Points bruts réalisés par l'attaque sur cette donne (sur 91) — pas le
   * score signé (`resultat.scores[idx]`, déjà utilisé ailleurs dans ce
   * fichier pour les totaux) : c'est bien `d.points` qu'il faut lire ici. */
  points: number;
  /** `true` si le contrat a été réussi. */
  reussi: boolean;
}

/** Résumé d'une partie jouée par le joueur. */
export interface PartieResume {
  /** Identifiant de l'archive. */
  archiveId: string;
  /** Date de l'archive. */
  date: string;
  /** Points marqués par le joueur sur la partie. */
  points: number;
  /** Nombre de donnes de la partie. */
  nbDonnes: number;
}

/** Un point de la trajectoire personnelle du joueur : axe dense (uniquement
 * les donnes qu'il a réellement jouées, toutes parties confondues, dans
 * l'ordre chronologique), cumul de points après cette donne. */
export interface PointTrajectoire {
  /** Numéro de la donne sur l'axe personnel (à partir de 1). */
  index: number;
  /** Points cumulés du joueur après cette donne. */
  cumul: number;
}

/** Statistiques cumulées d'un joueur sur toutes les parties chargées. */
export interface StatsJoueur {
  /** Nombre de parties où il a joué au moins une donne. */
  partiesJouees: number;
  /** Nombre de donnes jouées (hors repos). */
  donneesJouees: number;
  /** Total de points marqués. */
  pointsTotaux: number;
  /** Détail par rôle (preneur, appelé, défense). */
  parRole: Record<Role, StatsRole>;
  /** Donnes prises comme preneur et réussies. */
  appelsReussis: AppelPreneur[];
  /** Donnes prises comme preneur et chutées. */
  appelsEchoues: AppelPreneur[];
  /** Rois qu'il a appelés, du plus fréquent au moins fréquent. */
  roisAppelesParLui: StatsRoi[];
  /** Nombre de fois où un autre preneur l'a appelé. */
  foisAppele: number;
  /** Donne où il a marqué le plus, ou `null`. */
  meilleureDonne: DonneReference | null;
  /** Donne où il a marqué le moins, ou `null`. */
  pireDonne: DonneReference | null;
  /** Parties jouées, dans l'ordre reçu en entrée. */
  parties: PartieResume[];
  /** Points cumulés donne après donne, dans l'ordre chronologique. */
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
