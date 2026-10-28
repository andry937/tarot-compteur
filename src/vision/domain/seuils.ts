import type { CarteVue } from "./types";

/**
 * Atouts facilement confondus par le modèle (chiffres romains proches).
 * Ils exigent un seuil de confiance plus strict.
 */
const PAIRES_CONFONDUES: ReadonlyArray<readonly [number, number]> = [
  [6, 9],
  [16, 17],
  [17, 18],
  [19, 20],
];

const CONFONDABLES = new Set<string>(PAIRES_CONFONDUES.flatMap(([a, b]) => [`atout-${a}`, `atout-${b}`]));

export interface Seuils {
  /** Confiance minimale d'une carte ordinaire. */
  base: number;
  /** Confiance minimale d'un atout confondable. */
  strict: number;
  /** Au-dessus de ce seuil, un atout confondable est accepté même avec un seul coin vu. */
  strictCoinUnique: number;
}

export const SEUILS_DEFAUT: Seuils = { base: 0.5, strict: 0.8, strictCoinUnique: 0.9 };

export function estConfondable(carte: string): boolean {
  return CONFONDABLES.has(carte);
}

/**
 * Une carte vue est retenue si sa confiance dépasse le seuil de sa classe ; un
 * atout confondable doit en plus avoir ses deux coins d'accord (ou une confiance
 * très élevée avec un seul coin).
 */
export function accepte(vue: CarteVue, seuils: Seuils = SEUILS_DEFAUT): boolean {
  if (!estConfondable(vue.carte)) return vue.confiance >= seuils.base;
  if (vue.confiance < seuils.strict) return false;
  return vue.nbCoins >= 2 || vue.confiance >= seuils.strictCoinUnique;
}
