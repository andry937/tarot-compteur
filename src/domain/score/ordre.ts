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
      ordreModifie: true,
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

/**
 * Table de la prochaine donne après un changement d'ordre : le donneur (fixé par `depart`) joue,
 * et les joueurs au repos sont ceux qui ont déjà le plus joué, de sorte que chacun finisse le cycle
 * avec le même nombre de donnes (5 chacun à 7 joueurs, 5 par donne). À nombre égal, on épargne
 * celui qui s'est reposé à la donne précédente. Rendue dans l'ordre de jeu, le donneur en premier.
 */
export function tableEquilibree(donnes: Donne[], total: number, parDonne: number, depart: number): number[] {
  const n = Math.min(parDonne, total);
  const donneur = (depart + donnes.length) % total;
  const dernier = donnes[donnes.length - 1]?.table ?? [];
  const jouees = Array.from({ length: total }, (_, i) => donnes.filter((d) => d.table.includes(i)).length);
  const auRepos = new Set(
    Array.from({ length: total }, (_, i) => i)
      .filter((i) => i !== donneur)
      .sort((a, b) => {
        if (jouees[b] !== jouees[a]) return jouees[b] - jouees[a];
        const dejaRepose = (i: number) => (dernier.length > 0 && !dernier.includes(i) ? 1 : 0);
        if (dejaRepose(a) !== dejaRepose(b)) return dejaRepose(a) - dejaRepose(b);
        return ((a - donneur + total) % total) - ((b - donneur + total) % total);
      })
      .slice(0, total - n)
  );
  const table: number[] = [];
  for (let o = 0; o < total; o++) {
    const siege = (donneur + o) % total;
    if (!auRepos.has(siege)) table.push(siege);
  }
  return table;
}
