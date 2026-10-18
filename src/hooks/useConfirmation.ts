/**
 * Hook de confirmation en deux clics pour les actions destructives.
 * @module
 */

import { useCallback, useEffect, useRef, useState } from "react";

const DELAI_CONFIRMATION_MS = 4000;

/**
 * Confirmation en deux clics pour une action destructive : le premier clic
 * « arme » le bouton (`enAttente` passe à vrai, d'où le libellé « Confirmer ? »)
 * pendant 4 s, le second exécute l'action. Le minuteur est annulé au démontage
 * et à chaque nouveau déclenchement, donc rien ne s'exécute sur un composant
 * disparu et les clics répétés n'empilent pas de minuteurs.
 */
export function useConfirmation(action: () => void): {
  /** `true` pendant les 4 s qui suivent le premier clic (libellé « Confirmer ? »). */
  enAttente: boolean;
  /** À brancher sur le bouton : arme au premier clic, exécute `action` au second. */
  declencher: () => void;
} {
  const [enAttente, setEnAttente] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const declencher = useCallback(() => {
    clearTimeout(minuteur.current);
    if (!enAttente) {
      setEnAttente(true);
      minuteur.current = setTimeout(() => setEnAttente(false), DELAI_CONFIRMATION_MS);
      return;
    }
    setEnAttente(false);
    action();
  }, [enAttente, action]);

  return { enAttente, declencher };
}
