/**
 * Règles du tarot à la française et moteur de score.
 * Aucune dépendance React : ces fonctions sont testables isolément.
 * @module
 */

/** Contrat d'enchère et son multiplicateur de score. */
export interface Contrat {
  /** Identifiant technique (`petite`, `garde`, `garde_sans`, `garde_contre`). */
  id: string;
  /** Nom affiché. */
  nom: string;
  /** Multiplicateur appliqué au score de base. */
  mult: number;
}

/** Taille de poignée et sa valeur en points. */
export interface Poignee {
  /** Identifiant technique (`simple`, `double`, `triple`). */
  id: string;
  /** Nom affiché. */
  nom: string;
  /** Points rapportés au camp du joueur qui la montre. */
  val: number;
}

/** Une poignée réellement déclarée pendant une donne : nominative (le joueur qui
 * l'a montrée) — plusieurs joueurs peuvent chacun en montrer une dans la même donne. */
export interface PoigneeDeclaree {
  /** Identifiant unique de la déclaration dans la donne. */
  id: string;
  /** Siège du joueur qui a montré la poignée. */
  joueur: number;
  /** Identifiant de la taille de poignée (voir `POIGNEES`). */
  taille: string;
}

/** Cas de chelem et sa valeur en points. */
export interface Chelem {
  /** Identifiant technique (`aucun`, `non_annonce`, `annonce_reussi`, `annonce_chute`). */
  id: string;
  /** Nom affiché. */
  nom: string;
  /** Points ajoutés au score de base (négatif si le chelem annoncé chute). */
  val: number;
}

/** Camp qui a réalisé le petit au bout (Petit gagnant du dernier pli), ou `aucun`. */
export type PetitAuBout = "aucun" | "attaque" | "defense";

/** Couleur d'un roi, donc de l'appel à 5 joueurs. */
export type Roi = "coeur" | "carreau" | "trefle" | "pique";

/** Libellé affiché de chaque couleur de roi. */
export const NOM_ROI: Record<Roi, string> = {
  coeur: "Cœur",
  carreau: "Carreau",
  trefle: "Trèfle",
  pique: "Pique",
};

/** Un bout précis (Petit, 21 ou Excuse) — distinct du simple compte
 * `Donne.bouts` (0-3), qui ne dit pas lesquels l'attaque détenait. */
export type Bout = "petit" | "21" | "excuse";

/** Libellé affiché de chaque bout. */
export const NOM_BOUT: Record<Bout, string> = {
  petit: "Le Petit",
  "21": "Le 21",
  excuse: "L'Excuse",
};

/** Misère annoncée par un joueur (règle Tarot-Bière) : chaque autre joueur à table lui paie 10 points. */
export interface Misere {
  /** Identifiant unique de la déclaration dans la donne. */
  id: string;
  /** Siège du joueur en misère. */
  joueur: number;
  /** `atout` (aucun atout) ou `tete` (aucun honneur). */
  type: "atout" | "tete";
  /** `true` si la misère a été annoncée à tort : le paiement s'inverse. */
  aTort: boolean;
}

/**
 * Une donne inscrite : tout ce qui est saisi, dont `calculer()` déduit le score. Les champs optionnels sont absents des donnes archivées avant leur introduction.
 */
export interface Donne {
  /** Sièges à table pour cette donne, dans l'ordre de jeu (le donneur en premier). */
  table: number[];
  /** Siège du donneur. */
  donneur?: number;
  /** Siège du preneur. */
  preneur: number;
  /** Siège de l'appelé à 5 joueurs ; `null` si le preneur joue seul. */
  appele: number | null;
  /** Identifiant du contrat (voir `CONTRATS`). */
  contrat: string;
  /** Nombre de bouts de l'attaque (0 à 3) : détermine le seuil à atteindre. */
  bouts: 0 | 1 | 2 | 3;
  /** Lesquels précisément, parmi les `bouts` détenus par l'attaque (obtenus
   * dans le chien ou capturés en jouant) — absent sur les donnes archivées
   * avant l'introduction de ce champ. N'intervient pas dans `calculer()` :
   * purement informatif, pour les statistiques. */
  boutsPrecis?: Bout[];
  /** Points réalisés par l'attaque, sur 91. */
  points: number;
  /** Camp qui a réalisé le petit au bout. */
  petitAuBout: PetitAuBout;
  /** @deprecated ancien champ (poignée unique, non nominative) — conservé en lecture
   * pour les donnes archivées avant l'introduction de `poignees`. */
  poignee?: string;
  /** Poignées déclarées, une par joueur qui en a montré une. */
  poignees?: PoigneeDeclaree[];
  /** Identifiant du cas de chelem (voir `CHELEMS`). */
  chelem: string;
  /** Misères annoncées pendant la donne. */
  miseres: Misere[];
  /** Couleur du roi appelé, obligatoire à 5 joueurs. */
  roiAppele?: Roi;
  /** Cartes jouées pendant la main, dans l'ordre de jeu (identifiants de `utils/cartes.ts`).
   * Purement informatif — n'intervient pas dans `calculer()`. */
  cartesJouees?: string[];
  /** Cartes retournées au chien (Petite ou Garde), identifiants de `utils/cartes.ts`. Informatif. */
  chien?: string[];
}

