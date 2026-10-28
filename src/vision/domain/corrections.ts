import { CARTES_CONNUES, poser, recalculer } from "./machinePli";
import type { EtatSuivi, SurchargePli } from "./machinePli";

/**
 * Corrections manuelles d'un pli : l'ordre d'arrivée des cartes ne dit pas toujours qui a joué, la caméra ne
 * voit pas les joueurs. Chaque correction est enregistrée sur le pli (`PliJoue.surcharge`) puis tout est
 * recalculé : l'entame de chaque pli est le gagnant du précédent, donc une correction se propage aux plis
 * suivants. Fonctions pures : l'état reçu n'est pas modifié.
 *
 * La cible est un numéro de pli terminé, ou `"courant"` pour le pli en cours de constitution.
 */
export type CibleCorrection = number | "courant";

/** Retire les champs vides ; `undefined` quand il ne reste aucune correction. */
function nettoyer(s: SurchargePli): SurchargePli | undefined {
  const joueurs = s.joueurs && Object.keys(s.joueurs).length ? s.joueurs : undefined;
  const cartes = s.cartes && Object.keys(s.cartes).length ? s.cartes : undefined;
  const propre: SurchargePli = {
    ...(s.entame !== undefined ? { entame: s.entame } : {}),
    ...(joueurs ? { joueurs } : {}),
    ...(cartes ? { cartes } : {}),
    ...(s.gagnant !== undefined ? { gagnant: s.gagnant } : {}),
  };
  return Object.keys(propre).length ? propre : undefined;
}

function modifier(etat: EtatSuivi, cible: CibleCorrection, f: (s: SurchargePli) => SurchargePli): EtatSuivi {
  if (cible === "courant") {
    return recalculer({ ...etat, surchargeCourante: nettoyer(f(etat.surchargeCourante)) ?? {} });
  }
  if (!etat.plis.some((p) => p.numero === cible)) return etat;
  return recalculer({
    ...etat,
    plis: etat.plis.map((p) => {
      if (p.numero !== cible) return p;
      const nouvelle = nettoyer(f(p.surcharge ?? {}));
      return nouvelle ? { ...p, surcharge: nouvelle } : sans(p, "surcharge");
    }),
  });
}

/** Copie de l'objet sans une clé. */
const sans = <T extends object, K extends keyof T>(o: T, cle: K): Omit<T, K> =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== cle)) as Omit<T, K>;

const estJoueur = (etat: EtatSuivi, joueur: number): boolean => etat.config.table.includes(joueur);

/** Impose le joueur qui entame ce pli ; `null` revient à la déduction (le gagnant du pli précédent). */
export function corrigerEntame(etat: EtatSuivi, cible: CibleCorrection, joueur: number | null): EtatSuivi {
  if (joueur !== null && !estJoueur(etat, joueur)) return etat;
  return modifier(etat, cible, (s) => (joueur === null ? sans(s, "entame") : { ...s, entame: joueur }));
}

/**
 * Impose le joueur d'une carte du pli ; `null` revient à la déduction. Un autre joueur déjà imposé sur la même
 * place perd son réglage (une place, une carte).
 */
export function corrigerJoueur(etat: EtatSuivi, cible: CibleCorrection, carte: string, joueur: number | null): EtatSuivi {
  if (joueur !== null && !estJoueur(etat, joueur)) return etat;
  return modifier(etat, cible, (s) => {
    const joueurs = Object.fromEntries(Object.entries(s.joueurs ?? {}).filter(([c, j]) => c !== carte && j !== joueur));
    return { ...s, joueurs: joueur === null ? joueurs : { ...joueurs, [carte]: joueur } };
  });
}

/** Impose le gagnant d'un pli terminé ; `null` revient aux règles du tarot. */
export function corrigerGagnant(etat: EtatSuivi, numero: number, joueur: number | null): EtatSuivi {
  if (joueur !== null && !estJoueur(etat, joueur)) return etat;
  return modifier(etat, numero, (s) => (joueur === null ? sans(s, "gagnant") : { ...s, gagnant: joueur }));
}

/** Annule toutes les corrections d'un pli. */
export function effacerCorrections(etat: EtatSuivi, cible: CibleCorrection): EtatSuivi {
  return modifier(etat, cible, () => ({}));
}

