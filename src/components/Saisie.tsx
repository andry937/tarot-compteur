import { useState } from "react";
import { CONTRATS, SEUILS, POIGNEES, CHELEMS, NOM_ROI, calculer } from "../utils/regles";
import type { Donne, Misere, PetitAuBout, Roi } from "../utils/regles";
import { Field, Label, Chip, Cta } from "./ui";

const ROIS = (Object.entries(NOM_ROI) as [Roi, string][]).map(([id, nom]) => ({ id, nom }));

interface SaisieProps {
  joueurs: string[];
  parDonne: number;
  tableProposee: number[];
  total: number;
  numero: number;
  onFermer: () => void;
  onValider: (d: Donne) => void;
}

export default function Saisie({ joueurs, parDonne, tableProposee, total, numero, onFermer, onValider }: SaisieProps) {
  const [table, setTable] = useState<number[]>(tableProposee);
  const [donneur, setDonneur] = useState(tableProposee[0]);
  const [preneur, setPreneur] = useState(tableProposee[0]);
  const [appele, setAppele] = useState<number | null>(null);
  const [roiAppele, setRoiAppele] = useState<Roi | null>(null);
  const [contrat, setContrat] = useState("garde");
  const [bouts, setBouts] = useState<0 | 1 | 2 | 3>(1);
  const [points, setPoints] = useState(51);
  const [petitAuBout, setPetitAuBout] = useState<PetitAuBout>("aucun");
  const [poignee, setPoignee] = useState("aucune");
  const [chelem, setChelem] = useState("aucun");
  const [miseres, setMiseres] = useState<Misere[]>([]);

  const roiRequis = table.length === 5;
  const complete =
    table.length === parDonne && table.includes(preneur) && (!roiRequis || roiAppele !== null);
  const donne: Donne = {
    table, donneur, preneur, appele, contrat, bouts, points, petitAuBout, poignee, chelem,
    miseres, roiAppele: roiAppele ?? undefined,
  };
  const entame = table.length > 1 ? table[(table.indexOf(donneur) + 1) % table.length] : null;
  const res = calculer(donne, joueurs.length);
  const seuil = SEUILS[bouts];
  const cadrer = (v: number) => Math.min(91, Math.max(0, Math.round(v * 2) / 2));

  const ajouterMisere = () =>
    setMiseres((m) => [
      ...m,
      { id: `${Date.now()}-${m.length}`, joueur: table[0], type: "atout", aTort: false },
    ]);
  const majMisere = (idx: number, patch: Partial<Misere>) =>
    setMiseres((m) => m.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const retirerMisere = (idx: number) => setMiseres((m) => m.filter((_, i) => i !== idx));

  // On conserve l'ordre du tour de table, en partant du donneur.
  const basculer = (i: number) => {
    const brut = table.includes(i) ? table.filter((x) => x !== i) : [...table, i];
    const pivot = brut.includes(donneur) ? donneur : (brut[0] ?? 0);
    const suivant = [...brut].sort(
      (a, b) => ((a - pivot + total) % total) - ((b - pivot + total) % total)
    );
    setTable(suivant);
    if (!suivant.includes(donneur)) setDonneur(suivant[0] ?? 0);
    if (!suivant.includes(preneur)) setPreneur(suivant[0] ?? 0);
    if (appele !== null && !suivant.includes(appele)) setAppele(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-4" onClick={onFermer}>
      <div
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border-t-2 border-amber-400 bg-slate-900 p-4 pb-56 sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-800 sm:border-t-2 sm:pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="font-serif text-xl font-bold sm:text-2xl">Donne {numero}</span>
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white"
            onClick={onFermer}
          >
            Fermer
          </button>
        </div>

        {joueurs.length > parDonne && (
          <Field>
            <Label>
              <span>Qui joue cette donne</span>
              <em className="not-italic text-amber-400">
                {table.length} / {parDonne}
              </em>
            </Label>
            <div className="flex flex-wrap gap-2">
              {joueurs.map((j, i) => (
                <Chip key={i} on={table.includes(i)} className={!table.includes(i) ? "opacity-40" : ""} onClick={() => basculer(i)}>
                  {j}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        <Field>
          <Label>
            <span>Donneur</span>
            {entame !== null && <em className="not-italic text-amber-400">{joueurs[entame]} entame</em>}
          </Label>
          <div className="flex flex-wrap gap-2">
            {table.map((i) => (
              <Chip key={i} on={donneur === i} onClick={() => setDonneur(i)}>
                {joueurs[i]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>Preneur</Label>
          <div className="flex flex-wrap gap-2">
            {table.map((i) => (
              <Chip
                key={i}
                on={preneur === i}
                onClick={() => {
                  setPreneur(i);
                  if (appele === i) setAppele(null);
                }}
              >
                {joueurs[i]}
              </Chip>
            ))}
          </div>
        </Field>

        {table.length === 5 && (
          <Field>
            <Label>Roi appelé</Label>
            <div className="flex flex-wrap gap-2">
              {ROIS.map((r) => (
                <Chip key={r.id} on={roiAppele === r.id} onClick={() => setRoiAppele(r.id)}>
                  {r.nom}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {table.length === 5 && (
          <Field>
            <Label>Chez qui ?</Label>
            <div className="flex flex-wrap gap-2">
              <Chip on={appele === null} onClick={() => setAppele(null)}>
                Lui-même
                <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">joue seul</small>
              </Chip>
              {table
                .filter((i) => i !== preneur)
                .map((i) => (
                  <Chip key={i} on={appele === i} onClick={() => setAppele(i)}>
                    {joueurs[i]}
                  </Chip>
                ))}
            </div>
          </Field>
        )}

        <Field>
          <Label>Contrat</Label>
          <div className="flex flex-wrap gap-2">
            {CONTRATS.map((c) => (
              <Chip key={c.id} on={contrat === c.id} onClick={() => setContrat(c.id)}>
                {c.nom}
                <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">×{c.mult}</small>
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>Bouts du preneur</Label>
          <div className="flex flex-wrap gap-2">
            {([0, 1, 2, 3] as const).map((b) => (
              <Chip key={b} on={bouts === b} onClick={() => setBouts(b)}>
                {b}
                <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">{SEUILS[b]} pts</small>
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>Points de l'attaque</Label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 text-xl hover:border-slate-500"
              onClick={() => setPoints((p) => cadrer(p - 0.5))}
              aria-label="Retirer un demi-point"
            >
              −
            </button>
            <div className="flex-1 text-center">
              <b className="font-serif text-4xl font-bold tracking-tight">{points}</b>
              <span className="block font-mono text-[10px] uppercase tracking-wide text-slate-400">sur 91</span>
            </div>
            <button
              type="button"
              className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 text-xl hover:border-slate-500"
              onClick={() => setPoints((p) => cadrer(p + 0.5))}
              aria-label="Ajouter un demi-point"
            >
              +
            </button>
          </div>
          <input
            className="mt-3 w-full accent-amber-400"
            type="range"
            min="0"
            max="91"
            step="0.5"
            value={points}
            onChange={(e) => setPoints(parseFloat(e.target.value))}
          />
          <div className={`mt-2 text-center font-mono text-[11px] ${res.reussi ? "text-amber-400" : "text-rose-400"}`}>
            {res.reussi
              ? `Contrat réussi de ${res.ecart} pt${res.ecart > 1 ? "s" : ""}`
              : `Chute de ${res.ecart} pt${res.ecart > 1 ? "s" : ""} — il fallait ${seuil}`}
          </div>
        </Field>

        <Field>
          <Label>Petit au bout</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "aucun", nom: "Aucun" },
              { id: "attaque", nom: "Attaque" },
              { id: "defense", nom: "Défense" },
            ].map((o) => (
              <Chip key={o.id} on={petitAuBout === o.id} onClick={() => setPetitAuBout(o.id as PetitAuBout)}>
                {o.nom}
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>Poignée</Label>
          <div className="flex flex-wrap gap-2">
            {POIGNEES.map((p) => (
              <Chip key={p.id} on={poignee === p.id} onClick={() => setPoignee(p.id)}>
                {p.nom}
                {p.val > 0 && <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">+{p.val}</small>}
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>Chelem</Label>
          <div className="flex flex-wrap gap-2">
            {CHELEMS.map((c) => (
              <Chip key={c.id} on={chelem === c.id} onClick={() => setChelem(c.id)}>
                {c.nom}
                {c.val !== 0 && (
                  <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">
                    {c.val > 0 ? `+${c.val}` : c.val}
                  </small>
                )}
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>
            <span>Misère</span>
            <em className="not-italic text-amber-400">
              {miseres.length > 0 ? `${miseres.length} déclarée${miseres.length > 1 ? "s" : ""}` : ""}
            </em>
          </Label>
          {miseres.map((m, idx) => (
            <div key={m.id} className="mb-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              <div className="flex flex-wrap gap-2">
                {table.map((i) => (
                  <Chip key={i} on={m.joueur === i} onClick={() => majMisere(idx, { joueur: i })}>
                    {joueurs[i]}
                  </Chip>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { id: "atout", nom: "Pas d'atout" },
                    { id: "tete", nom: "Pas de tête" },
                  ] as const
                ).map((o) => (
                  <Chip key={o.id} on={m.type === o.id} onClick={() => majMisere(idx, { type: o.id })}>
                    {o.nom}
                  </Chip>
                ))}
                <Chip on={m.aTort} onClick={() => majMisere(idx, { aTort: !m.aTort })}>
                  Annoncée à tort
                </Chip>
              </div>
              <button
                type="button"
                className="mt-2 font-mono text-[10px] uppercase tracking-wide text-rose-400 hover:text-rose-300"
                onClick={() => retirerMisere(idx)}
              >
                Retirer
              </button>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-slate-700 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide text-slate-400 hover:border-slate-500"
            onClick={ajouterMisere}
          >
            + Ajouter une misère
          </button>
        </Field>

        <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur sm:absolute sm:rounded-b-2xl">
          <div className="mx-auto max-w-lg">
            {complete ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                  <span>{joueurs[preneur]}</span>
                  <b className="font-medium text-slate-100">
                    {(res.scores[preneur] as number) > 0 ? "+" : ""}
                    {res.scores[preneur]}
                  </b>
                </div>
                {res.avecAppele && (
                  <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                    <span>{joueurs[appele as number]} (appelé)</span>
                    <b className="font-medium text-slate-100">
                      {(res.scores[appele as number] as number) > 0 ? "+" : ""}
                      {res.scores[appele as number]}
                    </b>
                  </div>
                )}
                <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                  <span>Chaque défenseur</span>
                  <b className="font-medium text-slate-100">
                    {(res.scores[res.defenseurs[0]] as number) > 0 ? "+" : ""}
                    {res.scores[res.defenseurs[0]]}
                  </b>
                </div>
              </>
            ) : (
              <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                <span>Choisissez {parDonne} joueurs pour cette donne</span>
                <b className="font-medium text-slate-100">
                  {table.length} / {parDonne}
                </b>
              </div>
            )}
            <Cta disabled={!complete} onClick={() => onValider(donne)}>
              Inscrire la donne
            </Cta>
          </div>
        </div>
      </div>
    </div>
  );
}
