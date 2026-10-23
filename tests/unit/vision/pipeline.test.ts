import { describe, it, expect } from "vitest";
import { pipelineInitial, reglagesParDefaut, traiterImage } from "@/vision/domain/pipeline";
import type { EtatPipeline } from "@/vision/domain/pipeline";
import type { Detection } from "@/vision/domain/types";
import { CONFIG5 } from "./aide";

const reglages = reglagesParDefaut([]);

/** Les deux coins d'une carte posée à la `place` donnée, en ligne au centre : la place n'a aucun lien avec le joueur. */
function coins(carte: string, place: number, confiance = 0.92): Detection[] {
  const cx = 0.1 + place * 0.15;
  const cy = 0.5;
  return [
    { carte, confiance, x: cx - 0.04, y: cy - 0.05, l: 0.02, h: 0.03 },
    { carte, confiance, x: cx + 0.02, y: cy + 0.02, l: 0.02, h: 0.03 },
  ];
}

/** Défile un « film » : à l'image i, on voit les cartes dont la fenêtre [debut, fin) contient i. */
function film(
  scenes: Array<{ carte: string; place: number; debut: number; fin: number; confiance?: number; coinsVus?: 1 | 2 }>,
  nbImages: number,
  extra: (i: number) => Detection[] = () => []
) {
  let etat: EtatPipeline = pipelineInitial(CONFIG5);
  for (let i = 0; i < nbImages; i++) {
    const detections = scenes
      .filter((s) => i >= s.debut && i < s.fin)
      .flatMap((s) => coins(s.carte, s.place, s.confiance).slice(0, s.coinsVus ?? 2))
      .concat(extra(i));
    etat = traiterImage(etat, { t: i * 70, detections }, reglages).etat;
  }
  return etat;
}

describe("pipeline complet sur un film synthétique", () => {
  it("suit un pli posé carte par carte, puis ramassé, malgré le bruit", () => {
    const scenes = [
      { carte: "atout-5", place: 1, debut: 0, fin: 40 },
      { carte: "coeur-14", place: 2, debut: 10, fin: 40 },
      { carte: "atout-12", place: 3, debut: 20, fin: 38 },
      { carte: "excuse", place: 4, debut: 30, fin: 40, coinsVus: 1 as const },
      { carte: "atout-3", place: 0, debut: 40, fin: 70 },
    ];
    // Bruit : un faux positif de 2 images, et une confusion VI/IX à confiance moyenne.
    const bruit = (i: number) => [
      ...(i >= 12 && i < 14 ? coins("pique-7", 4, 0.9) : []),
      ...(i >= 5 && i < 60 ? coins("atout-6", 0, 0.7) : []),
    ];
    // L'atout-3 n'apparaît qu'après que les autres sont partis : on fait donc venir la dernière carte à temps.
    const adaptees = scenes.map((s) => (s.carte === "atout-3" ? { ...s, debut: 36, fin: 70 } : s));
    const etat = film(adaptees, 90, bruit).suivi;

    expect(etat.plis).toHaveLength(1);
    expect(etat.plis[0].poses.map((p) => p.carte)).toEqual(["atout-5", "coeur-14", "atout-12", "excuse", "atout-3"]);
    expect(etat.plis[0]).toMatchObject({ entame: 1, gagnant: 3 });
    expect(etat.alertes.filter((a) => a.gravite !== "info")).toEqual([]);
    expect(etat.phase).toBe("attente"); // table vidée après le ramassage
  });

  it("n'accepte pas un atout confondable lu avec une confiance moyenne", () => {
    const etat = film([{ carte: "atout-6", place: 1, debut: 0, fin: 30, confiance: 0.7 }], 30).suivi;
    expect(etat.poseCourante).toHaveLength(0);
  });

  it("accepte le même atout lu avec une confiance élevée et ses deux coins", () => {
    const etat = film([{ carte: "atout-6", place: 1, debut: 0, fin: 30, confiance: 0.93 }], 30).suivi;
    expect(etat.poseCourante.map((p) => p.carte)).toEqual(["atout-6"]);
  });

  it("ne tient pas compte de la position : une carte vue dans un coin de l'image compte comme les autres", () => {
    const coin: Detection[] = [
      { carte: "coeur-3", confiance: 0.95, x: 0.0, y: 0.0, l: 0.02, h: 0.03 },
      { carte: "coeur-3", confiance: 0.95, x: 0.01, y: 0.01, l: 0.02, h: 0.03 },
    ];
    const etat = film([], 20, () => coin).suivi;
    expect(etat.poseCourante).toEqual([{ carte: "coeur-3", joueur: 1, horodatage: 0 }]);
  });
});
