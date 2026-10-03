import { decoder, estBout, libelleCourt, SYMBOLE_COULEUR } from "@/domain/cartes/cartes";
import type { MainsDeduites } from "@/domain/cartes/cartes";
import { Section } from "@/components/ui";

const FAMILLES = ["atout", "excuse", "coeur", "carreau", "trefle", "pique"] as const;

/** Cartes d'une main sur une ligne par famille (atouts, Excuse, ♥ ♦ ♣ ♠), bouts en jaune, cartes du chien en bleu. */
function Cartes({ cartes, chien = [] }: { cartes: string[]; chien?: string[] }) {
  const parFamille = FAMILLES.map((f) => ({ f, liste: cartes.filter((c) => decoder(c).famille === f) })).filter(
    (g) => g.liste.length > 0
  );
  if (parFamille.length === 0) return <p className="text-xs text-slate-500">Aucune carte</p>;
  return (
    <div className="space-y-1">
      {parFamille.map(({ f, liste }) => (
        <div key={f} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[12.5px]">
          <span className="w-4 shrink-0 text-slate-500">
            {f === "atout" ? "T" : f === "excuse" ? "" : SYMBOLE_COULEUR[f]}
          </span>
          {liste.map((c) => (
            <b
              key={c}
              className={
                estBout(c) ? "text-amber-400" : chien.includes(c) ? "text-sky-300" : "font-semibold text-slate-100"
              }
            >
              {libelleCourt(c)}
            </b>
          ))}
        </div>
      ))}
    </div>
  );
}

interface MainsJoueursProps {
  joueurs: string[];
  preneur: number;
  /** Cartes retournées au chien (pour repérer celles que le preneur a prises). */
  chien?: string[];
  mains: MainsDeduites;
}

/** Mains reconstituées de chaque joueur après la donne, lecture seule. */
export default function MainsJoueurs({ joueurs, preneur, chien = [], mains }: MainsJoueursProps) {
  return (
    <div data-testid="mains-joueurs">
      {mains.anomalies.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-300" data-testid="anomalies-mains">
          {mains.anomalies.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}
      {!mains.complete && (
        <p className="mt-4 text-xs text-slate-400" data-testid="mains-partielles">
          Main partielle : tous les plis ne sont pas notés, les cartes ci-dessous sont celles déjà jouées.
        </p>
      )}
      {mains.mains.map((m) => {
        const estPreneur = m.joueur === preneur;
        const atouts = m.cartes.filter((c) => decoder(c).famille === "atout" || c === "excuse").length;
        const bouts = m.cartes.filter(estBout).length;
        return (
          <Section key={m.joueur} title={`${joueurs[m.joueur]}${estPreneur ? " · preneur" : ""}`}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-400" data-testid="resume-main">
              {m.cartes.length}
              {mains.complete ? "" : `/${m.attendues}`} cartes · {atouts} atout{atouts > 1 ? "s" : ""} · {bouts} bout
              {bouts > 1 ? "s" : ""}
            </div>
            {estPreneur && mains.departPreneur && (
              <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/40 p-2.5" data-testid="main-depart">
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Main de départ (avant le chien)
                </div>
                <Cartes cartes={mains.departPreneur} />
              </div>
            )}
            {estPreneur && chien.length > 0 && (
              <div className="mb-3 text-[12px] text-slate-400">
                <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider">Chien</span>
                {chien.map((c) => (
                  <b key={c} className={`mr-2 font-mono ${estBout(c) ? "text-amber-400" : "text-sky-300"}`}>
                    {libelleCourt(c)}
                  </b>
                ))}
              </div>
            )}
            {estPreneur && mains.ecart && (
              <div className="mb-3 text-[12px] text-slate-400" data-testid="ecart">
                <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider">Écart</span>
                {mains.ecart.map((c) => (
                  <b key={c} className={`mr-2 font-mono ${estBout(c) ? "text-amber-400" : "text-slate-100"}`}>
                    {libelleCourt(c)}
                  </b>
                ))}
              </div>
            )}
            {estPreneur && mains.chienNonVu && (
              <div className="mb-3 text-[12px] text-slate-400" data-testid="chien-non-vu">
                <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider">Chien non retourné</span>
                {mains.chienNonVu.map((c) => (
                  <b key={c} className="mr-2 font-mono text-slate-100">
                    {libelleCourt(c)}
                  </b>
                ))}
              </div>
            )}
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              {estPreneur && mains.departPreneur ? "Main après écart" : "Main"}
            </div>
            <div className="mt-1.5">
              <Cartes cartes={m.cartes} chien={estPreneur ? chien : []} />
            </div>
          </Section>
        );
      })}
    </div>
  );
}

