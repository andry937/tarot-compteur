import type { ReactNode } from "react";
import { CONTRATS, calculer, resumerDonnees, fmt } from "../utils/regles";
import type { Donne } from "../utils/regles";

interface ScoreGridProps {
  joueurs: string[];
  nbTotal: number;
  donnes: Donne[];
  cumule: boolean;
  onCumule: (v: boolean) => void;
  ouverte: number | null;
  onOuvrir: (i: number | null) => void;
  vide?: ReactNode;
  detailExtra?: ReactNode;
}

/** Grille de score (feuille en cours ou archive) : carte "papier" claire, contrastant
 * volontairement avec le reste de l'écran sombre pour rester lisible et dense. */
export default function ScoreGrid({
  joueurs,
  nbTotal,
  donnes,
  cumule,
  onCumule,
  ouverte,
  onOuvrir,
  vide,
  detailExtra,
}: ScoreGridProps) {
  const { totaux, cumuls } = resumerDonnees(donnes, nbTotal);
  const d0 = ouverte !== null ? donnes[ouverte] : null;
  const detail = d0 ? calculer(d0, nbTotal) : null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50 text-slate-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Marque</span>
        <div className="flex overflow-hidden rounded-full border border-slate-300">
          <button
            type="button"
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wide ${!cumule ? "bg-slate-900 text-white" : "text-slate-600"}`}
            onClick={() => onCumule(false)}
          >
            Par donne
          </button>
          <button
            type="button"
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wide ${cumule ? "bg-slate-900 text-white" : "text-slate-600"}`}
            onClick={() => onCumule(true)}
          >
            Cumulé
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-center">
          <thead>
            <tr className="border-b-2 border-slate-900">
              <th className="sticky left-0 z-10 w-9 min-w-[36px] bg-slate-50"></th>
              {joueurs.map((j, i) => (
                <th key={i} className="min-w-[64px] border-l border-slate-200 sm:min-w-[76px]">
                  <div className="truncate px-1 pb-1 pt-2 text-xs font-semibold">{j}</div>
                  <div
                    className={`px-1 pb-2.5 font-serif text-xl font-bold leading-none tracking-tight ${totaux[i] < 0 ? "text-rose-600" : ""}`}
                    data-testid="score-total"
                  >
                    {totaux[i]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {donnes.map((d, r) => {
              const res = calculer(d, nbTotal);
              return (
                <tr
                  key={r}
                  className={`cursor-pointer border-t border-slate-200 ${ouverte === r ? "bg-slate-200/70" : ""}`}
                  onClick={() => onOuvrir(ouverte === r ? null : r)}
                >
                  <td
                    className={`sticky left-0 z-10 font-mono text-[11px] text-slate-500 ${ouverte === r ? "bg-slate-200/70" : "bg-slate-50"}`}
                  >
                    {r + 1}
                  </td>
                  {joueurs.map((_, i) => {
                    const joue = res.scores[i] !== null;
                    const neg = joue && (cumule ? cumuls[r][i] : (res.scores[i] as number)) < 0;
                    return (
                      <td
                        key={i}
                        className={`relative border-l border-slate-200 px-1 py-2.5 font-mono text-[13px] ${
                          !joue ? "text-slate-300" : neg ? "text-rose-600" : ""
                        }`}
                      >
                        {d.preneur === i && (
                          <span className="absolute left-0.5 top-2 text-[7px] text-amber-500">◆</span>
                        )}
                        {cumule ? cumuls[r][i] : joue ? fmt(res.scores[i] as number) : "·"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {donnes.length === 0 && vide && (
              <tr>
                <td colSpan={nbTotal + 1}>{vide}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && d0 && (
        <div className="border-t-2 border-slate-900 bg-slate-100 p-3">
          <div className="font-mono text-[11px] leading-relaxed text-slate-600">
            Donne {(ouverte as number) + 1} — {joueurs[d0.preneur]} ·{" "}
            {CONTRATS.find((c) => c.id === d0.contrat)!.nom} · {d0.bouts} bout
            {d0.bouts > 1 ? "s" : ""} · {d0.points} pts
            {detail.avecAppele ? ` · appelé ${joueurs[d0.appele as number]}` : ""}
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-slate-600">
            {detail.reussi ? "Contrat réussi de" : "Chute de"} {detail.ecart} pt
            {detail.ecart > 1 ? "s" : ""} (seuil {detail.seuil})
            {d0.petitAuBout !== "aucun" ? ` · petit au bout ${d0.petitAuBout}` : ""}
            {d0.poignee !== "aucune" ? ` · poignée ${d0.poignee}` : ""}
            {d0.chelem !== "aucun" ? " · chelem" : ""}
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-slate-600">
            À la table : {detail.table.map((i) => joueurs[i]).join(", ")}
            {d0.donneur !== undefined && d0.donneur !== null ? ` · ${joueurs[d0.donneur]} distribuait` : ""}
          </div>
          {d0.miseres && d0.miseres.length > 0 && (
            <div className="font-mono text-[11px] leading-relaxed text-slate-600">
              {d0.miseres
                .map(
                  (m) =>
                    `Misère de ${m.type === "atout" ? "atout" : "tête"} — ${joueurs[m.joueur]}${
                      m.aTort ? " (annoncée à tort)" : ""
                    }`
                )
                .join(" · ")}
            </div>
          )}
          {detailExtra}
        </div>
      )}
    </div>
  );
}
