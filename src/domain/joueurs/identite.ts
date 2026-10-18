/**
 * Registre des joueurs : identifiants stables, résolution des noms,
 * rapprochement/création de fiches, fusion par redirection.
 * @module
 */

/**
 * Fiche d'un joueur du registre. Une fusion ne réécrit jamais les archives : elle désactive la fiche absorbée et la fait rediriger vers la fiche cible.
 */
export interface Fiche {
  /** Identifiant stable et opaque (UUID). */
  id: string;
  /** Nom affiché. */
  nom: string;
  /** Date de création, au format ISO. */
  creee: string;
  /** `false` si la fiche est désactivée ou absorbée par une fusion. */
  actif: boolean;
  /** Identifiant de la fiche cible après une fusion, sinon `null`. */
  redirigeVers: string | null;
}

/** Partie ou table minimale pour les vérifications de joueurs : identifiant et joueurs assis. */
export interface HistoriqueRef {
  /** Identifiant de la partie ou de la table. */
  id?: string;
  /** Identifiants des joueurs assis. */
  joueursId?: string[];
}

/** Génère un identifiant unique (UUID, ou un repli horodaté si `crypto.randomUUID` est absent). */
export const genId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Forme normalisée d'un nom pour les comparaisons : sans espaces aux extrémités, en minuscules. */
export const normaliser = (s: string): string => s.trim().toLowerCase();

/** Suit la chaîne de redirections (fusion) jusqu'à la fiche vivante. */
export function resoudreFiche(id: string, roster: Fiche[]): Fiche | null {
  let f = roster.find((r) => r.id === id) || null;
  let hops = 0;
  while (f && f.redirigeVers && hops < 12) {
    f = roster.find((r) => r.id === f!.redirigeVers) || null;
    hops++;
  }
  return f || null;
}

/** Nom à afficher pour un identifiant : fiche résolue, sinon le nom figé transmis en repli. */
export function resoudreNom(id: string, roster: Fiche[], repli?: string): string {
  const f = resoudreFiche(id, roster);
  return f ? f.nom : repli || "?";
}

/** Fiche active portant exactement ce nom (comparaison insensible à la casse/aux espaces). */
export function trouverFicheParNom(nom: string, roster: Fiche[]): Fiche | null {
  const v = normaliser(nom);
  return roster.find((r) => r.actif && normaliser(r.nom) === v) || null;
}

/**
 * Rapproche chaque nom saisi d'une fiche existante, ou en crée une silencieusement.
 * Retourne les identifiants dans l'ordre des noms fournis, et le registre mis à jour.
 */
export function resoudreOuCreerFiches(
  noms: string[],
  roster: Fiche[]
): {
  /** Identifiant de la fiche de chaque nom, dans l'ordre des noms fournis. */
  ids: string[];
  /** Registre mis à jour avec les fiches créées. */
  roster: Fiche[];
} {
  const suivant = [...roster];
  const ids = noms.map((nom) => {
    const existante = trouverFicheParNom(nom, suivant);
    if (existante) return existante.id;
    const fiche: Fiche = {
      id: genId(),
      nom: nom.trim(),
      creee: new Date().toISOString(),
      actif: true,
      redirigeVers: null,
    };
    suivant.push(fiche);
    return fiche.id;
  });
  return { ids, roster: suivant };
}

/** Deux fiches ont-elles déjà partagé une table dans l'historique ? */
export function ontDejaJoueEnsemble(
  idA: string,
  idB: string,
  historiqueIndex: HistoriqueRef[]
): boolean {
  return historiqueIndex.some(
    (h) => (h.joueursId || []).includes(idA) && (h.joueursId || []).includes(idB)
  );
}

/** Identifiants de tous les joueurs actuellement assis à une table ouverte. */
export function joueursActuellementAssis(tablesOuvertes: HistoriqueRef[]): Set<string> {
  return new Set(tablesOuvertes.flatMap((t) => t.joueursId || []));
}