/** Résultat calculé d'une donne par `calculer()`. */
export interface ResultatDonne {
  /** Score de base signé, avant répartition entre les joueurs. */
  base: number;
  /** Score de chaque joueur de la partie ; `null` pour un joueur au repos. */
  scores: (number | null)[];
  /** `true` si l'attaque a atteint son seuil. */
  reussi: boolean;
  /** Écart (en points entiers) entre les points réalisés et le seuil. */
  ecart: number;
  /** Points à atteindre selon le nombre de bouts. */
  seuil: number;
  /** Multiplicateur du contrat. */
  mult: number;
  /** `true` si un appelé distinct du preneur joue (5 joueurs à table). */
  avecAppele: boolean;
  /** Sièges à table pour cette donne. */
  table: number[];
  /** Sièges de la défense. */
  defenseurs: number[];
}

/** Totaux et cumuls d'une série de donnes, par `resumerDonnees()`. */
export interface ResumeDonnees {
  /** Total de points de chaque joueur. */
  totaux: number[];
  /** Nombre de donnes jouées par chaque joueur (hors repos). */
  jouees: number[];
  /** Totaux cumulés après chaque donne, une ligne par donne. */
  cumuls: number[][];
}

/** Contrats d'enchère : Petite ×1, Garde ×2, Garde sans ×4, Garde contre ×6. */
export const CONTRATS: Contrat[] = [
  { id: "petite", nom: "Petite", mult: 1 },
  { id: "garde", nom: "Garde", mult: 2 },
  { id: "garde_sans", nom: "Garde sans", mult: 4 },
  { id: "garde_contre", nom: "Garde contre", mult: 6 },
];

/** Points à atteindre par l'attaque selon son nombre de bouts : 0→56, 1→51, 2→41, 3→36. */
export const SEUILS: Record<number, number> = { 0: 56, 1: 51, 2: 41, 3: 36 };

/** Tailles de poignée : simple 20, double 30, triple 40 points. */
export const POIGNEES: Poignee[] = [
  { id: "simple", nom: "Simple", val: 20 },
  { id: "double", nom: "Double", val: 30 },
  { id: "triple", nom: "Triple", val: 40 },
];

/** Cas de chelem : aucun, réussi non annoncé (200), annoncé et réussi (400), annoncé et chuté (−200). */
export const CHELEMS: Chelem[] = [
  { id: "aucun", nom: "Aucun", val: 0 },
  { id: "non_annonce", nom: "Réussi, non annoncé", val: 200 },
  { id: "annonce_reussi", nom: "Annoncé et réussi", val: 400 },
  { id: "annonce_chute", nom: "Annoncé et chuté", val: -200 },
];

/**
 * Qui est à la table pour la donne n° k : le donneur ouvre (il joue toujours),
 * le donneur avance d'un siège à chaque donne.
 *
 * Quand il y a des joueurs au repos, ils sont répartis régulièrement autour de
 * la table plutôt que regroupés : chacun joue et se repose en alternance, au
 * lieu d'attendre plusieurs donnes d'affilée (un seul joueur au repos : c'est celui
 * qui précède le donneur). Si trop peu de joueurs jouent
 * (moins de la moitié de la table), des repos consécutifs sont inévitables et on
 * retombe sur la table contiguë. Les joueurs sont rendus dans l'ordre de jeu.
 */
export function tableDeLaDonne(k: number, total: number, parDonne: number, depart = 0): number[] {
  const n = Math.min(parDonne, total);
  const repos = total - n;
  const donneur = (depart + k) % total;
  if (repos <= 1 || total < 2 * repos) {
    return Array.from({ length: n }, (_, i) => (donneur + i) % total);
  }
  // Décalages (par rapport au donneur) des joueurs au repos, régulièrement espacés,
  // jamais voisins ni égaux à 0.
  const auRepos = new Set(
    Array.from({ length: repos }, (_, j) => Math.floor(((j + 0.5) * total) / repos))
  );
  const table: number[] = [];
  for (let o = 0; o < total; o++) if (!auRepos.has(o)) table.push((donneur + o) % total);
  return table;
}

