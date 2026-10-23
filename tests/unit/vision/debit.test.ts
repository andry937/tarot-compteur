import { describe, expect, it } from "vitest";
import { PARAMS_DEFAUT, stabilisationPourDebit } from "@/vision/domain/stabilisation";
import { creerBoucle } from "@/vision/lib/boucle";
import { DetecteurFactice } from "@/vision/lib/detecteur";
import type { Detection } from "@/vision/domain/types";

describe("stabilisationPourDebit", () => {
  it("garde les réglages d'origine à fort débit ou sans mesure", () => {
    expect(stabilisationPourDebit(PARAMS_DEFAUT, 30)).toEqual(PARAMS_DEFAUT);
    expect(stabilisationPourDebit(PARAMS_DEFAUT, 10)).toEqual(PARAMS_DEFAUT);
    expect(stabilisationPourDebit(PARAMS_DEFAUT, 0)).toEqual(PARAMS_DEFAUT);
  });

  it("vise une demi-seconde à faible débit, sans descendre sous 2 images", () => {
    expect(stabilisationPourDebit(PARAMS_DEFAUT, 6)).toEqual({ n: 3, m: 6, absenceN: 3 });
    expect(stabilisationPourDebit(PARAMS_DEFAUT, 3)).toEqual({ n: 2, m: 5, absenceN: 2 });
    expect(stabilisationPourDebit(PARAMS_DEFAUT, 1)).toEqual({ n: 2, m: 5, absenceN: 2 });
  });

  it("ne dépasse jamais les seuils demandés", () => {
    const p = { n: 3, m: 4, absenceN: 3 };
    for (const fps of [1, 3, 6, 15, 60]) {
      const r = stabilisationPourDebit(p, fps);
      expect(r.n).toBeLessThanOrEqual(p.n);
      expect(r.m).toBeLessThanOrEqual(p.m);
      expect(r.absenceN).toBeLessThanOrEqual(r.m);
    }
  });
});

const CONFIG = { table: [0, 1, 2, 3, 4], entameInitiale: 1 };
const PLI = ["coeur-3", "coeur-9", "coeur-5", "coeur-12", "coeur-2"];
const coins = (carte: string, i: number): Detection[] => [
  { carte, confiance: 0.93, x: 0.3 + i * 0.1, y: 0.45, l: 0.02, h: 0.03 },
  { carte, confiance: 0.93, x: 0.36 + i * 0.1, y: 0.52, l: 0.02, h: 0.03 },
];

/** Joue un pli à 3 images/s : une carte par image, la dernière ne reste que 2 images avant que la table soit vidée. */
async function jouerPliRapide() {
  let t = 0;
  let k = 0;
  const scenario = (): Detection[] => {
    const visibles = k < PLI.length + 1 ? Math.min(PLI.length, k + 1) : 0; // k = 0..5 : cartes visibles ; ensuite, table vide
    return PLI.slice(0, visibles).flatMap((c, i) => coins(c, i));
  };
  const boucle = creerBoucle({
    source: { nom: "test", image: () => ({}) as CanvasImageSource, taille: () => ({ largeur: 1280, hauteur: 720 }), arreter: () => undefined },
    detecteur: new DetecteurFactice(scenario),
    config: CONFIG,
    reglages: () => ({ ...pipelineReglages }),
    onImage: () => undefined,
    onErreur: (e) => { throw e; },
    maintenant: () => (t += 165), // deux lectures par image : une image toutes les 330 ms (≈ 3 images/s)
  });
  for (k = 0; k < 14; k++) await boucle.pas();
  return boucle.etat().suivi;
}

import { reglagesParDefaut } from "@/vision/domain/pipeline";
const pipelineReglages = reglagesParDefaut([]);

describe("boucle à 3 images/s", () => {
  it("enregistre un pli dont la dernière carte est ramassée vite", async () => {
    const suivi = await jouerPliRapide();
    expect(suivi.plis).toHaveLength(1);
    expect(suivi.plis[0].poses.map((p) => p.carte)).toEqual(PLI);
  });
});
