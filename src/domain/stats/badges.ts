/**
 * Badges de début de partie : chaque joueur à table peut recevoir un titre (Kamikaze, Pigeon…)
 * calculé une seule fois d'après l'historique archivé, puis figé dans la table. Aucune dépendance React.
 * @module
 */
import { calculer, resumerDonnees } from "@/domain/score/regles";
import { resoudreFiche } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { calculerStatsJoueur, roleDe } from "@/domain/stats/stats";
import type { PartieAnalysee, StatsJoueur } from "@/domain/stats/stats";
import { calculerClassementElo } from "@/domain/stats/elo";

/** Identifiant d'un badge. */
export type BadgeId =
  | "patron"
  | "meneur"
  | "kamikaze"
  | "sniper"
  | "maudit"
  | "pigeon"
  | "meilleur_ami"
  | "solitaire"
  | "parrain"
  | "petit_malin"
  | "mur"
  | "attaquant"
  | "mouton"
  | "recrue";

/** Présentation d'un badge. */
export interface BadgeDef {
  /** Pictogramme. */
  emoji: string;
  /** Titre affiché. */
  nom: string;
}

/** Libellés des badges. */
export const BADGES: Record<BadgeId, BadgeDef> = {
  patron: { emoji: "🏆", nom: "Le Patron" },
  meneur: { emoji: "🥇", nom: "Le Meneur" },
  kamikaze: { emoji: "🚀", nom: "Le Kamikaze" },
  sniper: { emoji: "🎯", nom: "Le Sniper" },
  maudit: { emoji: "💀", nom: "Le Maudit" },
  pigeon: { emoji: "🕊️", nom: "Le Pigeon" },
  meilleur_ami: { emoji: "🤗", nom: "Le Meilleur Ami" },
  solitaire: { emoji: "🃏", nom: "Le Solitaire" },
  parrain: { emoji: "🤝", nom: "Le Parrain" },
  petit_malin: { emoji: "🐣", nom: "Petit Malin" },
  mur: { emoji: "🛡️", nom: "Le Meilleur Défenseur" },
  attaquant: { emoji: "⚔️", nom: "Le Meilleur Attaquant" },
  mouton: { emoji: "🐑", nom: "Le Mouton" },
  recrue: { emoji: "🌱", nom: "Recrue" },
};

/** Badge attribué à un joueur de la table, avec sa preuve en chiffres. */
export interface BadgeAttribue {
  /** Identifiant du joueur tel qu'il figure dans `Partie.joueursId`. */
  joueurId: string;
  /** Badge reçu. */
  badge: BadgeId;
  /** Preuve affichée sous le badge (ex. « 5 Garde sans/contre sur 12 prises »). */
  detail: string;
}

/** Nombre de donnes en dessous duquel un joueur n'est qu'une Recrue. */
export const DONNES_RECRUE = 20;

/** Mesures d'un joueur, calculées sur tout l'historique. */
interface Mesures {
  stats: StatsJoueur;
  prises: number;
  grosContrats: number;
  autoAppels: number;
  petitsAuBout: number;
  partiesGagnees: number;
  partiesEligibles: number;
  note: number;
}

