/**
 * Hook de pagination d'une liste longue.
 * @module
 */

import { useState } from "react";

/** Nombre d'éléments par page par défaut. */
export const TAILLE_PAGE = 10;

/**
 * Découpe `elements` en pages de `taille` éléments. La page courante est
 * recadrée si la liste raccourcit (suppression d'une partie, par exemple).
 */
export function usePagination<T>(elements: T[], taille = TAILLE_PAGE) {
  const [demandee, setPage] = useState(0);
  const nbPages = Math.max(1, Math.ceil(elements.length / taille));
  const page = Math.min(demandee, nbPages - 1);
  return {
    /** Éléments de la page courante. */
    visibles: elements.slice(page * taille, (page + 1) * taille),
    /** Index de la page courante (à partir de 0). */
    page,
    nbPages,
    setPage,
  };
}
