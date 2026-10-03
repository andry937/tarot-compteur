import { useState } from "react";
import { resoudreOuCreerFiches } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { CLE_ROSTER } from "@/lib/storage/stockage";

/** Trombinoscope des joueurs : état en mémoire + persistance dans `tarot:joueurs:v2`. */
export function useRegistre() {
  const [roster, setRoster] = useState<Fiche[]>([]);

  const persisterRoster = async (suivant: Fiche[]) => {
    setRoster(suivant);
    try {
      await window.storage.set(CLE_ROSTER, JSON.stringify(suivant));
    } catch (e) {
      console.error("Sauvegarde du trombinoscope impossible", e);
    }
  };

  /** Rapproche ou crée les fiches pour ces noms, persiste le registre, renvoie les identifiants. */
  const majRoster = async (noms: string[]): Promise<string[]> => {
    const { ids, roster: suivant } = resoudreOuCreerFiches(noms, roster);
    await persisterRoster(suivant);
    return ids;
  };

  return { roster, setRoster, persisterRoster, majRoster };
}
