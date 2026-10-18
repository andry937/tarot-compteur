/**
 * Choix d'un joueur parmi ceux de la table.
 * @module
 */

import { Chip } from "@/components/ui";

/** Rangée de pastilles pour choisir un joueur parmi ceux de la table (donneur, preneur, auteur d'une poignée…). */
export default function ChoixJoueur({
  indices,
  joueurs,
  actif,
  onChoisir,
}: {
  indices: number[];
  joueurs: string[];
  actif: number | null;
  onChoisir: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {indices.map((i) => (
        <Chip key={i} on={actif === i} onClick={() => onChoisir(i)}>
          {joueurs[i]}
        </Chip>
      ))}
    </div>
  );
}
