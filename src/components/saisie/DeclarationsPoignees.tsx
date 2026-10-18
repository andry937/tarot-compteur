/**
 * Saisie des poignées déclarées pendant une donne.
 * @module
 */

import { POIGNEES } from "@/domain/score/regles";
import type { PoigneeDeclaree } from "@/domain/score/regles";
import { Chip, Field, Label } from "@/components/ui";
import ChoixJoueur from "./ChoixJoueur";

/** Poignées déclarées pendant la donne : une ligne par joueur qui en a montré une. */
export default function DeclarationsPoignees({
  poignees,
  table,
  joueurs,
  onChange,
}: {
  poignees: PoigneeDeclaree[];
  table: number[];
  joueurs: string[];
  onChange: (p: PoigneeDeclaree[]) => void;
}) {
  const ajouter = () =>
    onChange([...poignees, { id: `${Date.now()}-${poignees.length}`, joueur: table[0], taille: "simple" }]);
  const maj = (idx: number, patch: Partial<PoigneeDeclaree>) =>
    onChange(poignees.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const retirer = (idx: number) => onChange(poignees.filter((_, i) => i !== idx));

  return (
    <Field>
      <Label>
        <span>Poignée</span>
        <em className="not-italic text-amber-400">
          {poignees.length > 0 ? `${poignees.length} déclarée${poignees.length > 1 ? "s" : ""}` : ""}
        </em>
      </Label>
      {poignees.map((p, idx) => (
        <div key={p.id} className="mb-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <ChoixJoueur indices={table} joueurs={joueurs} actif={p.joueur} onChoisir={(i) => maj(idx, { joueur: i })} />
          <div className="mt-2 flex flex-wrap gap-2">
            {POIGNEES.map((o) => (
              <Chip key={o.id} on={p.taille === o.id} onClick={() => maj(idx, { taille: o.id })}>
                {o.nom}
                <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">+{o.val}</small>
              </Chip>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 font-mono text-[10px] uppercase tracking-wide text-rose-400 hover:text-rose-300"
            onClick={() => retirer(idx)}
          >
            Retirer
          </button>
        </div>
      ))}
      <button
        type="button"
        className="w-full rounded-lg border border-dashed border-slate-700 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide text-slate-400 hover:border-slate-500"
        onClick={ajouter}
      >
        + Ajouter une poignée
      </button>
    </Field>
  );
}
