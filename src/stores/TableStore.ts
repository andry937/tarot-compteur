import { makeAutoObservable, observable, runInAction } from "mobx";
import { resumerDonnees } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import { resoudreNom } from "@/domain/joueurs/identite";
import type { Partie, Annulation, ArchiveRecord } from "@/domain/types";
import { cleTable } from "@/lib/storage/stockage";
import type { RegistreStore } from "@/stores/RegistreStore";

/**
 * Table ouverte dans cet onglet : sa composition, ses donnes, ses annulations
 * et le brouillon de la main en cours. Une seule table est active par onglet ;
 * les autres tables ouvertes ne sont chargées que lorsqu'on les visite. La
 * sauvegarde automatique dans `tarot:table:{id}` est une réaction de RootStore
 * (bloquée tant que le stockage n'a pas été relu au démarrage).
 */
export class TableStore {
  id: string | null = null;
  partie: Partie | null = null;
  donnes: Donne[] = [];
  annulations: Annulation[] = [];
  cartesEnCours: string[] = [];
  chienEnCours: string[] = [];
  readonly registre: RegistreStore;

  constructor(registre: RegistreStore) {
    this.registre = registre;
    // Données en observable.ref (tableaux JS ordinaires remplacés en entier),
    // voir RegistreStore.
    makeAutoObservable(
      this,
      {
        registre: false,
        partie: observable.ref,
        donnes: observable.ref,
        annulations: observable.ref,
        cartesEnCours: observable.ref,
        chienEnCours: observable.ref,
      },
      { autoBind: true }
    );
  }

  /** Noms affichés, dans l'ordre des sièges (fusions et renommages résolus). */
  get joueurs(): string[] {
    const p = this.partie;
    return p ? p.joueursId.map((id, i) => resoudreNom(id, this.registre.roster, p.joueursNomFige[i])) : [];
  }

  get nbTotal() {
    return this.joueurs.length;
  }

  /** Totaux, donnes jouées et cumuls par joueur, recalculés seulement quand les donnes changent. */
  get resume() {
    return resumerDonnees(this.donnes, this.nbTotal);
  }

  /** Ce qui est écrit dans `tarot:table:{id}`, ou `null` sans table active. */
  get enregistrement(): ArchiveRecord | null {
    if (!this.partie) return null;
    return {
      ...this.partie,
      donnes: this.donnes,
      annulations: this.annulations,
      cartesEnCours: this.cartesEnCours,
      chienEnCours: this.chienEnCours,
    };
  }

  /** Active une table dans cet onglet (nouvelle table ou table relue). */
  activer(id: string, p: Partie, rec: Partial<ArchiveRecord> = {}) {
    this.partie = p;
    this.donnes = rec.donnes || [];
    this.annulations = rec.annulations || [];
    this.cartesEnCours = rec.cartesEnCours || [];
    this.chienEnCours = rec.chienEnCours || [];
    this.id = id;
  }

  /** Oublie la table active dans cet onglet, sans rien toucher au stockage. */
  desactiver() {
    this.partie = null;
    this.donnes = [];
    this.annulations = [];
    this.cartesEnCours = [];
    this.chienEnCours = [];
    this.id = null;
  }

  /** Charge à la demande la table `id` (route /partie/:id) si elle n'est pas déjà active.
   * `false` si elle est introuvable (lien mort, table déjà fermée ailleurs). */
  async charger(id: string): Promise<boolean> {
    if (this.id === id) return true;
    try {
      const r = await window.storage.get(cleTable(id));
      const rec: ArchiveRecord = JSON.parse(r.value);
      runInAction(() =>
        this.activer(
          id,
          {
            joueursId: rec.joueursId,
            joueursNomFige: rec.joueursNomFige,
            parDonne: rec.parDonne,
            depart: rec.depart || 0,
          },
          rec
        )
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  modifierCartes(cartes: string[]) {
    this.cartesEnCours = cartes;
  }

  modifierChien(chien: string[]) {
    this.chienEnCours = chien;
  }

  ajouterDonne(d: Donne) {
    // Les cartes notées pendant la main sont rattachées à la donne inscrite.
    this.donnes = [
      ...this.donnes,
      {
        ...d,
        ...(this.cartesEnCours.length ? { cartesJouees: this.cartesEnCours } : {}),
        ...(this.chienEnCours.length ? { chien: this.chienEnCours } : {}),
      },
    ];
    this.cartesEnCours = [];
    this.chienEnCours = [];
  }

  modifierDonne(i: number, d: Donne) {
    this.donnes = this.donnes.map((old, k) => (k === i ? d : old));
  }

  effacerDonne(i: number) {
    this.donnes = this.donnes.filter((_, k) => k !== i);
  }

  ajouterAnnulation(a: Annulation) {
    this.annulations = [...this.annulations, a];
    this.cartesEnCours = [];
    this.chienEnCours = []; // la donne est rejouée : le brouillon n'a plus de sens
  }
}
