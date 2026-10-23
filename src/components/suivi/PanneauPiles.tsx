import { estBout, libelleCourt, trierCartes } from "@/domain/cartes/cartes";
import type { Roi } from "@/domain/score/regles";
import { NOM_ROI } from "@/domain/score/regles";
import type { Annonce } from "@/vision/domain/annonce";
import { scoresDirects } from "@/vision/domain/annonce";
import type { EtatSuivi } from "@/vision/domain/machinePli";
import { construirePiles, pointsDe } from "@/vision/domain/piles";
import { Champ, Section, classeSelect } from "@/vision/ui";

interface Props {
  etat: EtatSuivi;
  noms: string[];
  annonce: Annonce;
  onAnnonce: (a: Annonce) => void;
}

const nom = (noms: string[], j: number) => noms[j] || `Joueur ${j + 1}`;

export default function PanneauPiles({ etat, noms, annonce, onAnnonce }: Props) {
  const piles = construirePiles(etat.plis);
  const scores = scoresDirects(etat, annonce);
  const appele =
    scores.appele === undefined ? "pas encore découvert" : scores.appele === null ? (annonce.roiAppele ? "le preneur joue seul" : "aucun") : nom(noms, scores.appele);

  return (
    <>
      <Section titre="Annonce et scores en direct">
        <div className="grid grid-cols-2 gap-2">
          <Champ libelle="Preneur">
            <select className={classeSelect} value={annonce.preneur} onChange={(e) => onAnnonce({ ...annonce, preneur: Number(e.target.value) })} data-testid="preneur">
              {etat.config.table.map((j) => (
                <option key={j} value={j}>{nom(noms, j)}</option>
              ))}
            </select>
          </Champ>
          <Champ libelle="Roi appelé">
            <select className={classeSelect} value={annonce.roiAppele ?? ""} onChange={(e) => onAnnonce({ ...annonce, roiAppele: (e.target.value || null) as Roi | null })} data-testid="roi-appele">
              <option value="">Aucun (à 3 ou 4)</option>
              {(Object.entries(NOM_ROI) as [Roi, string][]).map(([id, n]) => (
                <option key={id} value={id}>{n}</option>
              ))}
            </select>
          </Champ>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-950/60 p-2">
            <dt className="font-mono text-[10px] uppercase text-slate-400">Attaque</dt>
            <dd className="font-serif text-2xl font-bold text-amber-400" data-testid="points-attaque">{scores.attaque}</dd>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-2">
            <dt className="font-mono text-[10px] uppercase text-slate-400">Défense</dt>
            <dd className="font-serif text-2xl font-bold" data-testid="points-defense">{scores.defense}</dd>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-2">
            <dt className="font-mono text-[10px] uppercase text-slate-400">Appelé</dt>
            <dd className="text-xs leading-tight" data-testid="appele">{appele}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-slate-500">Points des plis terminés ; l'écart du preneur s'ajoute en fin de manche (cartes jamais jouées).</p>
      </Section>

      <Section titre="Piles des joueurs">
        <ul className="space-y-1.5">
          {etat.config.table.map((j) => {
            const cartes = trierCartes(piles[j] ?? []);
            return (
              <li key={j} className="text-xs text-slate-400" data-testid="pile">
                <b className="mr-1.5 text-slate-100">{nom(noms, j)}</b>
                <span className="mr-1.5 font-mono text-[10px]" data-testid="pile-points">{pointsDe(cartes)} pts · {cartes.length} cartes</span>
                {cartes.map((c) => (
                  <span key={c} className={`mr-1.5 font-mono ${estBout(c) ? "text-amber-400" : "text-slate-300"}`}>{libelleCourt(c)}</span>
                ))}
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
