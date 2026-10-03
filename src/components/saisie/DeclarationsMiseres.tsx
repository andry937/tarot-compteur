import type { Misere } from "@/domain/score/regles";
import { Chip, Field, Label } from "@/components/ui";
import ChoixJoueur from "./ChoixJoueur";

const TYPES_MISERE = [
  { id: "atout", nom: "Pas d'atout" },
  { id: "tete", nom: "Pas de tête" },
] as const;

/** Misères annoncées pendant la donne (règle Tarot-Bière) : une ligne par joueur. */
export default function DeclarationsMiseres({
  miseres,
  table,
  joueurs,
  onChange,
}: {
  miseres: Misere[];
  table: number[];
  joueurs: string[];
  onChange: (m: Misere[]) => void;
}) {
  const ajouter = () =>
    onChange([...miseres, { id: `${Date.now()}-${miseres.length}`, joueur: table[0], type: "atout", aTort: false }]);
  const maj = (idx: number, patch: Partial<Misere>) =>
    onChange(miseres.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const retirer = (idx: number) => onChange(miseres.filter((_, i) => i !== idx));

  return (
    <Field>
      <Label>
        <span>Misère</span>
        <em className="not-italic text-amber-400">
          {miseres.length > 0 ? `${miseres.length} déclarée${miseres.length > 1 ? "s" : ""}` : ""}
        </em>
      </Label>
      {miseres.map((m, idx) => (
        <div key={m.id} className="mb-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <ChoixJoueur indices={table} joueurs={joueurs} actif={m.joueur} onChoisir={(i) => maj(idx, { joueur: i })} />
          <div className="mt-2 flex flex-wrap gap-2">
            {TYPES_MISERE.map((o) => (
              <Chip key={o.id} on={m.type === o.id} onClick={() => maj(idx, { type: o.id })}>
                {o.nom}
              </Chip>
            ))}
            <Chip on={m.aTort} onClick={() => maj(idx, { aTort: !m.aTort })}>
              Annoncée à tort
            </Chip>
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
        + Ajouter une misère
      </button>
    </Field>
  );
}
