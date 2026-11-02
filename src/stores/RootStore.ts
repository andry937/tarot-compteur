/**
 * Store racine MobX : chargement initial, sauvegardes automatiques, index des tables, composition, tirage et clôture.
 * @module
 */

import { comparer, makeAutoObservable, observable, reaction, runInAction, type IReactionDisposer } from "mobx";
import { resumerDonnees } from "@/domain/score/regles";
import { resoudreNom, genId, joueursActuellementAssis } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { sansDoublons, chargerParties } from "@/lib/storage/archives";
import { attribuerBadges } from "@/domain/stats/badges";
import type { BadgeAttribue } from "@/domain/stats/badges";
import { CLE_PARTIE, CLE_ROSTER, CLE_HISTORIQUE, CLE_TABLES, cleTable, lireJson } from "@/lib/storage/stockage";
import type { Partie, ChoixDonneur, TirageEnCours, HistoriqueEntree, ArchiveRecord, AnnonceFin } from "@/domain/types";
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
  /** Trombinoscope des joueurs. */
  readonly registre = new RegistreStore();
  /** Index des parties archivées. */
  readonly historique = new HistoriqueStore();
  /** Table active de cet onglet. */
  readonly table = new TableStore(this.registre);

  /** `true` une fois le stockage relu ; tant que c'est faux, aucune sauvegarde n'est écrite. */
  pret = false;
  // Une lecture a échoué au démarrage (≠ clé absente) : on n'écrit RIEN tant que
  // les données n'ont pas été relues, sinon l'état vide écraserait les vraies.
  /** `true` si la lecture initiale du stockage a échoué. */
  erreurChargement = false;
  /** Message d'avertissement affiché en bandeau, ou `null`. */
  avertissement: string | null = null;
  /** Index des tables ouvertes (`tarot:tables`). */
  tablesIndex: HistoriqueEntree[] = [];
  /** Tirage du donneur en cours — jamais persisté. */
  tirage: TirageEnCours | null = null;
  /** Dernière partie clôturée, pour l'écran d'annonce de fin de partie — jamais persistée. */
  annonceFin: AnnonceFin | null = null;

  private chargementLance = false;
  private badgesEnAttente: Promise<void> | null = null;
  private reactions: IReactionDisposer[] = [];

  constructor() {
    makeAutoObservable<this, "chargementLance" | "reactions" | "badgesEnAttente">(
      this,
      {
        registre: false,
        historique: false,
        table: false,
        chargementLance: false,
        reactions: false,
        badgesEnAttente: false,
        tablesIndex: observable.ref,
        tirage: observable.ref,
        annonceFin: observable.ref,
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
        () =>
          this.pret && t.id && t.partie
            ? { id: t.id, nbDonnes: t.donnes.length, totaux: t.resume.totaux, joueursId: t.partie.joueursId }
            : null,
        (v) => v && this.synchroniserIndex(v.id, v.nbDonnes, v.totaux, v.joueursId),
        { equals: comparer.structural }
      ),
    ];
    if (!this.chargementLance) {
      this.chargementLance = true;
      void this.charger();
    }
  }

  /** Débranche les sauvegardes automatiques. */
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

  private synchroniserIndex(id: string, nbDonnes: number, totaux: number[], joueursId: string[]) {
    const joueurs = this.table.joueurs;
    this.tablesIndex = this.tablesIndex.map((h) =>
      h.id === id ? { ...h, nbDonnes, totaux, joueurs, joueursId } : h
    );
  }

  /** Joueurs déjà assis à une table ouverte : interdits sur une nouvelle table. */
  get joueursIndisponibles(): string[] {
    return [...joueursActuellementAssis(this.tablesIndex)].map((id) => resoudreNom(id, this.registre.roster, "?"));
  }

  /** Masque le bandeau d'avertissement. */
  fermerAvertissement() {
    this.avertissement = null;
  }

  /** Enregistre les noms au registre et prépare le tirage ; renvoie l'id de la future table. */
  async validerComposition(noms: string[], parDonne: number): Promise<string> {
    const ids = await this.registre.majRoster(noms);
    const id = genId();
    runInAction(() => (this.tirage = { id, joueurs: noms, joueursId: ids, parDonne }));
    // En arrière-plan : l'écran du donneur s'ouvre tout de suite, les badges s'y ajoutent à l'arrivée.
    this.badgesEnAttente = this.calculerBadges(ids).then((badges) =>
      runInAction(() => {
        if (badges && this.tirage?.id === id) this.tirage = { ...this.tirage, badges };
      })
    );
    return id;
  }

  /** Badges des joueurs d'après l'historique archivé ; `undefined` si l'historique est illisible. */
  private async calculerBadges(joueursId: string[]): Promise<BadgeAttribue[] | undefined> {
    try {
      const parties = await chargerParties(this.historique.index);
      return attribuerBadges(joueursId, parties, this.registre.roster);
    } catch (e) {
      console.error("Calcul des badges impossible", e);
      return undefined;
    }
  }

  /**
   * Recalcule les badges de la table active d'après l'historique archivé actuel. À appeler à chaque
   * ouverture de la feuille : tant que la table n'est pas clôturée, ses badges suivent l'historique
   * (une autre table clôturée dans la soirée les fait évoluer) ; une fois clôturée, ils restent figés
   * dans l'archive. Ne touche à rien si le calcul échoue ou si le résultat est identique.
   */
  async recalculerBadgesTable(): Promise<void> {
    const t = this.table;
    const id = t.id;
    if (!this.pret || !id || !t.partie) return;
    const badges = await this.calculerBadges(t.partie.joueursId);
    if (!badges || t.id !== id || !t.partie) return;
    if (JSON.stringify(badges) === JSON.stringify(t.partie.badges)) return;
    runInAction(() => t.definirBadges(badges));
  }

  /** Abandonne la table en cours de composition. */
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
    await this.badgesEnAttente; // jamais rejetée : calculerBadges attrape ses erreurs
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
      ...(tirage.badges ? { badges: tirage.badges } : {}),
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
  /** Prépare l'annonce de fin de partie d'une partie déjà archivée (« Revoir l'annonce »). */
  afficherAnnonce(annonce: AnnonceFin) {
    this.annonceFin = annonce;
  }

  /** Oublie l'annonce de fin de partie une fois affichée. */
  effacerAnnonceFin() {
    this.annonceFin = null;
  }

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
        const annonce: AnnonceFin = {
          donnes: t.donnes,
          joueurs: t.joueurs,
          joueursId: t.partie.joueursId,
          nbTotal: t.nbTotal,
          badges: t.partie.badges,
          date: resume.date,
        };
        runInAction(() => (this.annonceFin = annonce));
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
