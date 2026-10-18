import { makeAutoObservable, observable } from "mobx";
import { resoudreOuCreerFiches } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { CLE_ROSTER } from "@/lib/storage/stockage";

/** Trombinoscope des joueurs : état en mémoire + persistance dans `tarot:joueurs:v2`. */
export class RegistreStore {
  roster: Fiche[] = [];

  constructor() {
    // observable.ref : le registre reste un tableau JS ordinaire, remplacé en
    // entier à chaque changement (les fonctions de `domain/` sont pures et
    // renvoient de nouveaux tableaux) — les composants non-observer et leurs
    // useMemo voient donc une nouvelle identité à chaque modification.
    makeAutoObservable(this, { roster: observable.ref }, { autoBind: true });
  }

  remplacer(suivant: Fiche[]) {
    this.roster = suivant;
  }

  async persister(suivant: Fiche[]) {
    this.roster = suivant;
    try {
      await window.storage.set(CLE_ROSTER, JSON.stringify(suivant));
    } catch (e) {
      console.error("Sauvegarde du trombinoscope impossible", e);
    }
  }

  /** Rapproche ou crée les fiches pour ces noms, persiste le registre, renvoie les identifiants. */
  async majRoster(noms: string[]): Promise<string[]> {
    const { ids, roster: suivant } = resoudreOuCreerFiches(noms, this.roster);
    await this.persister(suivant);
    return ids;
  }
}
