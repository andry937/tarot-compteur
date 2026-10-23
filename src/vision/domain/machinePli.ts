import { deriverPlis, gagnantDuPli, libelleCarte, nbPlis, tailleChien, toutesLesCartes } from "@/domain/cartes/cartes";
import { detecterRenonces } from "./renonces";
import type { EvenementStab } from "./stabilisation";
import type { ZoneId } from "./types";

export const CARTES_CONNUES: ReadonlySet<string> = new Set(toutesLesCartes());

export type Phase = "attente" | "enCours" | "complet" | "ramassage" | "termine";
export type Gravite = "info" | "avertissement" | "erreur";

/** Alerte non bloquante ; `cle` sert à ne pas répéter la même. */
export interface Alerte {
  cle: string;
  gravite: Gravite;
  message: string;
  pli?: number;
}

/** Une carte posée sur la table. Le joueur n'est pas lu sur l'image : il se déduit de l'ordre d'arrivée, sauf correction manuelle. */
export interface Pose {
  carte: string;
  joueur: number;
  horodatage: number;
  /** Carte telle que la caméra l'a lue, avant toute correction d'identité. */
  observee?: string;
}

/**
 * Corrections manuelles d'un pli : elles priment sur la déduction par l'ordre d'arrivée. Chaque champ
 * absent laisse la déduction faire son travail.
 */
export interface SurchargePli {
  /** Joueur qui entame ce pli (sinon : le gagnant du pli précédent). */
  entame?: number;
  /** Joueur de certaines cartes, par identifiant de carte ; les autres cartes prennent les places restantes dans l'ordre d'arrivée. */
  joueurs?: Record<string, number>;
  /** Gagnant imposé (sinon : celui des règles du tarot). */
  gagnant?: number;
  /**
   * Identité corrigée des cartes du pli, par rang d'arrivée (0 = première carte posée) : la caméra a lu
   * une autre carte. L'identité lue reste dans `Pose.observee`, donc la correction s'annule sans perte.
   */
  cartes?: Record<number, string>;
}

export interface PliJoue {
  numero: number;
  /** Dans l'ordre de jeu : la première carte est celle de l'entame, les suivantes suivent le tour de table. */
  poses: Pose[];
  entame: number;
  gagnant: number;
  /** Corrections manuelles de ce pli, s'il y en a. */
  surcharge?: SurchargePli;
}

export interface ConfigSuivi {
  /** Joueurs à table, dans l'ordre de jeu de la donne (le donneur en premier, comme `Donne.table`). */
  table: number[];
  /** Joueur qui entame le premier pli (le suivant du donneur). */
  entameInitiale: number;
}

export interface EtatSuivi {
  config: ConfigSuivi;
  phase: Phase;
  /** Cartes du pli en cours de constitution. */
  poseCourante: Pose[];
  plis: PliJoue[];
  chien: string[];
  ecart: string[];
  /** Cartes actuellement validées, avec leur emplacement (table, chien ou écart). */
  presentes: Record<string, ZoneId | null>;
  entameAttendue: number;
  /** Corrections du pli en cours de constitution ; elles passent au pli quand il se termine. */
  surchargeCourante: SurchargePli;
  alertes: Alerte[];
}

export function etatInitial(config: ConfigSuivi): EtatSuivi {
  return {
    config,
    phase: "attente",
    poseCourante: [],
    plis: [],
    chien: [],
    ecart: [],
    presentes: {},
    entameAttendue: config.entameInitiale,
    surchargeCourante: {},
    alertes: [],
  };
}

/** Liste plate des cartes jouées, dans l'ordre de jeu — le format du comptage existant. */
export const cartesJoueesDe = (etat: EtatSuivi): string[] =>
  etat.plis.flatMap((p) => p.poses.map((x) => x.carte));

export const nbPlisTotal = (etat: EtatSuivi): number => nbPlis(etat.config.table.length);
export const plisRestants = (etat: EtatSuivi): number => nbPlisTotal(etat) - etat.plis.length;

function ajouterAlertes(etat: EtatSuivi, nouvelles: Alerte[]): EtatSuivi {
  const connues = new Set(etat.alertes.map((a) => a.cle));
  const aAjouter = nouvelles.filter((a) => !connues.has(a.cle));
  return aAjouter.length ? { ...etat, alertes: [...etat.alertes, ...aAjouter] } : etat;
}

const alerte = (etat: EtatSuivi, a: Alerte): EtatSuivi => ajouterAlertes(etat, [a]);

