/**
 * Saisons : classements restreints à un mois ou à une année civile. Chaque période repart de zéro
 * (les notes sont recalculées en ne rejouant que les parties de la période) ; le classement général
 * reste calculé sur tout l'historique. Aucune dépendance React.
 * @module
 */

import { calculerClassementElo } from "@/domain/stats/elo";
import type { ClassementElo } from "@/domain/stats/elo";
import type { PartieAnalysee } from "@/domain/stats/stats";
import type { Fiche } from "@/domain/joueurs/identite";

/** Type de saison. */
export type TypePeriode = "mois" | "annee";

/** Donnes minimales pour figurer au classement d'une saison (le général en exige 50). */
export const DONNES_MIN_PERIODE: Record<TypePeriode, number> = { mois: 10, annee: 30 };

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Clé de la période d'une date ISO : « 2026-11 » (mois) ou « 2026 » (année), en heure locale. */
export function clePeriode(dateIso: string, type: TypePeriode): string {
  const d = new Date(dateIso);
  const annee = String(d.getFullYear());
  return type === "annee" ? annee : `${annee}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Libellé lisible : « novembre 2026 » ou « 2026 ». */
export function libellePeriode(cle: string, type: TypePeriode): string {
  if (type === "annee") return cle;
  const [annee, mois] = cle.split("-");
  return `${MOIS[Number(mois) - 1] ?? mois} ${annee}`;
}

/** Parties archivées dont la date tombe dans la période. */
export function partiesDeLaPeriode(parties: PartieAnalysee[], type: TypePeriode, cle: string): PartieAnalysee[] {
  return parties.filter((p) => clePeriode(p.date, type) === cle);
}

/** Périodes ayant au moins une partie, plus la période courante, de la plus récente à la plus ancienne. */
export function periodesDisponibles(parties: PartieAnalysee[], type: TypePeriode, maintenant: Date = new Date()): string[] {
  const cles = new Set(parties.map((p) => clePeriode(p.date, type)));
  cles.add(clePeriode(maintenant.toISOString(), type));
  return [...cles].sort().reverse();
}

/** Les joueurs sans nom ne figurent jamais à l'affichage (mais pèsent dans les notes). */
const nomAffichable = (nom: string) => nom.trim() !== "" && nom.trim() !== "∅";

/** Classement d'une saison : notes recalculées sur ses seules parties, filtré au seuil de la période. */
export function classementPeriode(
  parties: PartieAnalysee[],
  roster: Fiche[],
  type: TypePeriode,
  cle: string
): ClassementElo[] {
  return calculerClassementElo(partiesDeLaPeriode(parties, type, cle), roster).filter(
    (c) => nomAffichable(c.nom) && c.matchs >= DONNES_MIN_PERIODE[type]
  );
}

/** Vainqueur d'une saison passée ou en cours. */
export interface ChampionPeriode {
  /** Clé de la période (« 2026-10 »). */
  cle: string;
  /** Premier du classement de la période. */
  champion: ClassementElo;
}

/** Champion de chaque période qui en a un, de la plus récente à la plus ancienne. */
export function championsParPeriode(
  parties: PartieAnalysee[],
  roster: Fiche[],
  type: TypePeriode,
  maintenant: Date = new Date()
): ChampionPeriode[] {
  const res: ChampionPeriode[] = [];
  for (const cle of periodesDisponibles(parties, type, maintenant)) {
    const [premier] = classementPeriode(parties, roster, type, cle);
    if (premier) res.push({ cle, champion: premier });
  }
  return res;
}
