/**
 * Règles du tarot à la française et moteur de score.
 * Aucune dépendance React : ces fonctions sont testables isolément.
 */

export interface Contrat {
  id: string;
  nom: string;
  mult: number;
}

export interface Poignee {
  id: string;
  nom: string;
  val: number;
}

export interface Chelem {
  id: string;
  nom: string;
  val: number;
}

export type PetitAuBout = "aucun" | "attaque" | "defense";

export interface Misere {
  id: string;
  joueur: number;
  type: "atout" | "tete";
  aTort: boolean;
}

export interface Donne {
  table: number[];
  donneur?: number;
  preneur: number;
  appele: number | null;
  contrat: string;
  bouts: 0 | 1 | 2 | 3;
  points: number;
  petitAuBout: PetitAuBout;
  poignee: string;
  chelem: string;
  miseres: Misere[];
}

export interface ResultatDonne {
  base: number;
  scores: (number | null)[];
  reussi: boolean;
  ecart: number;
  seuil: number;
  mult: number;
  avecAppele: boolean;
  table: number[];
  defenseurs: number[];
}

export interface ResumeDonnees {
  totaux: number[];
  jouees: number[];
  cumuls: number[][];
}

export const CONTRATS: Contrat[] = [
  { id: "petite", nom: "Petite", mult: 1 },
  { id: "garde", nom: "Garde", mult: 2 },
  { id: "garde_sans", nom: "Garde sans", mult: 4 },
  { id: "garde_contre", nom: "Garde contre", mult: 6 },
];

export const SEUILS: Record<number, number> = { 0: 56, 1: 51, 2: 41, 3: 36 };

export const POIGNEES: Poignee[] = [
  { id: "aucune", nom: "Aucune", val: 0 },
  { id: "simple", nom: "Simple", val: 20 },
  { id: "double", nom: "Double", val: 30 },
  { id: "triple", nom: "Triple", val: 40 },
];

export const CHELEMS: Chelem[] = [
  { id: "aucun", nom: "Aucun", val: 0 },
  { id: "non_annonce", nom: "Réussi, non annoncé", val: 200 },
  { id: "annonce_reussi", nom: "Annoncé et réussi", val: 400 },
  { id: "annonce_chute", nom: "Annoncé et chuté", val: -200 },
];

/** Qui est à la table pour la donne n° k : le donneur ouvre, la table tourne d'un cran. */
export function tableDeLaDonne(k: number, total: number, parDonne: number, depart = 0): number[] {
  const n = Math.min(parDonne, total);
  return Array.from({ length: n }, (_, i) => (depart + k + i) % total);
}

/* Tirage au sort : 21 atouts + l'Excuse, la carte la plus faible distribue. */
export const ROMAINS = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI",
];

export type Atout = number | "excuse";

export function melangerAtouts(): Atout[] {
  const jeu: Atout[] = [...Array.from({ length: 21 }, (_, i) => i + 1), "excuse"];
  for (let i = jeu.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [jeu[i], jeu[j]] = [jeu[j], jeu[i]];
  }
  return jeu;
}

export const nomAtout = (v: number): string => (v === 1 ? "Le Petit" : v === 21 ? "Le 21" : "Atout");

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
  const poignee = POIGNEES.find((p) => p.id === d.poignee)!.val;
  const chelem = CHELEMS.find((c) => c.id === d.chelem)!.val;

  const base = signe * (25 + ecart) * mult + pab * 10 * mult + signe * poignee + chelem;

  const avecAppele =
    n === 5 && d.appele !== null && d.appele !== undefined && d.appele !== d.preneur;

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
