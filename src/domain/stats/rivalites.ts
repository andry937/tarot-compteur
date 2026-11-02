/**
 * Rivalités : pour un joueur, son bilan contre chacun des autres sur toutes les donnes où ils
 * étaient dans des camps opposés (l'un en attaque, l'autre en défense). Calculé à la volée depuis
 * les archives, comme `stats.ts`. Aucune dépendance React.
 * @module
 */
import { calculer } from "@/domain/score/regles";
import { resoudreFiche, resoudreNom } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { roleDe } from "@/domain/stats/stats";
import type { PartieAnalysee } from "@/domain/stats/stats";

/** Bilan d'un joueur contre un adversaire donné. */
export interface Rivalite {
  /** Identifiant de la fiche de l'adversaire (fusions résolues). */
  adversaireId: string;
  /** Nom affiché de l'adversaire. */
  nom: string;
  /** Donnes jouées dans des camps opposés. */
  donnes: number;
  /** Donnes où le joueur a gagné son camp contre cet adversaire. */
  victoires: number;
}

/** Nombre de donnes opposées en dessous duquel un bilan est trop mince pour être cité. */
export const DONNES_RIVALITE_MIN = 20;

/** Taux de victoire (0 à 1) d'une rivalité. */
export const tauxRivalite = (r: Rivalite): number => (r.donnes > 0 ? r.victoires / r.donnes : 0);

/**
 * Bilan de `joueurId` (identifiant de fiche, fusions résolues) contre chaque joueur rencontré dans le
 * camp adverse, du plus souvent affronté au moins souvent. Camps : attaque = preneur + appelé (s'il y
 * en a un), défense = les autres ; les joueurs au repos ne sont l'adversaire de personne.
 */
export function calculerRivalites(joueurId: string, parties: PartieAnalysee[], roster: Fiche[]): Rivalite[] {
  const bilans = new Map<string, { donnes: number; victoires: number }>();
  parties.forEach((p) => {
    const ids = p.joueursId.map((id) => resoudreFiche(id, roster)?.id ?? id);
    const idx = ids.indexOf(joueurId);
    if (idx === -1) return;
    const n = ids.length;
    p.donnes.forEach((d) => {
      const res = calculer(d, n);
      const role = roleDe(d, res, idx);
      if (role === "repos") return;
      const monCamp = role === "defense" ? "defense" : "attaque";
      const gagne = monCamp === "attaque" ? res.reussi : !res.reussi;
      ids.forEach((autre, j) => {
        if (j === idx || autre === joueurId) return;
        const r = roleDe(d, res, j);
        if (r === "repos") return;
        if ((r === "defense" ? "defense" : "attaque") === monCamp) return;
        const b = bilans.get(autre) ?? { donnes: 0, victoires: 0 };
        b.donnes += 1;
        if (gagne) b.victoires += 1;
        bilans.set(autre, b);
      });
    });
  });
  return [...bilans.entries()]
    .map(([adversaireId, b]) => ({ adversaireId, nom: resoudreNom(adversaireId, roster, "?"), ...b }))
    .sort((a, b) => b.donnes - a.donnes);
}

/**
 * Bête noire (taux de victoire le plus bas) et victime favorite (le plus haut) parmi les adversaires
 * assez affrontés ; `null` si personne n'a assez de donnes ou si les deux seraient le même joueur.
 */
export function bilanRivalites(rivalites: Rivalite[]): { beteNoire: Rivalite | null; victime: Rivalite | null } {
  const assez = rivalites.filter((r) => r.donnes >= DONNES_RIVALITE_MIN);
  if (assez.length === 0) return { beteNoire: null, victime: null };
  const tri = [...assez].sort((a, b) => tauxRivalite(a) - tauxRivalite(b));
  const beteNoire = tri[0];
  const victime = tri[tri.length - 1];
  return {
    beteNoire: tauxRivalite(beteNoire) < 0.5 ? beteNoire : null,
    victime: victime !== beteNoire && tauxRivalite(victime) > 0.5 ? victime : null,
  };
}
