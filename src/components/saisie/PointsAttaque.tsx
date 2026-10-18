/**
 * Saisie des points de l'attaque, avec les valeurs déduites des cartes.
 * @module
 */

import type { ResultatDonne } from "@/domain/score/regles";
import type { DeductionAttaque } from "@/domain/cartes/cartes";
import { Field, Label } from "@/components/ui";

/** Points de l'attaque : valeurs déduites des cartes notées (si disponibles), compteur, curseur et verdict. */
export default function PointsAttaque({
  points,
  onPoints,
  res,
  seuil,
  deduction,
  nbCartes,
  onUtiliserDeduction,
}: {
  points: number;
  onPoints: (fn: (p: number) => number) => void;
  res: ResultatDonne;
  seuil: number;
  deduction: DeductionAttaque | null;
  nbCartes: number;
  onUtiliserDeduction: (d: DeductionAttaque) => void;
}) {
  const cadrer = (v: number) => Math.min(91, Math.max(0, Math.round(v * 2) / 2));
  return (
    <Field>
      <Label>Points de l'attaque</Label>
      {deduction && (
        <div className="mb-3 rounded-lg border border-sky-500/40 bg-sky-950/30 p-3" data-testid="deduction">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-sky-300">Déduit des cartes notées</div>
          {deduction.complet ? (
            <>
              <p className="mt-1 text-sm text-slate-100">
                L'attaque a <b className="font-mono text-amber-400">{deduction.points}</b> pts · {deduction.bouts} bout
                {deduction.bouts > 1 ? "s" : ""}
                {deduction.petitAuBout !== "aucun" && ` · petit au bout pour ${deduction.petitAuBout === "attaque" ? "l'attaque" : "la défense"}`}
                {deduction.chelem && " · tous les plis pour l'attaque"}
              </p>
              {deduction.excuseJouee && (
                <p className="mt-1 text-[11px] text-slate-400">
                  L'Excuse est comptée 4,5 pts pour son camp, sans l'échange d'une carte à 0,5 pt : le total peut
                  varier de 4 pts.
                </p>
              )}
              <button
                type="button"
                className="mt-2 rounded-full border border-sky-400 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-sky-200 hover:bg-sky-900/40"
                onClick={() => onUtiliserDeduction(deduction)}
              >
                Utiliser ces valeurs
              </button>
            </>
          ) : (
            <p className="mt-1 text-[12px] text-slate-400">
              Main incomplète ({nbCartes} carte{nbCartes > 1 ? "s" : ""} notée
              {nbCartes > 1 ? "s" : ""}) : notez tous les plis pour déduire les points.
            </p>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 text-xl hover:border-slate-500"
          onClick={() => onPoints((p) => cadrer(p - 0.5))}
          aria-label="Retirer un demi-point"
        >
          −
        </button>
        <div className="flex-1 text-center">
          <b className="font-serif text-4xl font-bold tracking-tight">{points}</b>
          <span className="block font-mono text-[10px] uppercase tracking-wide text-slate-400">
            sur 91 · défense {91 - points}
          </span>
        </div>
        <button
          type="button"
          className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 text-xl hover:border-slate-500"
          onClick={() => onPoints((p) => cadrer(p + 0.5))}
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
        onChange={(e) => onPoints(() => parseFloat(e.target.value))}
      />
      <div className={`mt-2 text-center font-mono text-[11px] ${res.reussi ? "text-amber-400" : "text-rose-400"}`}>
        {res.reussi
          ? `Contrat réussi de ${res.ecart} pt${res.ecart > 1 ? "s" : ""}`
          : `Chute de ${res.ecart} pt${res.ecart > 1 ? "s" : ""} — il fallait ${seuil}`}
      </div>
      {res.defenseurs.length > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
          <span>Chaque défenseur</span>
          <b className="font-medium text-slate-100">
            {(res.scores[res.defenseurs[0]] as number) > 0 ? "+" : ""}
            {res.scores[res.defenseurs[0]]}
          </b>
        </div>
      )}
    </Field>
  );
}