const tableVide = (etat: EtatSuivi): boolean => !Object.values(etat.presentes).includes("table");

/** Deux cartes posées à moins de ce délai : leur ordre d'arrivée, donc leur joueur, est incertain. */
export const ECART_AMBIGU_MS = 400;

/**
 * Attribue les cartes d'un pli aux joueurs. Une carte dont le joueur est imposé le garde ; les autres
 * prennent, dans leur ordre d'arrivée, les places restantes en partant de l'entame. Le résultat est dans
 * l'ordre de jeu (de l'entame, puis le tour de table) : c'est l'ordre qu'attend `gagnantDuPli`.
 */
function attribuer(table: number[], entame: number, cartes: Pose[], imposes: Record<string, number> = {}): Pose[] {
  const debut = Math.max(0, table.indexOf(entame));
  const tour = table.map((_, i) => table[(debut + i) % table.length]);
  const imposee = (c: string): number | undefined => (tour.includes(imposes[c]) ? imposes[c] : undefined);
  const pris = new Set(cartes.map((p) => imposee(p.carte)).filter((j) => j !== undefined));
  const libres = tour.filter((j) => !pris.has(j));
  let suivante = 0;
  return [...cartes]
    .sort((a, b) => a.horodatage - b.horodatage)
    .map((p) => ({ ...p, joueur: imposee(p.carte) ?? libres[suivante++] }))
    .sort((a, b) => tour.indexOf(a.joueur) - tour.indexOf(b.joueur));
}

/** Remplace la carte lue par la carte corrigée, par rang d'arrivée ; la carte lue est gardée dans `observee`. */
function appliquerIdentites(poses: Pose[], cartes: Record<number, string> = {}): Pose[] {
  const parArrivee = [...poses].sort((a, b) => a.horodatage - b.horodatage);
  return poses.map((p) => {
    const observee = p.observee ?? p.carte;
    const corrigee = cartes[parArrivee.indexOf(p)];
    return { ...p, observee, carte: corrigee ?? observee };
  });
}

const DERIVEES = ["renonce-", "surcoupe-", "incoherence-deriver-", "ordre-ambigu-"];

/** Alertes qui se déduisent des plis : elles sont refaites à chaque recalcul pour suivre les corrections. */
function alertesDerivees(etat: EtatSuivi): Alerte[] {
  const { table, entameInitiale } = etat.config;
  const alertes: Alerte[] = detecterRenonces(etat.plis);

  const { plis } = deriverPlis(table, entameInitiale, cartesJoueesDe(etat));
  // Après une correction, le comptage existant ne retrouverait plus les mêmes plis : on ne compare que les plis d'avant.
  const premiereCorrection = etat.plis.findIndex((p) => p.surcharge);
  etat.plis.forEach((observe, k) => {
    const deduit = plis[k];
    if (!deduit || (premiereCorrection !== -1 && k >= premiereCorrection)) return;
    const memesJoueurs = deduit.joueurs.join() === observe.poses.map((p) => p.joueur).join();
    if (!memesJoueurs || deduit.gagnant !== observe.gagnant) {
      alertes.push({
        cle: `incoherence-deriver-${observe.numero}`,
        gravite: "avertissement",
        pli: observe.numero,
        message: `Au pli ${observe.numero}, le comptage existant déduirait un autre ordre ou gagnant que celui observé : une surcorrection (entame/gagnant) sera nécessaire à l'intégration.`,
      });
    }
  });

  for (const pli of etat.plis) {
    const imposes = pli.surcharge?.joueurs ?? {};
    const parArrivee = [...pli.poses].sort((a, b) => a.horodatage - b.horodatage);
    parArrivee.slice(1).forEach((p, i) => {
      const avant = parArrivee[i];
      if (p.horodatage - avant.horodatage >= ECART_AMBIGU_MS || avant.carte in imposes || p.carte in imposes) return;
      alertes.push({
        cle: `ordre-ambigu-${pli.numero}-${avant.carte}-${p.carte}`,
        gravite: "avertissement",
        pli: pli.numero,
        message: `Pli ${pli.numero} : ${libelleCarte(avant.carte)} et ${libelleCarte(p.carte)} posées presque ensemble, leur ordre (donc leur joueur) est incertain : corrigez-le si besoin.`,
      });
    });
  }
  return alertes;
}

