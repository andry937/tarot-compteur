/**
 * Classement général par Elo. Aucune dépendance React : testable isolément.
 *
 * Modèle retenu (issue #10) : un match par donne archivée, pas par partie.
 * Attaque (preneur + appelé le cas échéant) contre défense, résultat binaire
 * (contrat réussi ou chuté, cf. `calculer().reussi`). Un seul Elo global par
 * joueur, pas de distinction par rôle. La comparaison à plusieurs contre un
 * (défense à 3 ou 4 contre 1 preneur) est traitée en calculant l'espérance de
 * gain sur la moyenne des Elo de chaque camp, puis en appliquant le même
 * delta à chaque membre du camp — sans le diviser entre les membres.
 *
 * Recalcul complet à chaque affichage, en rejouant toutes les donnes
 * archivées dans l'ordre chronologique : comme pour `stats.ts`, pas
 * d'agrégat stocké, donc pas de désynchronisation possible après une fusion
 * de fiches joueurs.
 */

import { calculer } from "./regles";
import type { PartieAnalysee } from "./stats";
import { resoudreFiche, resoudreNom } from "./identite";
import type { Fiche } from "./identite";

export const ELO_DEPART = 1500;
export const ELO_K = 24;

export interface ClassementElo {
  id: string;
  nom: string;
  elo: number;
  matchs: number;
}

/** Espérance de gain de l'attaque face à la défense (formule Elo standard sur la moyenne de chaque camp). */
function esperanceAttaque(eloAttaque: number, eloDefense: number): number {
  return 1 / (1 + Math.pow(10, (eloDefense - eloAttaque) / 400));
}

const moyenne = (vs: number[]): number => vs.reduce((a, b) => a + b, 0) / vs.length;

/**
 * Calcule le classement Elo de tous les joueurs à partir des parties
 * archivées, dans l'ordre chronologique. `roster` sert à résoudre les
 * fusions : les donnes jouées sous une identité fusionnée comptent pour la
 * fiche cible.
 */
export function calculerClassementElo(parties: PartieAnalysee[], roster: Fiche[]): ClassementElo[] {
  const elos = new Map<string, number>();
  const matchs = new Map<string, number>();

  const idFinal = (idBrut: string): string => resoudreFiche(idBrut, roster)?.id ?? idBrut;
  const noteDe = (id: string): number => elos.get(id) ?? ELO_DEPART;

  const partiesTriees = [...parties].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const partie of partiesTriees) {
    const idsResolus = partie.joueursId.map(idFinal);
    for (const donne of partie.donnes) {
      const res = calculer(donne, partie.joueursId.length);
      if (res.table.length === 0) continue;

      const attaque = [donne.preneur, ...(res.avecAppele ? [donne.appele as number] : [])].map(
        (i) => idsResolus[i]
      );
      const defense = res.defenseurs.map((i) => idsResolus[i]);
      if (attaque.length === 0 || defense.length === 0) continue;

      const eloAttaqueMoy = moyenne(attaque.map(noteDe));
      const eloDefenseMoy = moyenne(defense.map(noteDe));
      const espere = esperanceAttaque(eloAttaqueMoy, eloDefenseMoy);
      const reel = res.reussi ? 1 : 0;
      const delta = ELO_K * (reel - espere);

      attaque.forEach((id) => {
        elos.set(id, noteDe(id) + delta);
        matchs.set(id, (matchs.get(id) || 0) + 1);
      });
      defense.forEach((id) => {
        elos.set(id, noteDe(id) - delta);
        matchs.set(id, (matchs.get(id) || 0) + 1);
      });
    }
  }

  return [...elos.entries()]
    .map(([id, elo]) => ({
      id,
      nom: resoudreNom(id, roster, "?"),
      elo: Math.round(elo),
      matchs: matchs.get(id) || 0,
    }))
    .sort((a, b) => b.elo - a.elo);
}
