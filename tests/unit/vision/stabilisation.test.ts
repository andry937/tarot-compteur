import { describe, it, expect } from "vitest";
import { avancerStabilisation, stabilisationInitiale, PARAMS_DEFAUT } from "@/vision/domain/stabilisation";
import type { EvenementStab, EtatStabilisation } from "@/vision/domain/stabilisation";
import type { ObsCarte, ZoneId } from "@/vision/domain/types";

/** Fait défiler des images (une toutes les 100 ms) et renvoie tous les événements avec leur numéro d'image. */
function defiler(images: ObsCarte[][], params = PARAMS_DEFAUT) {
  let etat: EtatStabilisation = stabilisationInitiale();
  const evenements: { image: number; e: EvenementStab }[] = [];
  images.forEach((cartes, i) => {
    const r = avancerStabilisation(etat, { t: i * 100, cartes }, params);
    etat = r.etat;
    r.evenements.forEach((e) => evenements.push({ image: i, e }));
  });
  return { etat, evenements };
}

const vue = (carte: string, zone: ZoneId | null = "table"): ObsCarte => ({ carte, zone });
const repete = (cartes: ObsCarte[], n: number) => Array.from({ length: n }, () => cartes);

describe("stabilisation N sur M", () => {
  it("valide une carte vue 5 images sur 8, pas avant", () => {
    const { evenements } = defiler(repete([vue("atout-3")], 8));
    expect(evenements).toHaveLength(1);
    expect(evenements[0].image).toBe(4); // 5e image
    expect(evenements[0].e).toMatchObject({ type: "validee", carte: "atout-3", zone: "table", horodatage: 0, valideeA: 400 });
  });

  it("ignore une carte qui clignote (moins de 5 images sur 8)", () => {
    const images = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? [vue("atout-3")] : []));
    expect(defiler(images).evenements).toHaveLength(0);
  });

  it("tolère quelques images perdues si la carte est vue assez souvent", () => {
    const images = [[vue("atout-3")], [], [vue("atout-3")], [vue("atout-3")], [], [vue("atout-3")], [vue("atout-3")]];
    const { evenements } = defiler(images);
    expect(evenements.map((x) => x.e.type)).toEqual(["validee"]);
    expect(evenements[0].image).toBe(6);
    expect((evenements[0].e as { horodatage: number }).horodatage).toBe(0); // début de la séquence
  });

  it("retire une carte validée absente d'au moins 5 images sur 8", () => {
    const { evenements, etat } = defiler([...repete([vue("atout-3")], 6), ...repete([], 8)]);
    expect(evenements.map((x) => x.e.type)).toEqual(["validee", "retiree"]);
    expect(etat.presentes.size).toBe(0);
  });

  it("ne retire pas une carte validée qui disparaît brièvement", () => {
    const { evenements } = defiler([...repete([vue("atout-3")], 6), ...repete([], 3), ...repete([vue("atout-3")], 3)]);
    expect(evenements.map((x) => x.e.type)).toEqual(["validee"]);
  });

  it("signale le déplacement d'une carte vers un autre emplacement", () => {
    const { evenements } = defiler([...repete([vue("atout-3", "table")], 6), ...repete([vue("atout-3", "chien")], 8)]);
    const types = evenements.map((x) => x.e.type);
    expect(types).toEqual(["validee", "deplacee"]);
    expect(evenements[1].e).toMatchObject({ de: "table", vers: "chien" });
  });

  it("valide plusieurs cartes dans l'ordre de leur première observation", () => {
    const images = [[vue("atout-3")], [vue("atout-3"), vue("coeur-1", "chien")], ...repete([vue("atout-3"), vue("coeur-1", "chien")], 7)];
    const { evenements } = defiler(images);
    expect(evenements.map((x) => (x.e as { carte: string }).carte)).toEqual(["atout-3", "coeur-1"]);
  });

  it("respecte des seuils réglables", () => {
    expect(defiler(repete([vue("atout-3")], 3), { n: 3, m: 4, absenceN: 3 }).evenements).toHaveLength(1);
    expect(defiler(repete([vue("atout-3")], 6), { n: 7, m: 8, absenceN: 5 }).evenements).toHaveLength(0);
  });

  it("garde une zone null (hors emplacement) comme information", () => {
    const { evenements } = defiler(repete([vue("atout-3", null)], 5));
    expect(evenements[0].e).toMatchObject({ type: "validee", zone: null });
  });
});