/**
 * Refait les plis et le pli en cours à partir des cartes observées et des corrections : l'entame de chaque
 * pli est le gagnant du précédent, donc corriger un pli corrige aussi ceux qui le suivent.
 */
export function recalculer(etat: EtatSuivi): EtatSuivi {
  const { table, entameInitiale } = etat.config;
  let entame = entameInitiale;
  const plis = etat.plis.map((pli): PliJoue => {
    const surcharge = pli.surcharge ?? {};
    const debut = surcharge.entame ?? entame;
    const poses = attribuer(table, debut, appliquerIdentites(pli.poses, surcharge.cartes), surcharge.joueurs);
    const gagnant = surcharge.gagnant ?? poses[gagnantDuPli(poses.map((p) => p.carte))].joueur;
    entame = gagnant;
    return { ...pli, poses, entame: debut, gagnant };
  });
  const entameAttendue = etat.surchargeCourante.entame ?? entame;
  const poseCourante = attribuer(table, entameAttendue, etat.poseCourante, etat.surchargeCourante.joueurs);
  const recalcule: EtatSuivi = { ...etat, plis, poseCourante, entameAttendue };
  return ajouterAlertes(
    { ...recalcule, alertes: recalcule.alertes.filter((a) => !DERIVEES.some((d) => a.cle.startsWith(d))) },
    alertesDerivees(recalcule)
  );
}

/** Passe à la phase suivante une fois la table vidée après un pli complet. */
function apresRamassage(etat: EtatSuivi): EtatSuivi {
  if ((etat.phase === "complet" || etat.phase === "ramassage") && tableVide(etat)) {
    return { ...etat, phase: etat.plis.length >= nbPlisTotal(etat) ? "termine" : "attente" };
  }
  return etat;
}

function finirPli(etat: EtatSuivi): EtatSuivi {
  const numero = etat.plis.length + 1;
  const surcharge = etat.surchargeCourante;
  const nouveau: PliJoue = {
    numero,
    poses: etat.poseCourante,
    entame: etat.entameAttendue,
    gagnant: etat.entameAttendue,
    ...(Object.keys(surcharge).length ? { surcharge } : {}),
  };
  let suivant = recalculer({ ...etat, plis: [...etat.plis, nouveau], poseCourante: [], surchargeCourante: {}, phase: "complet" });
  if (suivant.plis[numero - 1].poses.some((p) => p.carte === "excuse")) {
    suivant = alerte(suivant, {
      cle: `excuse-${numero}`,
      gravite: "info",
      pli: numero,
      message: `Excuse jouée au pli ${numero} : elle reste à son camp (l'échange d'une carte n'est pas suivi).`,
    });
  }
  return suivant;
}

function carteChienEcart(etat: EtatSuivi, carte: string, zone: "chien" | "ecart"): EtatSuivi {
  if (etat.plis.length > 0 || etat.poseCourante.length > 0) {
    return alerte(etat, {
      cle: `${zone}-pendant-jeu-${carte}`,
      gravite: "avertissement",
      message: `${libelleCarte(carte)} vue dans la zone ${zone === "chien" ? "du chien" : "de l'écart"} pendant le jeu : ignorée.`,
    });
  }
  const liste = zone === "chien" ? etat.chien : etat.ecart;
  if (liste.includes(carte)) return etat;
  if (liste.length >= tailleChien(etat.config.table.length)) {
    return alerte(etat, {
      cle: `${zone}-trop-${carte}`,
      gravite: "avertissement",
      message: `Plus de ${tailleChien(etat.config.table.length)} cartes dans la zone ${zone === "chien" ? "du chien" : "de l'écart"} : ${libelleCarte(carte)} ignorée.`,
    });
  }
  return { ...etat, [zone]: [...liste, carte] };
}

/** Ajoute la carte au pli en cours (son joueur se déduit de l'ordre d'arrivée), puis termine le pli s'il est complet. */
export function poser(etat: EtatSuivi, pose: Pose): EtatSuivi {
  const courant = recalculer({ ...etat, phase: "enCours", poseCourante: [...etat.poseCourante, pose] });
  return courant.poseCourante.length >= courant.config.table.length ? finirPli(courant) : courant;
}

