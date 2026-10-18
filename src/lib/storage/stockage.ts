/**
 * Clés de persistance (window.storage). Centralisées ici pour éviter les
 * chaînes littérales dispersées dans les composants.
 * @module
 */

/** @deprecated ancien emplacement unique d'une partie active — lu une fois
 * au démarrage pour migrer vers le système multi-table, jamais réécrit. */
export const CLE_PARTIE = "tarot:partie:v4";
/** Clé du trombinoscope des joueurs. */
export const CLE_ROSTER = "tarot:joueurs:v2";
/** Clé de l'index des parties archivées. */
export const CLE_HISTORIQUE = "tarot:historique";

/** Index léger des tables actuellement OUVERTES (même forme que l'historique). */
export const CLE_TABLES = "tarot:tables";

/** Clé de l'archive complète d'une partie close, par identifiant. */
export const cleArchive = (id: string): string => `tarot:archive:${id}`;

/** Clé de l'enregistrement complet d'une table ouverte, par identifiant. */
export const cleTable = (id: string): string => `tarot:table:${id}`;

/**
 * Levée par `window.storage.get` quand la clé n'existe pas — le cas normal
 * au premier lancement. Toute AUTRE erreur (réseau, délai, permission) est une
 * panne : il ne faut surtout pas la confondre avec « rien n'est stocké », sinon
 * l'app repart d'un état vide et écrase les vraies données à la première
 * sauvegarde.
 */
export class CleIntrouvable extends Error {
  constructor(key: string) {
    super(`clé introuvable: ${key}`);
    this.name = "CleIntrouvable";
  }
}

/** Lit et parse une clé JSON : `null` si elle est absente, lève sur toute autre erreur. */
export async function lireJson<T>(cle: string): Promise<T | null> {
  try {
    const r = await window.storage.get(cle);
    return JSON.parse(r.value) as T;
  } catch (e) {
    if (e instanceof CleIntrouvable) return null;
    throw e;
  }
}
