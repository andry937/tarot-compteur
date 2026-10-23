import { makeAutoObservable, observable, reaction } from "mobx";
import type { ConfigSuivi, EtatSuivi } from "@/vision/domain/machinePli";
import { pipelineInitial, reglagesParDefaut } from "@/vision/domain/pipeline";
import type { EtatPipeline, ReglagesPipeline } from "@/vision/domain/pipeline";
import { versSortie } from "@/vision/contrat";
import type { SortieSuivi } from "@/vision/contrat";
import { creerBoucle } from "@/vision/lib/boucle";
import type { Boucle, ImageTraitee } from "@/vision/lib/boucle";
import type { DetailTemps, Detecteur } from "@/vision/lib/detecteur";
import type { Source } from "@/vision/lib/source";
import { ecrire, lire } from "@/vision/lib/stockage";
import { horloge } from "@/vision/lib/horloge";
import { chargerPartie, effacerPartie, sauvegarderPartie, vaut } from "@/vision/lib/sauvegardePartie";
import type { PartieSauvegardee } from "@/vision/lib/sauvegardePartie";
import { ajouterCarte, annulerDernierPli, corrigerCarte } from "@/vision/domain/corrections";
import type { Annonce } from "@/vision/domain/annonce";

export type Statut = "inactif" | "actif" | "pause" | "erreur";

export interface ParamsDemarrage {
  source: Source;
  detecteur: Detecteur;
  config: ConfigSuivi;
  /** Manche sauvegardée à reprendre : le suivi repart de son état, les cartes déjà posées ne sont pas recomptées. */
  etatDepart?: EtatPipeline;
}

/** Noms et annonce de la table : ce qui n'est pas dans le suivi mais doit revenir avec la manche. */
export interface MetaTable {
  noms: string[];
  annonce: Annonce;
}

/**
 * Délai minimal entre deux écritures de la sauvegarde pendant le jeu : la boucle produit 15 à 30 images par
 * seconde, et sérialiser toute la manche à chacune bloquerait le fil principal. Les corrections, elles, sont
 * écrites tout de suite.
 */
const DELAI_ECRITURE_MS = 1000;

/**
 * Pilote la boucle de suivi : démarrage/arrêt, pause, remise à zéro, corrections manuelles et dernier état
 * rendu. Les réglages sont lus en direct par la boucle, sans la redémarrer.
 */
export class StoreSuivi {
  statut: Statut = "inactif";
  image: ImageTraitee | null = null;
  erreur: string | null = null;
  reglages: ReglagesPipeline = lire("reglages", reglagesParDefaut([]));
  /** Avertissement sur le moteur de reconnaissance (ex. WebGPU indisponible), à montrer à l'utilisateur. */
  info: string | null = null;
  /** Moteur d'inférence du détecteur (« WebGPU », « processeur (WASM) »), vide pour le détecteur factice. */
  moteur: string | null = null;
  /** Détail du temps de la dernière détection (modèle réel seulement). */
  temps: DetailTemps | null = null;
  /** Manche sauvegardée trouvée au chargement de la page, pas encore reprise. */
  reprise: PartieSauvegardee | null;
  /** Manche sauvegardée choisie pour la reprise, à passer au prochain démarrage. */
  reprisePrete: PartieSauvegardee | null = null;
  /** Noms et annonce de la table, pour la sauvegarde. */
  meta: MetaTable | null = null;
  /** Configuration de la manche en cours : l'état initial se déduit d'elle tant qu'aucune image n'est arrivée. */
  private config: ConfigSuivi | null = null;

  private interne = { boucle: null as Boucle | null, ressources: null as ParamsDemarrage | null, derniereEcriture: 0 };

  /** @param idTable table de l'appli suivie : chaque table a sa propre sauvegarde de manche. */
  constructor(private readonly idTable: string) {
    this.reprise = chargerPartie(idTable);
    makeAutoObservable<StoreSuivi, "interne" | "config" | "idTable">(
      this,
      { interne: false, idTable: false, image: observable.ref, reglages: observable.ref, config: observable.ref, reprise: observable.ref, reprisePrete: observable.ref, meta: observable.ref },
      { autoBind: true }
    );
    reaction(
      () => this.reglages,
      (r) => ecrire("reglages", { seuils: r.seuils, stabilisation: r.stabilisation, fusion: r.fusion, zones: [] })
    );
  }

  get actif(): boolean {
    return this.statut === "actif" || this.statut === "pause";
  }

  /** Dernier état du suivi (celui de la dernière image, ou l'état vierge d'une manche qui démarre). */
  get etat(): EtatPipeline | null {
    return this.image?.etat ?? (this.config ? pipelineInitial(this.config) : null);
  }

  /** Ce que reçoit tarot-compteur (voir `integration/contrat`). */
  get sortie(): SortieSuivi | null {
    return this.etat ? versSortie(this.etat.suivi) : null;
  }

  setReglages(reglages: ReglagesPipeline): void {
    this.reglages = reglages;
  }

