/**
 * Clés de persistance (window.storage). Centralisées ici pour éviter les
 * chaînes littérales dispersées dans les composants.
 */

export const CLE_PARTIE = "tarot:partie:v4";
export const CLE_ROSTER = "tarot:joueurs:v2";
export const CLE_HISTORIQUE = "tarot:historique";

/** Clé de l'archive complète d'une partie close, par identifiant. */
export const cleArchive = (id) => `tarot:archive:${id}`;
