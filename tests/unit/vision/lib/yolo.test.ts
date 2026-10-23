import { describe, it, expect } from "vitest";
import { calculerLetterbox, decoderYolo, rgbaVersTenseur } from "@/vision/lib/yolo";

const CLASSES = ["atout-1", "atout-2", "coeur-14"];

/** Sortie [1, 4 + nc, N] avec les détections données : [cx, cy, l, h, classe, score]. */
function sortie(n: number, dets: Array<[number, number, number, number, number, number]>) {
  const out = new Float32Array((4 + CLASSES.length) * n);
  dets.forEach(([cx, cy, l, h, c, s], i) => {
    out[0 * n + i] = cx;
    out[1 * n + i] = cy;
    out[2 * n + i] = l;
    out[3 * n + i] = h;
    out[(4 + c) * n + i] = s;
  });
  return { out, dims: [1, 4 + CLASSES.length, n] as const };
}

describe("letterbox", () => {
  it("garde les proportions et centre l'image dans l'entrée carrée", () => {
    const lb = calculerLetterbox(1920, 1080, 960);
    expect(lb.echelle).toBeCloseTo(0.5);
    expect(lb.dx).toBeCloseTo(0);
    expect(lb.dy).toBeCloseTo((960 - 540) / 2);
  });

  it("tient compte de la zone analysée (ROI)", () => {
    const lb = calculerLetterbox(1000, 1000, 500, { x: 0.25, y: 0.25, l: 0.5, h: 0.5 });
    expect(lb.sx).toBe(250);
    expect(lb.sl).toBe(500);
    expect(lb.echelle).toBe(1);
  });
});

describe("rgbaVersTenseur", () => {
  it("range les canaux R, G, B en plans séparés entre 0 et 1", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const t = rgbaVersTenseur(rgba, 2);
    expect(Array.from(t)).toEqual([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]);
  });
});

describe("decoderYolo", () => {
  it("remet les boîtes en coordonnées normalisées de l'image source", () => {
    const lb = calculerLetterbox(1920, 1080, 960); // échelle 0,5, bandes de 210 px en haut et en bas
    const { out, dims } = sortie(3, [[480, 480, 40, 60, 2, 0.9]]);
    const [d] = decoderYolo(out, dims, lb, CLASSES);
    expect(d.carte).toBe("coeur-14");
    expect(d.confiance).toBeCloseTo(0.9);
    expect(d.x + d.l / 2).toBeCloseTo(0.5); // centre de l'image
    expect(d.y + d.h / 2).toBeCloseTo(0.5);
    expect(d.l).toBeCloseTo(40 / 0.5 / 1920);
    expect(d.h).toBeCloseTo(60 / 0.5 / 1080);
  });

  it("applique la ROI : une boîte au centre de l'entrée tombe au centre de la ROI", () => {
    const lb = calculerLetterbox(1000, 1000, 500, { x: 0.5, y: 0, l: 0.5, h: 1 });
    const { out, dims } = sortie(1, [[250, 250, 20, 20, 0, 0.8]]);
    const [d] = decoderYolo(out, dims, lb, CLASSES);
    expect(d.x + d.l / 2).toBeCloseTo(0.75);
    expect(d.y + d.h / 2).toBeCloseTo(0.5);
  });

  it("écarte les scores sous le seuil brut et garde la meilleure classe de chaque boîte", () => {
    const lb = calculerLetterbox(640, 640, 640);
    const { out, dims } = sortie(2, [[100, 100, 30, 30, 0, 0.2], [300, 300, 30, 30, 1, 0.7]]);
    const dets = decoderYolo(out, dims, lb, CLASSES);
    expect(dets.map((d) => d.carte)).toEqual(["atout-2"]);
  });

  it("supprime les doublons d'une même classe qui se recouvrent, mais garde deux coins éloignés", () => {
    const lb = calculerLetterbox(640, 640, 640);
    const { out, dims } = sortie(4, [
      [100, 100, 40, 40, 0, 0.9],
      [102, 101, 40, 40, 0, 0.6], // doublon du premier
      [500, 500, 40, 40, 0, 0.8], // deuxième coin de la même carte
      [100, 100, 40, 40, 1, 0.7], // autre classe au même endroit : conservée
    ]);
    const dets = decoderYolo(out, dims, lb, CLASSES);
    expect(dets.map((d) => `${d.carte}:${d.confiance.toFixed(1)}`).sort()).toEqual(["atout-1:0.8", "atout-1:0.9", "atout-2:0.7"]);
  });

  it("lit aussi la sortie transposée [1, N, 4 + nc]", () => {
    const lb = calculerLetterbox(640, 640, 640);
    const n = 5;
    const t = new Float32Array(n * 7);
    t.set([320, 320, 50, 50, 0, 0, 0.95], 2 * 7); // détection n° 2, classe coeur-14
    const [d] = decoderYolo(t, [1, n, 7], lb, CLASSES);
    expect(d.carte).toBe("coeur-14");
    expect(d.x + d.l / 2).toBeCloseTo(0.5);
  });

  it("explique un modèle dont le nombre de classes ne correspond pas", () => {
    const lb = calculerLetterbox(640, 640, 640);
    expect(() => decoderYolo(new Float32Array(10 * 8), [1, 10, 8], lb, CLASSES)).toThrow(/incompatible/i);
  });
});
