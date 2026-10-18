/**
 * Store MobX de l'index des parties closes.
 * @module
 */

import { makeAutoObservable, observable, runInAction } from "mobx";
import { invaliderArchive } from "@/lib/storage/archives";
import { CLE_HISTORIQUE, cleArchive } from "@/lib/storage/stockage";
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";

/** Index des parties closes (`tarot:historique`) ; les archives complètes sont lues à la demande. */
export class HistoriqueStore {
  /** Index léger des parties archivées, remplacé en entier à chaque modification. */
  index: HistoriqueEntree[] = [];

  constructor() {
    makeAutoObservable(this, { index: observable.ref }, { autoBind: true });
  }

  /** Remplace l'index en mémoire, sans l'écrire (chargement initial). */
  remplacer(suivant: HistoriqueEntree[]) {
    this.index = suivant;
  }

  /** Écrit l'archive puis l'index ; lève si l'une des deux écritures échoue. */
  async archiver(id: string, resume: HistoriqueEntree, record: ArchiveRecord) {
    invaliderArchive(id);
    await window.storage.set(cleArchive(id), JSON.stringify(record));
    // Une table déjà archivée (clôturée depuis un autre appareil) remplace
    // son entrée au lieu de la dupliquer.
    const suivant = [resume, ...this.index.filter((h) => h.id !== id)];
    await window.storage.set(CLE_HISTORIQUE, JSON.stringify(suivant));
    runInAction(() => (this.index = suivant));
  }

  /** Supprime l'archive et son entrée d'index ; une erreur de stockage est seulement journalisée. */
  async supprimer(id: string) {
    try {
      invaliderArchive(id);
      await window.storage.delete(cleArchive(id));
      const suivant = this.index.filter((h) => h.id !== id);
      await window.storage.set(CLE_HISTORIQUE, JSON.stringify(suivant));
      runInAction(() => (this.index = suivant));
    } catch (e) {
      console.error("Suppression de l'archive impossible", e);
    }
  }

  /** Resynchronise le résumé en cache (totaux) après modification d'une donne archivée
   * — le reste (stats, Elo) se recalcule déjà à la volée depuis `donnes`. */
  modifierTotaux(id: string, totaux: number[]) {
    this.index = this.index.map((h) => (h.id === id ? { ...h, totaux } : h));
    window.storage
      .set(CLE_HISTORIQUE, JSON.stringify(this.index))
      .catch((e) => console.error("Sauvegarde de l'historique impossible", e));
  }
}
