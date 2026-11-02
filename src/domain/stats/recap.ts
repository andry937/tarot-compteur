/**
 * Récap d'une soirée (une table) : podium, dernier, plus grosse donne, pire chute, plus beau contrat,
 * et le texte à partager. Calculé à la volée depuis les donnes. Aucune dépendance React.
 * @module
 */
import { CONTRATS, calculer, fmt, resumerDonnees } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";

/** Points d'un joueur sur la partie. */
export interface LigneRecap {
  /** Nom du joueur. */
  nom: string;
  /** Total de points. */
  pts: number;
}

/** Faits marquants d'une donne. */
export interface FaitRecap {
  /** Joueur concerné. */
  nom: string;
  /** Points de la donne pour ce joueur. */
  pts: number;
  /** Numéro de la donne (à partir de 1). */
  numero: number;
  /** Nom du contrat. */
  contrat: string;
}

/** Récap complet d'une partie. */
export interface Recap {
  /** Nombre de donnes inscrites. */
  nbDonnes: number;
  /** Joueurs ayant joué, du premier au dernier. */
  classement: LigneRecap[];
  /** Contrats réussis. */
  reussies: number;
  /** Contrats chutés. */
  chutees: number;
  /** Plus gros score d'un joueur sur une donne. */
  plusGrosseDonne: FaitRecap | null;
  /** Preneur qui a perdu le plus sur une chute. */
  pireChute: FaitRecap | null;
  /** Contrat réussi le plus audacieux (plus fort multiplicateur, puis plus gros score). */
  plusBeauContrat: FaitRecap | null;
  /** Preneur avec le plus de chutes (au moins 2). */
  casseur: { nom: string; chutes: number } | null;
}

const nomContrat = (id: string) => CONTRATS.find((c) => c.id === id)?.nom ?? id;

/** Calcule le récap ; `null` sans donne. `joueurs` : noms par siège, `nbTotal` : joueurs de la table, repos compris. */
export function calculerRecap(donnes: Donne[], joueurs: string[], nbTotal: number): Recap | null {
  if (donnes.length === 0) return null;
  const { totaux, jouees } = resumerDonnees(donnes, nbTotal);
  const classement = joueurs
    .map((nom, i) => ({ nom, pts: totaux[i], jouees: jouees[i] }))
    .filter((l) => l.jouees > 0)
    .sort((a, b) => b.pts - a.pts)
    .map(({ nom, pts }) => ({ nom, pts }));

  let reussies = 0;
  let chutees = 0;
  let plusGrosseDonne: FaitRecap | null = null;
  let pireChute: FaitRecap | null = null;
  let plusBeauContrat: FaitRecap | null = null;
  let meilleurMult = 0;
  const chutesParPreneur = new Map<number, number>();

  donnes.forEach((d, k) => {
    const res = calculer(d, nbTotal);
    const fait = (i: number): FaitRecap => ({
      nom: joueurs[i],
      pts: res.scores[i] as number,
      numero: k + 1,
      contrat: nomContrat(d.contrat),
    });
    res.scores.forEach((s, i) => {
      if (s !== null && s > 0 && (!plusGrosseDonne || s > plusGrosseDonne.pts)) plusGrosseDonne = fait(i);
    });
    if (res.reussi) {
      reussies += 1;
      if (res.mult > meilleurMult || (res.mult === meilleurMult && plusBeauContrat && (res.scores[d.preneur] as number) > plusBeauContrat.pts)) {
        meilleurMult = res.mult;
        plusBeauContrat = fait(d.preneur);
      }
    } else {
      chutees += 1;
      chutesParPreneur.set(d.preneur, (chutesParPreneur.get(d.preneur) ?? 0) + 1);
      const f = fait(d.preneur);
      if (!pireChute || f.pts < pireChute.pts) pireChute = f;
    }
  });

  const [pire] = [...chutesParPreneur.entries()].sort((a, b) => b[1] - a[1]);
  const casseur = pire && pire[1] >= 2 ? { nom: joueurs[pire[0]], chutes: pire[1] } : null;
  return { nbDonnes: donnes.length, classement, reussies, chutees, plusGrosseDonne, pireChute, plusBeauContrat, casseur };
}

const MEDAILLES = ["🥇", "🥈", "🥉"];

/** Un badge à citer dans le récap (déjà mis en forme : « 🏆 Le Patron »). */
export interface BadgeRecap {
  /** Nom du joueur. */
  nom: string;
  /** Titre du badge avec son pictogramme. */
  titre: string;
}

/** Texte du récap, prêt à coller dans une messagerie. */
export function texteRecap(r: Recap, options: { titre?: string; badges?: BadgeRecap[] } = {}): string {
  const lignes: string[] = [`🃏 ${options.titre ?? "Récap de la soirée"} — ${r.nbDonnes} donne${r.nbDonnes > 1 ? "s" : ""}`, ""];
  r.classement.forEach((l, i) => lignes.push(`${MEDAILLES[i] ?? `${i + 1}.`} ${l.nom} ${fmt(l.pts)}`));
  const dernier = r.classement[r.classement.length - 1];
  if (r.classement.length > 1 && dernier) lignes.push("", `💀 Dernier : ${dernier.nom}`);
  const faits: string[] = [];
  if (r.plusGrosseDonne) faits.push(`💥 Plus grosse donne : ${r.plusGrosseDonne.nom} ${fmt(r.plusGrosseDonne.pts)} (donne ${r.plusGrosseDonne.numero})`);
  if (r.pireChute) faits.push(`🪦 Pire chute : ${r.pireChute.nom}, ${r.pireChute.contrat}, ${fmt(r.pireChute.pts)} (donne ${r.pireChute.numero})`);
  if (r.plusBeauContrat) faits.push(`🚀 Plus beau contrat : ${r.plusBeauContrat.nom}, ${r.plusBeauContrat.contrat} (donne ${r.plusBeauContrat.numero})`);
  if (r.casseur) faits.push(`🔨 Le plus de chutes : ${r.casseur.nom} (${r.casseur.chutes})`);
  faits.push(`✅ ${r.reussies} contrat${r.reussies > 1 ? "s" : ""} réussi${r.reussies > 1 ? "s" : ""} · ❌ ${r.chutees} chuté${r.chutees > 1 ? "s" : ""}`);
  lignes.push("", ...faits);
  if (options.badges && options.badges.length > 0) {
    lignes.push("", ...options.badges.map((b) => `${b.titre} : ${b.nom}`));
  }
  return lignes.join("\n");
}