function surValidee(etat: EtatSuivi, e: Extract<EvenementStab, { type: "validee" }>): EtatSuivi {
  const { carte, zone, horodatage } = e;
  let courant: EtatSuivi = { ...etat, presentes: { ...etat.presentes, [carte]: zone } };

  if (!CARTES_CONNUES.has(carte)) {
    return alerte(courant, { cle: `inconnue-${carte}`, gravite: "erreur", message: `Carte inconnue : « ${carte} ».` });
  }
  if (zone === "chien" || zone === "ecart") return carteChienEcart(courant, carte, zone);
  if (zone === null) return courant;

  const dejaJouee = courant.plis.find((p) => p.poses.some((x) => x.carte === carte));
  if (dejaJouee) {
    const dernier = courant.plis[courant.plis.length - 1];
    const resteDuDernier = dejaJouee === dernier && (courant.phase === "complet" || courant.phase === "ramassage");
    if (resteDuDernier) return courant;
    return alerte(courant, {
      cle: `deja-jouee-${carte}`,
      gravite: "erreur",
      message: `${libelleCarte(carte)} a déjà été jouée au pli ${dejaJouee.numero}.`,
    });
  }
  if (courant.phase === "termine") {
    return alerte(courant, { cle: `apres-fin-${carte}`, gravite: "avertissement", message: `${libelleCarte(carte)} posée après la fin de la manche : ignorée.` });
  }
  if (courant.ecart.includes(carte)) {
    courant = alerte(courant, { cle: `ecart-jouee-${carte}`, gravite: "erreur", message: `${libelleCarte(carte)} fait partie de l'écart mais est jouée.` });
  }
  if (courant.phase === "complet" || courant.phase === "ramassage") {
    courant = alerte({ ...courant, phase: "attente" }, {
      cle: `ramassage-incomplet-${courant.plis.length}`,
      gravite: "info",
      message: `Le pli ${courant.plis.length + 1} commence avant que la table soit vidée.`,
    });
  }
  return poser(courant, { carte, joueur: courant.entameAttendue, horodatage });
}

function surRetiree(etat: EtatSuivi, e: Extract<EvenementStab, { type: "retiree" }>): EtatSuivi {
  const presentes = { ...etat.presentes };
  delete presentes[e.carte];
  let courant: EtatSuivi = { ...etat, presentes };
  if (e.zone === "chien" || e.zone === "ecart") return courant;

  if (courant.poseCourante.some((p) => p.carte === e.carte)) {
    const reste = courant.poseCourante.filter((p) => p.carte !== e.carte);
    courant = alerte(recalculer({ ...courant, poseCourante: reste, phase: reste.length ? "enCours" : "attente" }), {
      cle: `retiree-avant-fin-${e.carte}-${courant.plis.length + 1}`,
      gravite: "info",
      message: `${libelleCarte(e.carte)} retirée avant la fin du pli : elle n'est pas comptée.`,
    });
    return courant;
  }
  if (courant.phase === "complet") courant = { ...courant, phase: "ramassage" };
  return apresRamassage(courant);
}

function surDeplacee(etat: EtatSuivi, e: Extract<EvenementStab, { type: "deplacee" }>): EtatSuivi {
  const courant: EtatSuivi = { ...etat, presentes: { ...etat.presentes, [e.carte]: e.vers } };
  if (courant.poseCourante.some((p) => p.carte === e.carte) && (e.vers === "chien" || e.vers === "ecart")) {
    const reste = courant.poseCourante.filter((p) => p.carte !== e.carte);
    return alerte(recalculer({ ...courant, poseCourante: reste, phase: reste.length ? "enCours" : "attente" }), {
      cle: `deplacee-${e.carte}-${e.vers}-${courant.plis.length + 1}`,
      gravite: "info",
      message: `${libelleCarte(e.carte)} déplacée vers ${e.vers === "chien" ? "le chien" : "l'écart"} : retirée du pli.`,
    });
  }
  if (courant.plis.some((p) => p.poses.some((x) => x.carte === e.carte))) {
    return alerte(courant, {
      cle: `deplacee-trop-tard-${e.carte}`,
      gravite: "info",
      message: `${libelleCarte(e.carte)} déplacée après la fin de son pli : sans effet (corrigez le pli à la main si besoin).`,
    });
  }
  return courant;
}

/** Applique un événement du stabilisateur : fonction pure, l'état précédent n'est pas modifié. */
export function appliquer(etat: EtatSuivi, evenement: EvenementStab): EtatSuivi {
  switch (evenement.type) {
    case "validee":
      return surValidee(etat, evenement);
    case "retiree":
      return surRetiree(etat, evenement);
    case "deplacee":
      return surDeplacee(etat, evenement);
  }
}
