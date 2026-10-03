import { useState } from "react";
import type { Donne } from "../utils/regles";
import { entameDeLaDonne } from "../utils/cartes";
import CartesJouees from "../pages/CartesJouees";
import { GhostButton } from "./ui";

interface EditeurCartesDonneProps {
  joueurs: string[];
  donne: Donne;
  numero: number;
  onFermer: () => void;
  onValider: (d: Donne) => void;
}

/** Plein écran : noter ou corriger les cartes (et le chien) d'une donne déjà inscrite, sur la feuille ou dans une archive.
 * Travaille sur une copie locale ; rien n'est enregistré avant « Enregistrer ». */
export default function EditeurCartesDonne({ joueurs, donne, numero, onFermer, onValider }: EditeurCartesDonneProps) {
  const [cartes, setCartes] = useState<string[]>(donne.cartesJouees ?? []);
  const [chien, setChien] = useState<string[]>(donne.chien ?? []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950" role="dialog" aria-label={`Cartes de la donne ${numero}`}>
      <CartesJouees
        joueurs={joueurs}
        table={donne.table}
        numero={numero}
        entame={entameDeLaDonne(donne)}
        cartes={cartes}
        onModifier={setCartes}
        chien={chien}
        onModifierChien={setChien}
        actions={
          <>
            <GhostButton onClick={onFermer}>Annuler</GhostButton>
            <GhostButton
              onClick={() =>
                onValider({
                  ...donne,
                  cartesJouees: cartes.length ? cartes : undefined,
                  chien: chien.length ? chien : undefined,
                })
              }
            >
              Enregistrer
            </GhostButton>
          </>
        }
      />
    </div>
  );
}
