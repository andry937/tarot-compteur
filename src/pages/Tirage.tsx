import { useState } from "react";
import { Page, Header, GhostButton, Chip, Cta, Bar } from "@/components/ui";

interface TirageProps {
  joueurs: string[];
  onValider: (depart: number) => void;
  onRetour: () => void;
}

export default function Tirage({ joueurs, onValider, onRetour }: TirageProps) {
  const [choix, setChoix] = useState(0);

  return (
    <Page>
      <Header
        eyebrow="Avant la première donne"
        title="Qui distribue ?"
        actions={<GhostButton onClick={onRetour}>Retour</GhostButton>}
      />

      <p className="mb-4 text-sm leading-relaxed text-slate-400">Désignez le donneur de la première donne.</p>
      <div className="flex flex-wrap gap-2">
        {joueurs.map((j, i) => (
          <Chip key={i} on={choix === i} onClick={() => setChoix(i)}>
            {j}
          </Chip>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-800 pt-4">
        <p className="font-serif text-xl">
          {joueurs[choix]} distribue, {joueurs[(choix + 1) % joueurs.length]} entame.
        </p>
        <span className="mt-2 block font-mono text-[11px] leading-relaxed text-slate-400">
          Le donneur avance ensuite d'une place à chaque donne, dans l'ordre de la table.
        </span>
      </div>

      <Bar>
        <Cta onClick={() => onValider(choix)}>Ouvrir la feuille</Cta>
      </Bar>
    </Page>
  );
}