/** Chiffres romains des atouts, indexés par leur rang (1 à 21). */
export const ROMAINS = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI",
];

/**
 * Calcule le score d'une donne.
 *
 * Score de base = (25 + écart) × contrat, plus petit au bout, poignées (qui reviennent au camp du joueur qui les montre, quel que soit le résultat du contrat) et chelem. Le preneur reçoit autant de parts qu'il y a de défenseurs ; à 5 joueurs avec appelé, le preneur en prend 2 et l'appelé 1. Les misères se règlent à part (10 points payés par chaque autre joueur).
 * @param d - Donne à calculer.
 * @param nbTotal - Nombre de joueurs de la partie, au repos compris.
 */
export function calculer(d: Donne, nbTotal: number): ResultatDonne {
  const table = d.table && d.table.length ? d.table : Array.from({ length: nbTotal }, (_, i) => i);
  const n = table.length;
  const seuil = SEUILS[d.bouts];
  const brut = d.points - seuil;
  const reussi = brut >= 0;
  const ecart = Math.ceil(Math.abs(brut) - 1e-9);
  const mult = CONTRATS.find((c) => c.id === d.contrat)!.mult;
  const signe = reussi ? 1 : -1;
  const pab = d.petitAuBout === "attaque" ? 1 : d.petitAuBout === "defense" ? -1 : 0;
  const chelem = CHELEMS.find((c) => c.id === d.chelem)!.val;

  const avecAppele =
    n === 5 && d.appele !== null && d.appele !== undefined && d.appele !== d.preneur;

  // Poignée(s) : chaque camp qui en réalise une empoche sa valeur, qu'il y ait
  // réussite ou chute du contrat — indépendant du signe du contrat (contrairement
  // au petit au bout, qui lui reste rattaché au camp qui l'a réalisé de la même
  // façon). Plusieurs joueurs, y compris de camps différents, peuvent chacun en
  // déclarer une dans la même donne.
  let poigneeTotal = 0;
  if (d.poignees) {
    d.poignees.forEach((p) => {
      const val = POIGNEES.find((x) => x.id === p.taille)?.val ?? 0;
      const campAttaque = p.joueur === d.preneur || (avecAppele && p.joueur === d.appele);
      poigneeTotal += (campAttaque ? 1 : -1) * val;
    });
  } else if (d.poignee && d.poignee !== "aucune") {
    // Archive antérieure à la poignée nominative : aucun joueur connu, on
    // reproduit l'ancien calcul (suivait le signe du contrat).
    poigneeTotal = signe * (POIGNEES.find((x) => x.id === d.poignee)?.val ?? 0);
  }

  const base = signe * (25 + ecart) * mult + pab * 10 * mult + poigneeTotal + chelem;

  const scores: (number | null)[] = new Array(nbTotal).fill(null); // null = au repos
  table.forEach((i) => (scores[i] = -base));
  if (avecAppele) {
    scores[d.preneur] = 2 * base;
    scores[d.appele as number] = base;
  } else {
    scores[d.preneur] = (n - 1) * base;
  }

  const defenseurs = table.filter(
    (i) => i !== d.preneur && !(avecAppele && i === d.appele)
  );

  // Misère : chaque autre joueur à table paie 10 points au joueur en misère
  // (ou l'inverse si la misère est annoncée à tort). Indépendant du contrat.
  (d.miseres || []).forEach((m) => {
    if (!table.includes(m.joueur)) return;
    const signeM = m.aTort ? -1 : 1;
    table.forEach((i) => {
      scores[i] = (scores[i] as number) + (i === m.joueur ? signeM * 10 * (n - 1) : -signeM * 10);
    });
  });

  return { base, scores, reussi, ecart, seuil, mult, avecAppele, table, defenseurs };
}

/** Totaux, nombre de donnes jouées et cumul donne par donne, pour une série. */
export function resumerDonnees(donnes: Donne[], nbTotal: number): ResumeDonnees {
  const t = new Array(nbTotal).fill(0);
  const j = new Array(nbTotal).fill(0);
  const c: number[][] = [];
  donnes.forEach((d) => {
    calculer(d, nbTotal).scores.forEach((s, i) => {
      if (s !== null) {
        t[i] += s;
        j[i] += 1;
      }
    });
    c.push([...t]);
  });
  return { totaux: t, jouees: j, cumuls: c };
}

/** Formate un score avec un signe + explicite pour les valeurs positives. */
export function fmt(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}
