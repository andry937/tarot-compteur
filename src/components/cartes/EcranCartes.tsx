/**
 * Écran superposé de saisie des cartes jouées et du chien.
 * @module
 */

import CartesJouees from "./CartesJouees";
import { GhostButton } from "@/components/ui";

interface EcranCartesProps {
  joueurs: string[];
  /** Sièges à table dans l'ordre de jeu (donneur en premier). */
  table: number[];
  numero: number;
  /** Siège qui entame le premier pli. */
  entame: number;
  cartes: string[];
  chien: string[];
  onCartes: (cartes: string[]) => void;
  onChien: (chien: string[]) => void;
  onFermer: () => void;
}

/** Écran superposé au formulaire « Inscrire la donne » : note les cartes jouées et le chien sans quitter la saisie. */
export default function EcranCartes({
  joueurs, table, numero, entame, cartes, chien, onCartes, onChien, onFermer,
}: EcranCartesProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950" role="dialog" aria-label={`Cartes de la donne ${numero}`}>
      <CartesJouees
        joueurs={joueurs}
        table={table}
        numero={numero}
        entame={entame}
        cartes={cartes}
        onModifier={onCartes}
        chien={chien}
        onModifierChien={onChien}
        actions={<GhostButton onClick={onFermer}>Retour à la donne</GhostButton>}
      />
    </div>
  );
}
