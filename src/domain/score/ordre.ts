/**
 * Changement de l'ordre des sièges en cours de partie : tout le code raisonne en index de siège,
 * donc les donnes et annulations déjà saisies sont ré-indexées pour garder leur sens.
 * @module
 */

import type { Donne } from "@/domain/score/regles";
import type { Annulation, Partie } from "@/domain/types";

/** Contenu d'une table concerné par un changement d'ordre. */
export interface TablePermutable {
  partie: Partie;
  donnes: Donne[];
  annulations: Annulation[];
}

/**
 * Réordonne les sièges : `ordre[nouveau] = ancien`. Les donnes passées gardent leurs joueurs
 * (sièges ré-indexés) ; le donneur de la prochaine donne reste le même joueur, la rotation
 * reprend ensuite dans le nouvel ordre.
 */
export function permuterSieges(t: TablePermutable, ordre: number[]): TablePermutable {
  const total = t.partie.joueursId.length;
  const nouveau = new Array<number>(total);
  ordre.forEach((ancien, i) => (nouveau[ancien] = i));
  const m = (s: number) => nouveau[s];
  const mn = (s: number | null) => (s === null || s === undefined ? s : m(s));

  const donneurSuivant = (t.partie.depart + t.donnes.length) % total;
  const depart = (((m(donneurSuivant) - t.donnes.length) % total) + total) % total;

  return {
    partie: {
      ...t.partie,
      joueursId: ordre.map((a) => t.partie.joueursId[a]),
      joueursNomFige: ordre.map((a) => t.partie.joueursNomFige[a]),
      depart,
    },
    donnes: t.donnes.map((d) => ({
      ...d,
      table: d.table.map(m),
      preneur: m(d.preneur),
      appele: mn(d.appele) as number | null,
      ...(d.donneur !== undefined ? { donneur: m(d.donneur) } : {}),
      ...(d.poignees ? { poignees: d.poignees.map((p) => ({ ...p, joueur: m(p.joueur) })) } : {}),
      miseres: d.miseres.map((x) => ({ ...x, joueur: m(x.joueur) })),
    })),
    annulations: t.annulations.map((a) => ({
      ...a,
      table: a.table.map(m),
      donneur: m(a.donneur),
      joueur: m(a.joueur),
    })),
  };
}
