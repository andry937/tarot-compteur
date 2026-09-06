/**
 * Clés de persistance (window.storage). Centralisées ici pour éviter les
 * chaînes littérales dispersées dans les composants.
 */

/** @deprecated ancien emplacement unique d'une partie active — lu une fois
 * au démarrage pour migrer vers le système multi-table, jamais réécrit. */
export const CLE_PARTIE = "tarot:partie:v4";
export const CLE_ROSTER = "tarot:joueurs:v2";
export const CLE_HISTORIQUE = "tarot:historique";

/** Index léger des tables actuellement OUVERTES (même forme que l'historique). */
export const CLE_TABLES = "tarot:tables";

/** Clé de l'archive complète d'une partie close, par identifiant. */
export const cleArchive = (id: string): string => `tarot:archive:${id}`;

/** Clé de l'enregistrement complet d'une table ouverte, par identifiant. */
export const cleTable = (id: string): string => `tarot:table:${id}`;