  demarrer(p: ParamsDemarrage): void {
    this.arreter();
    this.erreur = null;
    this.image = null;
    this.info = p.detecteur.avertissement ?? null;
    this.moteur = p.detecteur.nom.startsWith("Modèle ONNX, ") ? p.detecteur.nom.slice("Modèle ONNX, ".length) : null;
    this.interne.ressources = p;
    this.config = p.etatDepart ? p.etatDepart.suivi.config : p.config;
    this.reprise = null;
    this.reprisePrete = null;
    // Sans reprise, c'est une nouvelle manche : l'ancienne ne doit pas réapparaître au prochain rechargement.
    if (!p.etatDepart) effacerPartie(this.idTable);
    this.interne.boucle = creerBoucle({
      source: p.source,
      detecteur: p.detecteur,
      config: this.config!,
      etatDepart: p.etatDepart,
      reglages: () => this.reglages,
      onImage: this.recevoirImage,
      onErreur: this.echouer,
    });
    this.interne.boucle.demarrer();
    this.statut = "actif";
  }

  /** Appelée par la boucle à chaque image traitée : l'image est affichée, et la manche sauvegardée si elle a commencé. */
  private recevoirImage(image: ImageTraitee): void {
    this.image = image;
    this.temps = this.interne.ressources?.detecteur.temps ?? null;
    const maintenant = performance.now();
    if (maintenant - this.interne.derniereEcriture < DELAI_ECRITURE_MS) return;
    this.interne.derniereEcriture = maintenant;
    this.sauvegarder(image.etat);
  }

  /** Noms et annonce de la table : enregistrés avec la manche à chaque changement. */
  definirMeta(meta: MetaTable): void {
    this.meta = meta;
    this.sauvegarder(this.image?.etat);
  }

  /** Écrit la manche si elle a commencé ; sans table (noms et annonce) connue, il n'y a rien à écrire. */
  private sauvegarder(etat: EtatPipeline | undefined): void {
    if (this.meta && etat && vaut(etat)) sauvegarderPartie(this.idTable, this.meta.noms, this.meta.annonce, etat);
  }

  /** Choisit la manche sauvegardée : elle repartira au prochain démarrage (avec la même table). */
  choisirReprise(): void {
    if (!this.reprise) return;
    this.reprisePrete = this.reprise;
    this.reprise = null;
  }

  /** Oublie la manche sauvegardée (proposée à la reprise, ou à effacer). */
  oublierReprise(): void {
    this.reprise = null;
    this.reprisePrete = null;
    effacerPartie(this.idTable);
  }

  private echouer(e: Error): void {
    this.erreur = e.message;
    this.statut = "erreur";
  }

  arreter(): void {
    const { boucle, ressources } = this.interne;
    // La sauvegarde pendant le jeu est espacée d'une seconde : on écrit le dernier état avant de tout couper.
    if (boucle) this.sauvegarder(this.image?.etat);
    boucle?.arreter();
    ressources?.detecteur.fermer();
    ressources?.source.arreter();
    this.interne.boucle = null;
    this.interne.ressources = null;
    this.statut = "inactif";
  }

  pause(): void {
    const { boucle } = this.interne;
    if (!boucle) return;
    if (boucle.estEnPause()) {
      boucle.reprendre();
      this.statut = "actif";
    } else {
      boucle.pause();
      this.statut = "pause";
    }
  }

  /** Nouvelle manche : mêmes source et détecteur, suivi remis à zéro. */
  reinitialiser(): void {
    const { ressources } = this.interne;
    if (ressources) this.demarrer({ ...ressources, etatDepart: undefined });
  }

  /** Correction manuelle du suivi (entame, joueur d'une carte, gagnant) : marche aussi en pause. */
  corriger(f: (suivi: EtatSuivi) => EtatSuivi): void {
    const etat = this.interne.boucle?.corriger(f);
    if (etat && this.image) this.image = { ...this.image, etat };
  }

  /** Applique une correction ; rend `false` si le suivi n'a pas changé (refus, rien à annuler). */
  private appliquer(f: (suivi: EtatSuivi) => EtatSuivi): boolean {
    let change = false;
    this.corriger((s) => {
      const r = f(s);
      change = r !== s;
      return r;
    });
    if (change) this.enregistrer();
    return change;
  }

  /** Sauvegarde la manche telle qu'elle est après une correction (sans attendre la prochaine image). */
  private enregistrer(): void {
    this.sauvegarder(this.image?.etat);
  }

  /** Annule le dernier pli terminé. */
  annulerPli(): boolean {
    return this.appliquer(annulerDernierPli);
  }

  /** Corrige l'identité d'une carte d'un pli terminé (rang d'arrivée dans le pli). */
  corrigerIdentite(numero: number, rang: number, carte: string): boolean {
    return this.appliquer((s) => corrigerCarte(s, numero, rang, carte));
  }

  /** Ajoute une carte que la caméra n'a pas vue, au pli en cours. */
  ajouterCarte(joueur: number, carte: string): boolean {
    return this.appliquer((s) => ajouterCarte(s, joueur, carte, horloge()));
  }

  liberer(): void {
    this.arreter();
  }
}
