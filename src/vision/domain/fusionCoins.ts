import type { CarteVue, Detection } from "./types";

export interface OptionsFusion {
  /** Facteur appliqué à la confiance d'une carte dont un seul coin est vu. */
  facteurCoinUnique: number;
}

export const OPTIONS_FUSION_DEFAUT: OptionsFusion = { facteurCoinUnique: 0.9 };

/**
 * Fusionne les détections de coins en cartes. Le jeu de tarot est unique : toutes les
 * détections d'une même classe sont les coins d'une même carte (dédoublonnage). Avec
 * deux coins d'accord, la confiance est leur moyenne ; avec un seul, elle est réduite.
 */
export function fusionCoins(
  detections: Detection[],
  options: OptionsFusion = OPTIONS_FUSION_DEFAUT
): CarteVue[] {
  const parClasse = new Map<string, Detection[]>();
  for (const d of detections) {
    const liste = parClasse.get(d.carte);
    if (liste) liste.push(d);
    else parClasse.set(d.carte, [d]);
  }
  const vues: CarteVue[] = [];
  for (const [carte, liste] of parClasse) {
    const meilleures = [...liste].sort((a, b) => b.confiance - a.confiance).slice(0, 2);
    const nbCoins = meilleures.length;
    const moyenne = meilleures.reduce((t, d) => t + d.confiance, 0) / nbCoins;
    vues.push({
      carte,
      confiance: nbCoins >= 2 ? moyenne : moyenne * options.facteurCoinUnique,
      cx: meilleures.reduce((t, d) => t + d.x + d.l / 2, 0) / nbCoins,
      cy: meilleures.reduce((t, d) => t + d.y + d.h / 2, 0) / nbCoins,
      nbCoins,
    });
  }
  return vues.sort((a, b) => a.carte.localeCompare(b.carte));
}
