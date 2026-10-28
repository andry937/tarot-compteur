import { decoder } from "@/domain/cartes/cartes";
import type { Alerte, PliJoue } from "./machinePli";

type Famille = ReturnType<typeof decoder>["famille"];

const NOM_FAMILLE: Record<string, string> = {
  atout: "l'atout",
  coeur: "cœur",
  carreau: "carreau",
  trefle: "trèfle",
  pique: "pique",
};

/**
 * Détecte après coup les fautes possibles (renonce, défaut de surcoupe). Une faute n'est
 * pas visible sur le moment (on ne voit pas la main) : on la déduit quand un joueur
 * pose plus tard une carte qu'il aurait dû jouer plus tôt, puisque sa main ne s'enrichit
 * pas pendant le jeu. L'Excuse est toujours exemptée. Renvoie des alertes d'avertissement.
 */
export function detecterRenonces(plis: PliJoue[]): Alerte[] {
  const alertes: Alerte[] = [];
  // Familles que le joueur a montré ne plus avoir (avec le n° du pli).
  const manques = new Map<number, Map<Famille, number>>();
  // Surcoupe non faite : atout à dépasser pour prouver la faute.
  const nonMonte = new Map<number, { pli: number; seuil: number }>();

  for (const pli of plis) {
    const entameFamille = pli.poses.map((p) => decoder(p.carte).famille).find((f) => f !== "excuse");
    if (!entameFamille) continue;
    let meilleurAtout = 0;
    for (const pose of pli.poses) {
      const c = decoder(pose.carte);
      if (c.famille === "excuse") continue;
      const m = manques.get(pose.joueur) ?? new Map<Famille, number>();
      manques.set(pose.joueur, m);

      const vuAvant = m.get(c.famille);
      if (vuAvant !== undefined && vuAvant < pli.numero) {
        alertes.push({
          cle: `renonce-${pose.joueur}-${c.famille}-${pli.numero}`,
          gravite: "avertissement",
          pli: pli.numero,
          message: `Renonce possible : le joueur ${pose.joueur + 1} n'avait plus de ${NOM_FAMILLE[c.famille]} au pli ${vuAvant} mais en joue au pli ${pli.numero}.`,
        });
      }
      if (c.famille !== entameFamille) {
        if (!m.has(entameFamille)) m.set(entameFamille, pli.numero);
        if (c.famille !== "atout" && !m.has("atout")) m.set("atout", pli.numero);
      }
      if (c.famille === "atout") {
        const pendant = nonMonte.get(pose.joueur);
        if (pendant && pli.numero > pendant.pli && c.rang > pendant.seuil) {
          alertes.push({
            cle: `surcoupe-${pose.joueur}-${pendant.pli}`,
            gravite: "avertissement",
            pli: pli.numero,
            message: `Défaut de surcoupe possible : le joueur ${pose.joueur + 1} a joué un atout plus faible que ${pendant.seuil} au pli ${pendant.pli} alors qu'il en avait un plus fort.`,
          });
          nonMonte.delete(pose.joueur);
        }
        if (meilleurAtout > 0 && c.rang < meilleurAtout && !nonMonte.has(pose.joueur)) {
          nonMonte.set(pose.joueur, { pli: pli.numero, seuil: meilleurAtout });
        }
        meilleurAtout = Math.max(meilleurAtout, c.rang);
      }
    }
  }
  return alertes;
}
