import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreSuivi } from "@/vision/StoreSuivi";
import { DetecteurFactice } from "@/vision/lib/detecteur";
import { chargerPartie } from "@/vision/lib/sauvegardePartie";
import { pipelineVersJson } from "@/vision/domain/sauvegarde";
import type { Detection } from "@/vision/domain/types";

const CONFIG = { table: [0, 1, 2, 3, 4], entameInitiale: 1 };
const CARTES = ["coeur-3", "coeur-9", "coeur-5"];
/** Une carte de plus toutes les 300 ms, sous forme de deux coins. */
const film = (t: number): Detection[] =>
  CARTES.slice(0, Math.min(CARTES.length, Math.floor(t / 300) + 1)).flatMap((carte, i) => [
    { carte, confiance: 0.93, x: 0.3 + i * 0.1, y: 0.45, l: 0.02, h: 0.03 },
    { carte, confiance: 0.93, x: 0.36 + i * 0.1, y: 0.52, l: 0.02, h: 0.03 },
  ]);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});
afterEach(() => vi.useRealTimers());

describe("StoreSuivi — sauvegarde", () => {
  it("à l'arrêt, écrit exactement le dernier état (les écritures pendant le jeu sont espacées d'une seconde)", async () => {
    const store = new StoreSuivi("t1:0:0");
    store.definirMeta({ noms: ["A", "B", "C", "D", "E"], annonce: { preneur: 0, roiAppele: null } });
    const t0 = performance.now();
    const source = { nom: "test", image: () => ({}) as CanvasImageSource, taille: () => ({ largeur: 1280, hauteur: 720 }), arreter: () => undefined };
    store.demarrer({ source, detecteur: new DetecteurFactice(() => film(performance.now() - t0)), config: CONFIG });
    await vi.advanceTimersByTimeAsync(1450);
    const dernier = store.etat!;
    expect(dernier.suivi.poseCourante.length).toBeGreaterThan(0);
    store.arreter();
    expect(pipelineVersJson(chargerPartie("t1:0:0")!.pipeline)).toEqual(pipelineVersJson(dernier));
  });
});
