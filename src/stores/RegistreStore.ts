/**
 * Store MobX du trombinoscope des joueurs.
 * @module
 */

import { makeAutoObservable, observable } from "mobx";
import { resoudreOuCreerFiches } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { CLE_ROSTER } from "@/lib/storage/stockage";
import { ecrireFiable } from "@/lib/storage/ecriture";

/** Trombinoscope des joueurs : état en mémoire + persistance dans `tarot:joueurs:v2`. */
export class RegistreStore {
  /** Fiches des joueurs (actives, désactivées et fusionnées), remplacées en entier à chaque modification. */
  roster: Fiche[] = [];
  /** Appelé avec le résultat de chaque écriture (branché par `RootStore` sur le bandeau d'avertissement). */
  surEtatSauvegarde?: (ok: boolean, cle: string) => void;

  constructor() {
    // observable.ref : le registre reste un tableau JS ordinaire, remplacé en
    // entier à chaque changement (les fonctions de `domain/` sont pures et
    // renvoient de nouveaux tableaux) — les composants non-observer et leurs
    // useMemo voient donc une nouvelle identité à chaque modification.
    makeAutoObservable(this, { roster: observable.ref, surEtatSauvegarde: false }, { autoBind: true });
  }

  /** Remplace le registre en mémoire, sans le persister (chargement initial). */
  remplacer(suivant: Fiche[]) {
    this.roster = suivant;
  }

  /**
   * Remplace le registre puis l'écrit dans `tarot:joueurs:v2` ; une écriture qui échoue est réessayée puis signalée en bandeau.
   */
  async persister(suivant: Fiche[]) {
    this.roster = suivant;
    await ecrireFiable(CLE_ROSTER, JSON.stringify(suivant), this.surEtatSauvegarde);
  }

  /** Rapproche ou crée les fiches pour ces noms, persiste le registre, renvoie les identifiants. */
  async majRoster(noms: string[]): Promise<string[]> {
    const { ids, roster: suivant } = resoudreOuCreerFiches(noms, this.roster);
    await this.persister(suivant);
    return ids;
  }
}