/**
 * Où se trouve déjà `carte` : numéro du pli, `"en-cours"`, `"chien"`, `"ecart"`, ou `null` si elle n'est nulle
 * part (pas encore jouée, ni écartée ni retournée au chien).
 */
export function carteDejaJouee(etat: EtatSuivi, carte: string): number | "en-cours" | "chien" | "ecart" | null {
  const pli = etat.plis.find((p) => p.poses.some((x) => x.carte === carte));
  if (pli) return pli.numero;
  if (etat.poseCourante.some((x) => x.carte === carte)) return "en-cours";
  if (etat.chien.includes(carte)) return "chien";
  if (etat.ecart.includes(carte)) return "ecart";
  return null;
}

/**
 * Annule le dernier pli terminé (ses cartes ont été mal lues, ou le pli n'a pas eu lieu). Ses cartes ne
 * sont plus comptées : pour les rejouer, il faut les retirer de la table puis les reposer, la caméra les
 * relira alors comme de nouvelles cartes.
 */
export function annulerDernierPli(etat: EtatSuivi): EtatSuivi {
  const dernier = etat.plis[etat.plis.length - 1];
  if (!dernier) return etat;
  return recalculer({
    ...etat,
    plis: etat.plis.slice(0, -1),
    phase: etat.poseCourante.length ? "enCours" : "attente",
    alertes: etat.alertes.filter((a) => a.pli !== dernier.numero),
  });
}

/**
 * Corrige l'identité d'une carte d'un pli terminé : la caméra a lu `carte` là où il y avait autre chose.
 * `rang` est le rang d'arrivée de la carte dans le pli (0 = première posée). Refusé (état inchangé) si la
 * carte a déjà été jouée ailleurs, si elle est inconnue, ou si le rang n'existe pas.
 */
export function corrigerCarte(etat: EtatSuivi, numero: number, rang: number, carte: string): EtatSuivi {
  if (!CARTES_CONNUES.has(carte)) return etat;
  const pli = etat.plis.find((p) => p.numero === numero);
  if (!pli) return etat;
  const parArrivee = [...pli.poses].sort((a, b) => a.horodatage - b.horodatage);
  const cible = parArrivee[rang];
  if (!cible || cible.carte === carte) return etat;
  if (carteDejaJouee(etat, carte) !== null) return etat;

  const observee = cible.observee ?? cible.carte;
  const ancienne = cible.carte;
  const s = pli.surcharge ?? {};
  const cartes = { ...(s.cartes ?? {}) };
  if (carte === observee) delete cartes[rang];
  else cartes[rang] = carte;
  // Un joueur imposé sur l'ancienne identité le reste sur la nouvelle (c'est la même carte physique).
  const joueurs = { ...(s.joueurs ?? {}) };
  if (ancienne in joueurs) {
    joueurs[carte] = joueurs[ancienne];
    delete joueurs[ancienne];
  }
  const nouvelle: SurchargePli = { ...s, cartes, joueurs };
  const propre = nettoyer(nouvelle);
  return recalculer({
    ...etat,
    plis: etat.plis.map((p) => (p.numero !== numero ? p : propre ? { ...p, surcharge: propre } : sans(p, "surcharge"))),
  });
}

/**
 * Ajoute une carte que la caméra n'a pas vue, au pli en cours, jouée par `joueur`. Refusé (état inchangé) si
 * la carte est inconnue ou déjà jouée, si le joueur n'est pas à la table ou a déjà joué ce pli, ou si la
 * manche est finie. `horodatage` est l'instant de la correction ; elle est placée après les cartes déjà posées.
 */
export function ajouterCarte(etat: EtatSuivi, joueur: number, carte: string, horodatage: number): EtatSuivi {
  if (!CARTES_CONNUES.has(carte) || !estJoueur(etat, joueur) || etat.phase === "termine") return etat;
  if (carteDejaJouee(etat, carte) !== null) return etat;
  if (etat.poseCourante.some((p) => p.joueur === joueur)) return etat;
  const dernier = etat.poseCourante.reduce((m, p) => Math.max(m, p.horodatage), -Infinity);
  const pose = { carte, joueur, horodatage: Math.max(horodatage, dernier + 1) };
  const surchargeCourante: SurchargePli = { ...etat.surchargeCourante, joueurs: { ...(etat.surchargeCourante.joueurs ?? {}), [carte]: joueur } };
  return poser({ ...etat, surchargeCourante }, pose);
}
