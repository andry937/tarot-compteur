/**
 * Panneau de statistiques sur les donnes d'une partie.
 * @module
 */

import { calculerStatsPartie } from "@/domain/stats/statsPartie";
import { NOM_ROI } from "@/domain/score/regles";
import type { Donne, Roi } from "@/domain/score/regles";
import { Section } from "@/components/ui";

interface StatsPartieProps {
  donnes: Donne[];
  joueurs: string[];
  nbTotal: number;
}

/** Symbole et couleur de chaque couleur de roi. */
const SYMBOLE_ROI: Record<Roi, { symbole: string; couleur: string }> = {
  coeur: { symbole: "♥", couleur: "text-rose-400" },
  carreau: { symbole: "♦", couleur: "text-rose-400" },
  trefle: { symbole: "♣", couleur: "text-slate-200" },
  pique: { symbole: "♠", couleur: "text-slate-200" },
};

/** Barre horizontale proportionnelle au maximum de la liste. */
function LigneBarre({
  etiquette,
  fois,
  max,
  couleurBarre,
}: {
  etiquette: React.ReactNode;
  fois: number;
  max: number;
  couleurBarre: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-24 shrink-0 truncate text-sm">{etiquette}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
        <div className={`h-2 rounded ${couleurBarre}`} style={{ width: `${(100 * fois) / max}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-serif text-base font-bold">{fois}</span>
    </div>
  );
}

/** Panneau de statistiques sur les donnes d'une seule partie (en cours ou
 * archivée) — distinct de la fiche joueur cumulée sur tout l'historique. */
export default function StatsPartie({ donnes, joueurs, nbTotal }: StatsPartieProps) {
  if (donnes.length === 0) return null;
  const stats = calculerStatsPartie(donnes, joueurs, nbTotal);
  const pct = Math.round((100 * stats.reussies) / stats.nbDonnes);
  const maxRoi = Math.max(1, ...stats.roisAppeles.map((r) => r.fois));
  const maxJoueur = Math.max(1, ...stats.joueursAppeles.map((j) => j.fois));

  return (
    <Section title="Statistiques de la partie">
      <div className="flex flex-col gap-5 px-1 pb-1 pt-2">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl font-bold leading-none text-amber-400">{pct}%</span>
            <span className="text-sm text-slate-300">de contrats réussis</span>
            <span className="ml-auto font-mono text-[11px] text-slate-400">{stats.nbDonnes} donnes</span>
          </div>
          <div className="flex h-2.5 gap-[3px]" aria-hidden="true">
            {stats.reussies > 0 && (
              <div className="rounded-l-full bg-amber-400" style={{ flex: stats.reussies }} />
            )}
            {stats.chutees > 0 && <div className="rounded-r-full bg-rose-400" style={{ flex: stats.chutees }} />}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-amber-400">
              <b className="font-serif text-lg">{stats.reussies}</b> réussis
            </span>
            <span className="text-rose-400">
              chutés <b className="font-serif text-lg">{stats.chutees}</b>
            </span>
          </div>
        </div>

        {(stats.avecAppele > 0 || stats.preneurSeul > 0) && (
          <div className="grid grid-cols-2 gap-2.5 border-t border-slate-800 pt-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="font-serif text-3xl font-bold">{stats.avecAppele}</div>
              <div className="text-xs text-slate-400">mains avec appelé</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="font-serif text-3xl font-bold">{stats.preneurSeul}</div>
              <div className="text-xs text-slate-400">mains preneur seul</div>
            </div>
          </div>
        )}

        {stats.roisAppeles.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-semibold text-slate-300">Rois appelés</h3>
            {stats.roisAppeles.map((r) => (
              <LigneBarre
                key={r.roi}
                etiquette={
                  <>
                    <span className={`mr-2 text-lg ${SYMBOLE_ROI[r.roi].couleur}`} aria-hidden="true">
                      {SYMBOLE_ROI[r.roi].symbole}
                    </span>
                    {NOM_ROI[r.roi]}
                  </>
                }
                fois={r.fois}
                max={maxRoi}
                couleurBarre="bg-amber-400"
              />
            ))}
          </div>
        )}

        {stats.joueursAppeles.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-semibold text-slate-300">Joueurs appelés</h3>
            {stats.joueursAppeles.map((j) => (
              <LigneBarre key={j.joueur} etiquette={j.joueur} fois={j.fois} max={maxJoueur} couleurBarre="bg-slate-400" />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
