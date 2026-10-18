import { comparer, makeAutoObservable, observable, reaction, runInAction, type IReactionDisposer } from "mobx";
import { resumerDonnees } from "@/domain/score/regles";
import { resoudreNom, genId, joueursActuellementAssis } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { sansDoublons } from "@/lib/storage/archives";
import { CLE_PARTIE, CLE_ROSTER, CLE_HISTORIQUE, CLE_TABLES, cleTable, lireJson } from "@/lib/storage/stockage";
import type { Partie, ChoixDonneur, TirageEnCours, HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import { RegistreStore } from "@/stores/RegistreStore";
import { HistoriqueStore } from "@/stores/HistoriqueStore";
import { TableStore } from "@/stores/TableStore";

/** Migration unique : l'ancien emplacement à une seule table active
 * devient une table ouverte parmi d'autres, puis est abandonné. */
async function migrerAncienneTable() {
  const p = await lireJson<Partial<ArchiveRecord>>(CLE_PARTIE); // absent : rien à migrer
  if (!p?.joueursId?.length) return;
  const id = genId();
  const joueursId: string[] = p.joueursId;
  const joueursNomFige: string[] = p.joueursNomFige || joueursId.map(() => "?");
  const record: ArchiveRecord = {
    joueursId,
    joueursNomFige,
    parDonne: p.parDonne || joueursId.length,
    depart: p.depart || 0,
    donnes: p.donnes || [],
    annulations: p.annulations || [],
  };
  await window.storage.set(cleTable(id), JSON.stringify(record));
  const { totaux } = resumerDonnees(record.donnes, joueursId.length);
  const resume: HistoriqueEntree = {
    id,
    date: new Date().toISOString(),
    joueurs: joueursNomFige,
    joueursId,
    parDonne: record.parDonne,
    nbDonnes: record.donnes.length,
    totaux,
  };
  const indexActuel = (await lireJson<HistoriqueEntree[]>(CLE_TABLES)) ?? [];
  await window.storage.set(CLE_TABLES, JSON.stringify([resume, ...indexActuel]));
  await window.storage.delete(CLE_PARTIE);
}

/**
 * État global de l'app (un par montage d'<App/>, fourni par contexte — voir
 * stores/contexte.tsx). Les actions ne naviguent jamais : elles renvoient
 * leur résultat et c'est l'écran appelant qui choisit la route suivante.
 */
export class RootStore {
  readonly registre = new RegistreStore();
  readonly historique = new HistoriqueStore();
  readonly table = new TableStore(this.registre);

  pret = false;
  // Une lecture a échoué au démarrage (≠ clé absente) : on n'écrit RIEN tant que
  // les données n'ont pas été relues, sinon l'état vide écraserait les vraies.
  erreurChargement = false;
  avertissement: string | null = null;
  /** Index des tables ouvertes (`tarot:tables`). */
  tablesIndex: HistoriqueEntree[] = [];
  /** Tirage du donneur en cours — jamais persisté. */
  tirage: TirageEnCours | null = null;

  private chargementLance = false;
  private reactions: IReactionDisposer[] = [];

  constructor() {
    makeAutoObservable<this, "chargementLance" | "reactions">(
      this,
      {
        registre: false,
        historique: false,
        table: false,
        chargementLance: false,
        reactions: false,
        tablesIndex: observable.ref,
        tirage: observable.ref,
      },
      { autoBind: true }
    );
  }

  /** Branche les sauvegardes automatiques et lance le chargement initial (une seule fois). */
  demarrer() {
    const t = this.table;
    this.reactions = [
      // Index des tables ouvertes.
      reaction(
        () => (this.pret ? this.tablesIndex : null),
        (idx) => {
          if (!idx) return;
          window.storage
            .set(CLE_TABLES, JSON.stringify(idx))
            .catch((e) => console.error("Sauvegarde de l'index des tables impossible", e));
        }
      ),
      // Table active.
      reaction(
        () => (this.pret && t.id && t.enregistrement ? [t.id, JSON.stringify(t.enregistrement)] : null),
        (v) => {
          if (!v) return;
          window.storage.set(cleTable(v[0]), v[1]).catch((e) => console.error("Sauvegarde impossible", e));
        },
        { equals: comparer.structural }
      ),
      // Garde l'entrée de la table active dans l'index (nbDonnes/totaux
      // affichés dans la liste des tables ouvertes) synchronisée avec ses donnes.
      reaction(
        () => (this.pret && t.id ? { id: t.id, nbDonnes: t.donnes.length, totaux: t.resume.totaux } : null),
        (v) => v && this.synchroniserIndex(v.id, v.nbDonnes, v.totaux),
        { equals: comparer.structural }
      ),
    ];
    if (!this.chargementLance) {
      this.chargementLance = true;
      void this.charger();
    }
  }

  arreter() {
    this.reactions.forEach((dispose) => dispose());
    this.reactions = [];
  }

  private async charger() {
    try {
      await migrerAncienneTable();
      // En parallèle : un stockage lent ou mal configuré ne doit bloquer
      // l'affichage que d'un délai, pas de trois mis bout à bout.
      const [tables, ros, hist] = await Promise.all([
        lireJson<HistoriqueEntree[]>(CLE_TABLES),
        lireJson<Fiche[]>(CLE_ROSTER),
        lireJson<HistoriqueEntree[]>(CLE_HISTORIQUE),
      ]);
      runInAction(() => {
        // null = clé absente (premier lancement) : on garde l'état vide d'origine.
        if (tables) this.tablesIndex = tables;
        if (ros) this.registre.remplacer(ros);
        if (hist) this.historique.remplacer(sansDoublons(hist));
        this.pret = true;
      });
    } catch (e) {
      console.error("Lecture du stockage impossible", e);
      runInAction(() => (this.erreurChargement = true));
    }
  }

  private synchroniserIndex(id: string, nbDonnes: number, totaux: number[]) {
    const joueurs = this.table.joueurs;
    this.tablesIndex = this.tablesIndex.map((h) => (h.id === id ? { ...h, nbDonnes, totaux, joueurs } : h));
  }

  /** Joueurs déjà assis à une table ouverte : interdits sur une nouvelle table. */
  get joueursIndisponibles(): string[] {
    return [...joueursActuellementAssis(this.tablesIndex)].map((id) => resoudreNom(id, this.registre.roster, "?"));
  }

  fermerAvertissement() {
    this.avertissement = null;
  }

  /** Enregistre les noms au registre et prépare le tirage ; renvoie l'id de la future table. */
  async validerComposition(noms: string[], parDonne: number): Promise<string> {
    const ids = await this.registre.majRoster(noms);
    const id = genId();
    runInAction(() => (this.tirage = { id, joueurs: noms, joueursId: ids, parDonne }));
    return id;
  }

  annulerTirage() {
    this.tirage = null;
  }

  /**
   * Ouvre la table avec l'ordre des sièges, les joueurs au repos et le donneur choisis
   * (indices dans `tirage.joueurs`) ; renvoie son id, ou `null` s'il n'y avait pas de tirage.
   * Quand des joueurs sont au repos, les sièges sont réordonnés pour que le donneur ouvre la
   * fenêtre de la première donne, suivi des joueurs à table dans l'ordre, puis de ceux au repos.
   */
  async validerTirage(choix: ChoixDonneur): Promise<string | null> {
    const tirage = this.tirage;
    if (!tirage) return null;
    const id = tirage.id;
    const { ordre, auRepos, donneur } = choix;
    const jouant = ordre.filter((i) => !auRepos.includes(i));
    const reposOrdonne = ordre.filter((i) => auRepos.includes(i));
    const p = Math.max(0, jouant.indexOf(donneur));
    const sieges =
      auRepos.length > 0 ? [...jouant.slice(p), ...jouant.slice(0, p), ...reposOrdonne] : ordre;
    const nouvelle: Partie = {
      joueursId: sieges.map((i) => tirage.joueursId[i]),
      joueursNomFige: sieges.map((i) => tirage.joueurs[i]),
      parDonne: tirage.parDonne,
      depart: auRepos.length > 0 ? 0 : Math.max(0, ordre.indexOf(donneur)),
    };
    this.table.activer(id, nouvelle);
    this.tirage = null;
    try {
      await window.storage.set(cleTable(id), JSON.stringify(this.table.enregistrement));
      const resume: HistoriqueEntree = {
        id,
        date: new Date().toISOString(),
        joueurs: nouvelle.joueursNomFige,
        joueursId: nouvelle.joueursId,
        parDonne: tirage.parDonne,
        nbDonnes: 0,
        totaux: new Array(tirage.joueurs.length).fill(0),
      };
      runInAction(() => (this.tablesIndex = [resume, ...this.tablesIndex]));
    } catch (e) {
      console.error("Création de la table impossible", e);
    }
    return id;
  }

  /**
   * Clôture la table active : l'archive si des donnes ont été jouées, puis la
   * retire des tables ouvertes. `false` si l'archivage a échoué — la table
   * reste alors ouverte et active (on ne quitte pas l'écran).
   */
  async cloturerPartie(): Promise<boolean> {
    const t = this.table;
    const id = t.id;
    if (id && t.partie) {
      if (t.donnes.length > 0) {
        const resume: HistoriqueEntree = {
          id,
          date: new Date().toISOString(),
          joueurs: t.joueurs,
          joueursId: t.partie.joueursId,
          parDonne: t.partie.parDonne,
          nbDonnes: t.donnes.length,
          totaux: t.resume.totaux,
        };
        try {
          await this.historique.archiver(id, resume, { ...t.partie, donnes: t.donnes, annulations: t.annulations });
        } catch (e) {
          // Surtout ne pas supprimer la table : l'archive n'existe peut-être pas,
          // et ce serait la seule copie des donnes. Elle reste ouverte, on réessaie.
          console.error("Archivage impossible", e);
          runInAction(
            () =>
              (this.avertissement =
                "Archivage impossible : la table reste ouverte, réessayez la clôture une fois la connexion rétablie.")
          );
          return false;
        }
      }
      try {
        await window.storage.delete(cleTable(id));
      } catch (e) {
        /* rien à supprimer */
      }
      runInAction(() => (this.tablesIndex = this.tablesIndex.filter((h) => h.id !== id)));
    }
    t.desactiver();
    return true;
  }
}
