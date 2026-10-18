/**
 * Carnet des cartes jouées : identifiants de cartes et déduction des plis.
 * Aucune dépendance React : testable isolément.
 *
 * On ne stocke qu'une liste plate ordonnée de cartes (dans l'ordre de jeu) ;
 * qui a posé chaque carte, qui remporte chaque pli et qui entame le suivant
 * se déduisent à l'affichage — pas d'agrégat stocké, annuler = retirer la
 * dernière carte.
 * @module
 */

import { NOM_ROI, ROMAINS } from "@/domain/score/regles";
import type { Roi, Donne, Bout, PetitAuBout } from "@/domain/score/regles";

/** Les quatre couleurs, dans l'ordre d'affichage (♥ ♦ ♣ ♠). */
export const COULEURS: Roi[] = ["coeur", "carreau", "trefle", "pique"];

/** Symbole affiché pour chaque couleur. */
export const SYMBOLE_COULEUR: Record<Roi, string> = {
  coeur: "♥",
  carreau: "♦",
  trefle: "♣",
  pique: "♠",
};

const RANGS_COULEUR = ["As", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Valet", "Cavalier", "Dame", "Roi"];

/** Identifiants : "atout-1".."atout-21", "excuse", "coeur-1".."coeur-14" (idem autres couleurs ; 11 Valet … 14 Roi). */
export const EXCUSE = "excuse";
/** Identifiant de l'atout `n` (1 à 21). */
export const idAtout = (n: number): string => `atout-${n}`;
/** Identifiant d'une carte de couleur (rang 1 à 14, 11 = Valet … 14 = Roi). */
export const idCouleur = (c: Roi, rang: number): string => `${c}-${rang}`;

/** Les 78 identifiants de cartes : 21 atouts, l'Excuse et 4 × 14 cartes de couleur. */
export function toutesLesCartes(): string[] {
  return [
    ...Array.from({ length: 21 }, (_, i) => idAtout(i + 1)),
    EXCUSE,
    ...COULEURS.flatMap((c) => Array.from({ length: 14 }, (_, i) => idCouleur(c, i + 1))),
  ];
}

interface CarteDecodee {
  famille: "atout" | "excuse" | Roi;
  rang: number;
}

/** Décompose un identifiant de carte en famille (atout, excuse ou couleur) et rang. */
export function decoder(id: string): CarteDecodee {
  if (id === EXCUSE) return { famille: "excuse", rang: 0 };
  const [famille, rang] = id.split("-");
  return { famille: famille as CarteDecodee["famille"], rang: Number(rang) };
}

/** `true` pour un bout : le Petit, le 21 ou l'Excuse. */
export function estBout(id: string): boolean {
  return id === EXCUSE || id === idAtout(1) || id === idAtout(21);
}

/** Libellé complet d'une carte (« Dame de pique », « XIV », « L'Excuse »). */
export function libelleCarte(id: string): string {
  const c = decoder(id);
  if (c.famille === "excuse") return "L'Excuse";
  if (c.famille === "atout") return ROMAINS[c.rang];
  return `${RANGS_COULEUR[c.rang - 1]} de ${NOM_ROI[c.famille].toLowerCase()}`;
}

/** Libellé court affiché sur une touche : rang + symbole de la couleur, chiffre romain pour un atout. */
export function libelleCourt(id: string): string {
  const c = decoder(id);
  if (c.famille === "excuse") return "Exc.";
  if (c.famille === "atout") return ROMAINS[c.rang];
  const r = c.rang <= 10 ? String(c.rang) : ["V", "C", "D", "R"][c.rang - 11];
  return `${c.rang === 1 ? "A" : r}${SYMBOLE_COULEUR[c.famille]}`;
}

/** Taille du chien : 3 cartes à 5 joueurs, 6 à 3 ou 4. */
export function tailleChien(nbJoueurs: number): number {
  return nbJoueurs >= 5 ? 3 : 6;
}

/** Nombre de plis d'une main : (78 − chien) / joueurs à table — 15 à 5, 18 à 4, 24 à 3. */
export function nbPlis(nbJoueurs: number): number {
  return (78 - tailleChien(nbJoueurs)) / nbJoueurs;
}

/** Index (dans le pli) de la carte gagnante : le plus fort atout, sinon la plus forte carte de la couleur d'entame ; l'Excuse ne gagne jamais. */
export function gagnantDuPli(cartes: string[]): number {
  const dec = cartes.map(decoder);
  let meilleur = -1;
  const atouts = dec.map((c, i) => (c.famille === "atout" ? i : -1)).filter((i) => i >= 0);
  if (atouts.length) {
    meilleur = atouts.reduce((a, b) => (dec[b].rang > dec[a].rang ? b : a));
    return meilleur;
  }
  // Couleur d'entame = celle de la première carte qui n'est pas l'Excuse.
  const entame = dec.find((c) => c.famille !== "excuse");
  if (!entame) return 0;
  const memeCouleur = dec.map((c, i) => (c.famille === entame.famille ? i : -1)).filter((i) => i >= 0);
  return memeCouleur.reduce((a, b) => (dec[b].rang > dec[a].rang ? b : a));
}

/** Un pli reconstitué à partir de la liste ordonnée des cartes. */
export interface PliDeduit {
  /** Joueurs (index de siège) dans l'ordre où ils ont joué. */
  joueurs: number[];
  /** Cartes posées dans le pli, dans l'ordre de jeu. */
  cartes: string[];
  /** Siège gagnant, ou null tant que le pli n'est pas complet. */
  gagnant: number | null;
}

/** Résultat de `deriverPlis`. */
export interface PlisDeduits {
  /** Plis reconstitués, dans l'ordre de jeu (le dernier peut être incomplet). */
  plis: PliDeduit[];
  /** Prochain joueur à poser une carte, ou null si la main est terminée. */
  prochainJoueur: number | null;
  /** `true` quand tous les plis de la main sont notés. */
  termine: boolean;
}

/**
 * Déduit les plis d'une liste ordonnée de cartes. `table` = sièges à table
 * dans l'ordre de jeu (le donneur en premier, comme `tableDeLaDonne`),
 * `entame` = siège qui entame le premier pli ; ensuite, le gagnant entame.
 */
export function deriverPlis(table: number[], entame: number, cartes: string[]): PlisDeduits {
  const n = table.length;
  const total = nbPlis(n);
  const plis: PliDeduit[] = [];
  let premier = entame;
  for (let k = 0; k < total && k * n < cartes.length; k++) {
    const du = cartes.slice(k * n, k * n + n);
    const depart = table.indexOf(premier);
    const joueurs = du.map((_, j) => table[(depart + j) % n]);
    const complet = du.length === n;
    const gagnant = complet ? joueurs[gagnantDuPli(du)] : null;
    plis.push({ joueurs, cartes: du, gagnant });
    if (gagnant !== null) premier = gagnant;
  }
  const termine = cartes.length >= total * n;
  const dernier = plis[plis.length - 1];
  let prochainJoueur: number | null;
  if (termine) prochainJoueur = null;
  else if (!dernier || dernier.gagnant !== null) prochainJoueur = premier;
  else prochainJoueur = table[(table.indexOf(dernier.joueurs[0]) + dernier.cartes.length) % n];
  return { plis, prochainJoueur, termine };
}

/** Siège qui a entamé la main d'une donne inscrite : le joueur après le donneur. */
export function entameDeLaDonne(d: Donne): number {
  const t = d.table;
  return t.length > 1 ? t[(t.indexOf(d.donneur ?? t[0]) + 1) % t.length] : t[0];
}

/** Valeur en points d'une carte (total du jeu : 91) : bouts et rois 4,5 ; dame 3,5 ; cavalier 2,5 ; valet 1,5 ; le reste 0,5. */
export function valeurCarte(id: string): number {
  if (estBout(id)) return 4.5;
  const c = decoder(id);
  if (c.famille === "atout") return 0.5;
  return ({ 14: 4.5, 13: 3.5, 12: 2.5, 11: 1.5 } as Record<number, number>)[c.rang] ?? 0.5;
}

/** Ce que l'attaque a marqué, déduit des cartes notées. */
export interface DeductionAttaque {
  /** Points de l'attaque (écart du preneur compris quand la main est complète). */
  points: number;
  /** Nombre de bouts de l'attaque. */
  bouts: 0 | 1 | 2 | 3;
  /** Bouts précis remportés par l'attaque. */
  boutsPrecis: Bout[];
  /** Camp qui a remporté le dernier pli avec le Petit, ou `aucun`. */
  petitAuBout: PetitAuBout;
  /** L'attaque a remporté tous les plis. */
  chelem: boolean;
  /** Tous les plis sont notés : le total est alors exact (hors approximation de l'Excuse). */
  complet: boolean;
  /** L'Excuse a été jouée : le total est alors approximatif (échange d'une carte à 0,5 point ignoré). */
  excuseJouee: boolean;
}

const BOUT_DE_CARTE: Record<string, Bout> = { "atout-1": "petit", "atout-21": "21", [EXCUSE]: "excuse" };

/**
 * Déduit ce que l'attaque a marqué d'après les cartes notées (jamais stocké : voir `Saisie.tsx`).
 * Un pli revient au camp de son gagnant ; l'Excuse reste au camp du joueur qui l'a jouée ;
 * quand la main est complète, les cartes jamais jouées forment l'écart du preneur (attaque),
 * sauf en Garde contre où le chien va à la défense. Simplification : l'Excuse vaut 4,5 sans
 * l'échange d'une carte à 0,5 point. `null` si aucune carte n'est notée.
 */
export function deduireAttaque(args: {
  table: number[];
  entame: number;
  cartes: string[];
  preneur: number;
  appele: number | null;
  contrat: string;
}): DeductionAttaque | null {
  const { table, entame, cartes, preneur, appele, contrat } = args;
  if (cartes.length === 0) return null;
  const attaque = new Set<number>([preneur]);
  if (appele !== null) attaque.add(appele);
  const { plis, termine } = deriverPlis(table, entame, cartes);

  let points = 0;
  let petitAuBout: PetitAuBout = "aucun";
  let excuseJouee = false;
  const bouts = new Set<Bout>();
  const prendre = (carte: string) => {
    points += valeurCarte(carte);
    const b = BOUT_DE_CARTE[carte];
    if (b) bouts.add(b);
  };

  plis.forEach((p, k) => {
    if (p.gagnant === null) return; // pli en cours : pas encore attribué
    const gagnantAttaque = attaque.has(p.gagnant);
    const idxGagnante = gagnantDuPli(p.cartes);
    p.cartes.forEach((c, j) => {
      if (c === EXCUSE) {
        excuseJouee = true;
        if (attaque.has(p.joueurs[j])) prendre(c);
      } else if (gagnantAttaque) prendre(c);
    });
    if (k === nbPlis(table.length) - 1 && p.cartes[idxGagnante] === idAtout(1)) {
      petitAuBout = gagnantAttaque ? "attaque" : "defense";
    }
  });

  const tousLesPlis = plis.length > 0 && plis.every((p) => p.gagnant !== null) && termine;
  if (tousLesPlis && contrat !== "garde_contre") {
    // Cartes jamais jouées = écart du preneur, qui compte pour l'attaque.
    const jouees = new Set(cartes);
    toutesLesCartes().filter((c) => !jouees.has(c)).forEach(prendre);
  }

  const chelem = tousLesPlis && plis.every((p) => attaque.has(p.gagnant as number));
  const nb = Math.min(3, bouts.size) as 0 | 1 | 2 | 3;
  return {
    points: Math.round(points * 2) / 2,
    bouts: nb,
    boutsPrecis: (["petit", "21", "excuse"] as Bout[]).filter((b) => bouts.has(b)),
    petitAuBout,
    chelem,
    complet: tousLesPlis,
    excuseJouee,
  };
}

/** Tri d'affichage d'une main : atouts décroissants, Excuse, puis ♥ ♦ ♣ ♠ du plus fort au plus faible. */
export function trierCartes(cartes: string[]): string[] {
  const ordre = (id: string): number => {
    const c = decoder(id);
    if (c.famille === "atout") return 100 - c.rang;
    if (c.famille === "excuse") return 200;
    return 300 + COULEURS.indexOf(c.famille) * 20 + (15 - c.rang);
  };
  return [...cartes].sort((a, b) => ordre(a) - ordre(b));
}

/** Main reconstituée d'un joueur. */
export interface MainDeduite {
  /** Siège du joueur. */
  joueur: number;
  /** Cartes qu'il a posées (sa main après écart), triées. */
  cartes: string[];
  /** Nombre de cartes attendues si tous les plis sont notés (15 à 5 joueurs…). */
  attendues: number;
}

/** Mains reconstituées de tous les joueurs d'une donne, par `deduireMains`. */
export interface MainsDeduites {
  /** Une main par joueur, dans l'ordre de la table. */
  mains: MainDeduite[];
  /** Tous les plis sont notés : les mains sont alors complètes. */
  complete: boolean;
  /** Cartes jamais jouées = écart du preneur (Petite/Garde, main complète) ; `null` sinon. */
  ecart: string[] | null;
  /** Garde sans/contre : le chien n'est pas pris, les cartes jamais jouées sont ce chien non vu ; `null` sinon. */
  chienNonVu: string[] | null;
  /** Main du preneur avant de prendre le chien (jouées + écart − chien) ; `null` si le chien n'est pas noté ou la main incomplète. */
  departPreneur: string[] | null;
  /** Incohérences détectées dans la saisie (carte en double, chien absent de la main…), à signaler sans bloquer. */
  anomalies: string[];
}

/**
 * Reconstitue la main de chaque joueur d'après les cartes posées : une main = les cartes qu'il a jouées
 * (l'Excuse reste à celui qui l'a posée). Quand tous les plis sont notés, les cartes jamais jouées sont
 * l'écart du preneur, ce qui permet — si le chien est noté — de retrouver sa main de départ.
 * `null` si aucune carte n'est notée. Ne lève jamais : les incohérences sont listées dans `anomalies`.
 */
export function deduireMains(args: {
  table: number[];
  entame: number;
  cartes: string[];
  preneur: number;
  chien?: string[];
  contrat: string;
}): MainsDeduites | null {
  const { table, entame, cartes, preneur, chien = [], contrat } = args;
  if (cartes.length === 0) return null;
  const n = table.length;
  const attendues = nbPlis(n);
  const { plis, termine } = deriverPlis(table, entame, cartes);
  const anomalies: string[] = [];

  const doublons = cartes.filter((c, i) => cartes.indexOf(c) !== i);
  if (doublons.length) anomalies.push(`Carte notée plusieurs fois : ${[...new Set(doublons)].map(libelleCarte).join(", ")}.`);

  const parJoueur = new Map<number, string[]>(table.map((j) => [j, []]));
  plis.forEach((p) => p.cartes.forEach((c, j) => parJoueur.get(p.joueurs[j])?.push(c)));
  const mains = table.map((joueur) => ({ joueur, cartes: trierCartes(parJoueur.get(joueur) ?? []), attendues }));
  const complete = termine && plis.every((p) => p.gagnant !== null);

  let ecart: string[] | null = null;
  let chienNonVu: string[] | null = null;
  let departPreneur: string[] | null = null;
  if (complete) {
    const jouees = new Set(cartes);
    const jamais = trierCartes(toutesLesCartes().filter((c) => !jouees.has(c)));
    if (jamais.length !== tailleChien(n)) {
      anomalies.push(`${jamais.length} carte(s) jamais jouée(s) au lieu de ${tailleChien(n)} : vérifiez la saisie.`);
    }
    if (contrat === "garde_sans" || contrat === "garde_contre") {
      chienNonVu = jamais;
    } else {
      ecart = jamais;
      if (chien.length > 0) {
        const dansMain = new Set([...(parJoueur.get(preneur) ?? []), ...jamais]);
        const absentes = chien.filter((c) => !dansMain.has(c));
        if (absentes.length) {
          anomalies.push(`Chien absent de la main du preneur : ${absentes.map(libelleCarte).join(", ")}.`);
        } else {
          const retire = new Set(chien);
          departPreneur = trierCartes([...dansMain].filter((c) => !retire.has(c)));
        }
      }
    }
  }
  return { mains, complete, ecart, chienNonVu, departPreneur, anomalies };
}