/** Critère d'attribution : le meilleur joueur de la table, s'il passe le seuil et se détache nettement. */
interface Critere {
  badge: BadgeId;
  sens: "max" | "min";
  /** Valeur comparée, ou `null` si le joueur n'a pas assez joué pour concourir. */
  valeur: (m: Mesures) => number | null;
  /** Valeur à atteindre (≥ pour « max », ≤ pour « min ») : un plancher de bon sens, pas un niveau absolu — les titres « meilleur… » se jouent entre les joueurs de la table. */
  seuil: number;
  /** Écart minimal avec le deuxième concurrent. */
  ecart: number;
  detail: (m: Mesures) => string;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Un joueur peut cumuler plusieurs badges ; la liste est dans l'ordre d'affichage (les plus prestigieux d'abord). */
const CRITERES: Critere[] = [
  {
    badge: "patron",
    sens: "max",
    valeur: (m) => (m.stats.donneesJouees >= 50 ? m.note : null),
    seuil: 1,
    ecart: 5,
    detail: (m) => `Meilleure note du classement : ${m.note}`,
  },
  {
    badge: "meneur",
    sens: "max",
    valeur: (m) => (m.partiesEligibles >= 5 ? m.partiesGagnees : null),
    seuil: 2,
    ecart: 1,
    detail: (m) => `${m.partiesGagnees} parties terminées en tête sur ${m.partiesEligibles}`,
  },
  {
    badge: "kamikaze",
    sens: "max",
    valeur: (m) => (m.prises >= 5 ? m.grosContrats / m.prises : null),
    seuil: 0.01,
    ecart: 0.03,
    detail: (m) => `${m.grosContrats} Garde sans/contre sur ${m.prises} prises`,
  },
  {
    badge: "sniper",
    sens: "max",
    valeur: (m) => (m.prises >= 5 ? m.stats.appelsReussis.length / m.prises : null),
    seuil: 0,
    ecart: 0.03,
    detail: (m) => `${pct(m.stats.appelsReussis.length / m.prises)} de contrats réussis (${m.prises} prises)`,
  },
  {
    badge: "maudit",
    sens: "min",
    valeur: (m) => (m.prises >= 5 ? m.stats.appelsReussis.length / m.prises : null),
    seuil: 1,
    ecart: 0.03,
    detail: (m) => `${pct(m.stats.appelsReussis.length / m.prises)} de contrats réussis (${m.prises} prises)`,
  },
  {
    badge: "pigeon",
    sens: "max",
    valeur: (m) => {
      const n = m.stats.parRole.appele.donnes;
      return n >= 5 ? (n - m.stats.parRole.appele.victoires) / n : null;
    },
    seuil: 0,
    ecart: 0.05,
    detail: (m) =>
      `contrat chuté ${m.stats.parRole.appele.donnes - m.stats.parRole.appele.victoires} fois sur ${m.stats.parRole.appele.donnes} en étant appelé`,
  },
  {
    badge: "meilleur_ami",
    sens: "max",
    valeur: (m) => {
      const n = m.stats.parRole.appele.donnes;
      return n >= 5 ? m.stats.parRole.appele.victoires / n : null;
    },
    seuil: 0,
    ecart: 0.05,
    detail: (m) =>
      `contrat réussi ${m.stats.parRole.appele.victoires} fois sur ${m.stats.parRole.appele.donnes} en étant appelé`,
  },
  {
    badge: "solitaire",
    sens: "max",
    valeur: (m) => (m.prises >= 5 ? m.autoAppels / m.prises : null),
    seuil: 0.01,
    ecart: 0.02,
    detail: (m) => `s'est appelé lui-même ${m.autoAppels} fois sur ${m.prises} prises`,
  },
  {
    badge: "parrain",
    sens: "max",
    valeur: (m) => (m.stats.donneesJouees >= DONNES_RECRUE ? m.stats.parRole.appele.donnes / m.stats.donneesJouees : null),
    seuil: 0.01,
    ecart: 0.01,
    detail: (m) => `appelé ${m.stats.parRole.appele.donnes} fois sur ${m.stats.donneesJouees} donnes`,
  },
  {
    badge: "petit_malin",
    sens: "max",
    valeur: (m) => (m.stats.donneesJouees >= DONNES_RECRUE ? m.petitsAuBout / m.stats.donneesJouees : null),
    seuil: 0.003,
    ecart: 0.003,
    detail: (m) => `${m.petitsAuBout} petits au bout pour son camp`,
  },
  {
    badge: "mur",
    sens: "max",
    valeur: (m) => {
      const n = m.stats.parRole.defense.donnes;
      return n >= 15 ? m.stats.parRole.defense.victoires / n : null;
    },
    seuil: 0,
    ecart: 0.02,
    detail: (m) =>
      `a fait chuter l'attaque ${m.stats.parRole.defense.victoires} fois sur ${m.stats.parRole.defense.donnes} en défense`,
  },
  {
    badge: "attaquant",
    sens: "max",
    valeur: (m) => {
      const n = m.stats.parRole.preneur.donnes + m.stats.parRole.appele.donnes;
      return n >= 15 ? (m.stats.parRole.preneur.victoires + m.stats.parRole.appele.victoires) / n : null;
    },
    seuil: 0,
    ecart: 0.02,
    detail: (m) =>
      `contrat réussi ${m.stats.parRole.preneur.victoires + m.stats.parRole.appele.victoires} fois sur ${m.stats.parRole.preneur.donnes + m.stats.parRole.appele.donnes} en attaque`,
  },
  {
    badge: "mouton",
    sens: "min",
    valeur: (m) => (m.stats.donneesJouees >= 30 ? m.prises / m.stats.donneesJouees : null),
    seuil: 0.15,
    ecart: 0.03,
    detail: (m) => `${m.prises} prises sur ${m.stats.donneesJouees} donnes`,
  },
];

/** Mesures d'un joueur (identifiant de fiche déjà résolu) sur des parties dont les identifiants sont résolus. */
function mesurer(id: string, parties: PartieAnalysee[], note: number): Mesures {
  const stats = calculerStatsJoueur(id, parties);
  const m: Mesures = {
    stats,
    prises: stats.appelsReussis.length + stats.appelsEchoues.length,
    grosContrats: [...stats.appelsReussis, ...stats.appelsEchoues].filter(
      (a) => a.contrat === "garde_sans" || a.contrat === "garde_contre"
    ).length,
    autoAppels: 0,
    petitsAuBout: 0,
    partiesGagnees: 0,
    partiesEligibles: 0,
    note,
  };
  parties.forEach((p) => {
    const idx = p.joueursId.indexOf(id);
    if (idx === -1) return;
    const n = p.joueursId.length;
    p.donnes.forEach((d) => {
      const res = calculer(d, n);
      const role = roleDe(d, res, idx);
      if (role === "repos") return;
      const camp = role === "defense" ? "defense" : "attaque";
      if (d.petitAuBout === camp) m.petitsAuBout += 1;
      if (role === "preneur" && res.table.length === 5 && d.appele === d.preneur) m.autoAppels += 1;
    });
    if (p.donnes.length >= 5) {
      const { totaux, jouees } = resumerDonnees(p.donnes, n);
      if (jouees[idx] > 0) {
        m.partiesEligibles += 1;
        const max = Math.max(...totaux.filter((_, i) => jouees[i] > 0));
        const enTete = totaux.filter((t, i) => jouees[i] > 0 && t === max).length;
        if (totaux[idx] === max && enTete === 1) m.partiesGagnees += 1;
      }
    }
  });
  return m;
}

/**
 * Attribue les badges aux joueurs d'une table d'après l'historique archivé.
 * `joueursId` : identifiants des sièges (fusions résolues via `roster`). Un joueur peut cumuler plusieurs
 * badges ; celui de moins de `DONNES_RECRUE` donnes est « Recrue » et ne concourt pour rien d'autre ; chaque badge va au meilleur
 * de la table seulement s'il passe le seuil et se détache nettement du deuxième.
 */
export function attribuerBadges(joueursId: string[], parties: PartieAnalysee[], roster: Fiche[]): BadgeAttribue[] {
  const finaux = joueursId.map((id) => resoudreFiche(id, roster)?.id ?? id);
  const resolues = parties.map((p) => ({
    ...p,
    joueursId: p.joueursId.map((id) => resoudreFiche(id, roster)?.id ?? id),
  }));
  const elo = calculerClassementElo(parties, roster);
  const mesures = finaux.map((f) => mesurer(f, resolues, elo.find((e) => e.id === f)?.note ?? 0));

  const resultat: BadgeAttribue[] = [];
  const recrues = mesures.map((m) => m.stats.donneesJouees < DONNES_RECRUE);
  recrues.forEach((r, i) => {
    if (r) {
      resultat.push({
        joueurId: joueursId[i],
        badge: "recrue",
        detail: `${mesures[i].stats.donneesJouees} donnes jouées`,
      });
    }
  });

  CRITERES.forEach((c) => {
    const concurrents = mesures
      .map((m, i) => ({ i, v: recrues[i] ? null : c.valeur(m) }))
      .filter((x): x is { i: number; v: number } => x.v !== null)
      .sort((a, b) => (c.sens === "max" ? b.v - a.v : a.v - b.v));
    const premier = concurrents[0];
    if (!premier) return;
    const passeSeuil = c.sens === "max" ? premier.v >= c.seuil : premier.v <= c.seuil;
    const second = concurrents[1];
    const detache = !second || Math.abs(premier.v - second.v) >= c.ecart;
    if (!passeSeuil || !detache) return;
    resultat.push({ joueurId: joueursId[premier.i], badge: c.badge, detail: c.detail(mesures[premier.i]) });
  });
  return resultat;
}
