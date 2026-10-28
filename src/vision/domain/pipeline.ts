import { fusionCoins, OPTIONS_FUSION_DEFAUT } from "./fusionCoins";
import type { OptionsFusion } from "./fusionCoins";
import { appliquer, etatInitial } from "./machinePli";
import type { ConfigSuivi, EtatSuivi } from "./machinePli";
import { accepte, SEUILS_DEFAUT } from "./seuils";
import type { Seuils } from "./seuils";
import { avancerStabilisation, PARAMS_DEFAUT, stabilisationInitiale } from "./stabilisation";
import type { EtatStabilisation, EvenementStab, ParamsStabilisation } from "./stabilisation";
import type { Detection, Zone } from "./types";
import { affecterZone } from "./zones";

export interface ReglagesPipeline {
  seuils: Seuils;
  stabilisation: ParamsStabilisation;
  fusion: OptionsFusion;
  /** Zones du chien et de l'écart (facultatives) : partout ailleurs, une carte est « sur la table ». */
  zones: Zone[];
}

export const reglagesParDefaut = (zones: Zone[]): ReglagesPipeline => ({
  seuils: SEUILS_DEFAUT,
  stabilisation: PARAMS_DEFAUT,
  fusion: OPTIONS_FUSION_DEFAUT,
  zones,
});

export interface EtatPipeline {
  stab: EtatStabilisation;
  suivi: EtatSuivi;
}

export const pipelineInitial = (config: ConfigSuivi): EtatPipeline => ({
  stab: stabilisationInitiale(),
  suivi: etatInitial(config),
});

/**
 * Une image de la chaîne complète, sans caméra ni modèle : détections brutes → cartes
 * (coins fusionnés) → seuils par classe → emplacement → stabilisation N/M → machine du pli.
 * Le détecteur réel (phase 2) et le détecteur factice produisent tous deux des `Detection[]`.
 */
export function traiterImage(
  etat: EtatPipeline,
  image: { t: number; detections: Detection[] },
  reglages: ReglagesPipeline
): { etat: EtatPipeline; evenements: EvenementStab[] } {
  const cartes = fusionCoins(image.detections, reglages.fusion)
    .filter((v) => accepte(v, reglages.seuils))
    .map((v) => ({ carte: v.carte, zone: affecterZone(v, reglages.zones) }));
  const { etat: stab, evenements } = avancerStabilisation(etat.stab, { t: image.t, cartes }, reglages.stabilisation);
  return { etat: { stab, suivi: evenements.reduce(appliquer, etat.suivi) }, evenements };
}
