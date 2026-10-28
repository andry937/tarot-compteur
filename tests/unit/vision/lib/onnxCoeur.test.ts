// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-web";
import { CoeurOnnx } from "@/vision/lib/onnxCoeur";
import type { OrtMinimal } from "@/vision/lib/onnxCoeur";
import { ErreurModele } from "@/vision/lib/detecteur";

const CLASSES = ["atout-1", "atout-2", "coeur-14"];
const modele = () => new Uint8Array(readFileSync(new URL("../../../fixtures/mini.onnx", import.meta.url)));

describe("CoeurOnnx avec un vrai moteur onnxruntime (mini modèle à sortie constante)", () => {
  it("charge le modèle, l'exécute et décode ses détections", async () => {
    ort.env.wasm.numThreads = 1;
    const coeur = await CoeurOnnx.creer(ort as unknown as OrtMinimal, modele(), { taille: 64, classes: CLASSES, fournisseurs: ["wasm"] });
    const rgba = new Uint8ClampedArray(64 * 64 * 4);
    const dets = await coeur.inferer(rgba, 640, 640);
    expect(dets.map((d) => d.carte).sort()).toEqual(["atout-1", "coeur-14"]);
    const d = dets.find((x) => x.carte === "atout-1")!;
    expect(d.confiance).toBeCloseTo(0.9, 2);
    expect(d.x + d.l / 2).toBeCloseTo(16 / 64, 3); // centre (16, 16) sur 64 px
    const { tenseur, modele: tModele, decodage } = coeur.dernierTemps;
    for (const t of [tenseur, tModele, decodage]) expect(t).toBeGreaterThanOrEqual(0);
    expect(tenseur + tModele + decodage).toBeGreaterThan(0); // mesuré : plus à zéro après une inférence
    await coeur.fermer();
  }, 60000);

  it("signale clairement un modèle incompatible avec classes.json", async () => {
    ort.env.wasm.numThreads = 1;
    const coeur = await CoeurOnnx.creer(ort as unknown as OrtMinimal, modele(), { taille: 64, classes: ["atout-1"], fournisseurs: ["wasm"] });
    await expect(coeur.inferer(new Uint8ClampedArray(64 * 64 * 4), 640, 640)).rejects.toBeInstanceOf(ErreurModele);
  }, 60000);

  it("échoue avec une ErreurModele si le fichier n'est pas un modèle ONNX", async () => {
    ort.env.wasm.numThreads = 1;
    await expect(
      CoeurOnnx.creer(ort as unknown as OrtMinimal, new Uint8Array([1, 2, 3]), { taille: 64, classes: CLASSES, fournisseurs: ["wasm"] })
    ).rejects.toMatchObject({ name: "ErreurModele", code: "incompatible" });
  }, 60000);

  it("dit quel moteur sert, et pourquoi il a fallu se rabattre sur WASM", async () => {
    ort.env.wasm.numThreads = 1;
    const repli = await CoeurOnnx.creer(ort as unknown as OrtMinimal, modele(), { taille: 64, classes: CLASSES, fournisseurs: ["webgpu", "wasm"] });
    expect(repli.fournisseur).toBe("wasm");
    expect(repli.repli).toMatch(/^webgpu : /);
    const direct = await CoeurOnnx.creer(ort as unknown as OrtMinimal, modele(), { taille: 64, classes: CLASSES, fournisseurs: ["wasm"] });
    expect(direct.repli).toBeUndefined();
  }, 60000);
});
