// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { pipelineDepuisJson, pipelineVersJson } from "@/vision/domain/sauvegarde";
import { etatInitial, poser } from "@/vision/domain/machinePli";
import { pipelineInitial } from "@/vision/domain/pipeline";
import type { EtatPipeline } from "@/vision/domain/pipeline";
import { annulerDernierPli, corrigerCarte } from "@/vision/domain/corrections";
import { chargerPartie, effacerPartie, resume, sauvegarderPartie, vaut } from "@/vision/lib/sauvegardePartie";
import { CONFIG5, poserPli } from "./aide";

/** Un pipeline en cours : deux plis (le premier corrigé), une carte dans le pli suivant, une fenêtre de stabilisation. */
function pipelineEnCours(): EtatPipeline {
  const base = pipelineInitial(CONFIG5);
  let suivi = poserPli(etatInitial(CONFIG5), ["coeur-3", "coeur-9", "coeur-5", "coeur-12", "coeur-2"], 0);
  suivi = poserPli({ ...suivi, plis: suivi.plis }, [], 0);
  suivi = corrigerCarte(suivi, 1, 3, "coeur-4");
  suivi = poser(suivi, { carte: "trefle-7", joueur: 2, horodatage: 9000 });
  return {
    ...base,
    suivi,
    stab: {
      fenetre: [{ t: 1000, vues: new Map([["trefle-7", null]]) }, { t: 1100, vues: new Map([["trefle-7", null]]) }],
      presentes: new Map([["trefle-7", null]]),
    },
  };
}

beforeEach(() => localStorage.clear());

describe("pipelineVersJson / pipelineDepuisJson", () => {
  it("aller-retour exact à travers un vrai JSON, Map comprises", () => {
    const e = pipelineEnCours();
    const relu = pipelineDepuisJson(JSON.parse(JSON.stringify(pipelineVersJson(e))));
    expect(relu).toEqual(e);
    expect(relu!.stab.presentes).toBeInstanceOf(Map);
  });

  it("garde la correction d'identité : la carte lue est retrouvée, la correction s'annule", () => {
    const relu = pipelineDepuisJson(JSON.parse(JSON.stringify(pipelineVersJson(pipelineEnCours()))))!;
    expect(relu.suivi.plis[0].surcharge?.cartes).toEqual({ 3: "coeur-4" });
    expect(relu.suivi.plis[0].poses.find((p) => p.observee === "coeur-12")?.carte).toBe("coeur-4");
    const annule = corrigerCarte(relu.suivi, 1, 3, "coeur-12");
    expect(annule.plis[0].surcharge).toBeUndefined();
  });

  it("une reprise annule et refait les plis comme une manche jamais interrompue", () => {
    const e = pipelineEnCours();
    const reprise = pipelineDepuisJson(JSON.parse(JSON.stringify(pipelineVersJson(e))))!;
    expect(annulerDernierPli(reprise.suivi)).toEqual(annulerDernierPli(e.suivi));
  });

  it("refuse les formes invalides au lieu de planter", () => {
    const bon = JSON.parse(JSON.stringify(pipelineVersJson(pipelineEnCours())));
    const casse = (f: (j: any) => void) => { const j = JSON.parse(JSON.stringify(bon)); f(j); return pipelineDepuisJson(j); };  
    expect(pipelineDepuisJson(null)).toBeNull();
    expect(pipelineDepuisJson({})).toBeNull();
    expect(casse((j) => { j.suivi.phase = "inconnue"; })).toBeNull();
    expect(casse((j) => { j.suivi.plis = "x"; })).toBeNull();
    expect(casse((j) => { j.suivi.config.table = [0, 1]; })).toBeNull();
    expect(casse((j) => { j.suivi.config.entameInitiale = 9; })).toBeNull();
    expect(casse((j) => { j.suivi.poseCourante = [{ carte: 3 }]; })).toBeNull();
    expect(casse((j) => { j.suivi.plis[0].surcharge = { cartes: { 3: 7 } }; })).toBeNull();
    expect(casse((j) => { j.suivi.alertes = [{ cle: "a", message: "m", gravite: "grave" }]; })).toBeNull();
    expect(casse((j) => { j.stab.fenetre = [{ t: "x", vues: [] }]; })).toBeNull();
    expect(casse((j) => { j.stab.presentes = [["coeur-3"]]; })).toBeNull();
  });
});

describe("sauvegarde locale de la partie", () => {
  const TABLE = "t1:0";
  const CLE = "tarot-suivi:partie:t1:0";
  const noms = ["Ana", "Bob", "", "", ""];
  const annonce = { preneur: 2, roiAppele: "coeur" as const };

  it("relit ce qu'elle a écrit, avec la date et le résumé", () => {
    const p = pipelineEnCours();
    sauvegarderPartie(TABLE, noms, annonce, p, new Date("2026-10-20T20:00:00Z"));
    const lue = chargerPartie(TABLE)!;
    expect(lue.sauvegardeA).toBe("2026-10-20T20:00:00.000Z");
    expect(lue.noms).toEqual(noms);
    expect(lue.annonce).toEqual(annonce);
    expect(lue.pipeline).toEqual(p);
    expect(resume(lue)).toBe("1 pli terminé, 1 carte(s) dans le pli en cours");
  });

  it("rend null sans sauvegarde, si elle est abîmée, d'une autre version, ou si un siège de la table n'a pas de nom", () => {
    expect(chargerPartie(TABLE)).toBeNull();
    localStorage.setItem(CLE, "{pas du json");
    expect(chargerPartie(TABLE)).toBeNull();
    sauvegarderPartie(TABLE, noms, annonce, pipelineEnCours());
    const brut = JSON.parse(localStorage.getItem(CLE)!);
    const ecrireBrut = (o: unknown) => localStorage.setItem(CLE, JSON.stringify(o));
    ecrireBrut({ ...brut, version: 99 });
    expect(chargerPartie(TABLE)).toBeNull();
    ecrireBrut({ ...brut, noms: ["Ana"] }); // le pli en cours compte des sièges 0 à 4
    expect(chargerPartie(TABLE)).toBeNull();
    ecrireBrut({ ...brut, annonce: { preneur: "x" } });
    expect(chargerPartie(TABLE)).toBeNull();
    ecrireBrut(brut);
    expect(chargerPartie(TABLE)).not.toBeNull();
  });

  it("efface la sauvegarde ; ne vaut la peine d'être gardé qu'une fois quelque chose observé", () => {
    expect(vaut(pipelineInitial(CONFIG5))).toBe(false);
    expect(vaut(pipelineEnCours())).toBe(true);
    sauvegarderPartie(TABLE, noms, annonce, pipelineEnCours());
    effacerPartie(TABLE);
    expect(chargerPartie(TABLE)).toBeNull();
  });
});
