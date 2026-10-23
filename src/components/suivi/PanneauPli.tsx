import { estBout, libelleCourt } from "@/domain/cartes/cartes";
import { corrigerEntame, corrigerGagnant, corrigerJoueur, effacerCorrections } from "@/vision/domain/corrections";
import type { CibleCorrection } from "@/vision/domain/corrections";
import type { EtatSuivi, Phase, Pose, SurchargePli } from "@/vision/domain/machinePli";
import { nbPlisTotal, plisRestants } from "@/vision/domain/machinePli";
import { Bouton, classeSelect, Section } from "@/vision/ui";

export type Corriger = (f: (suivi: EtatSuivi) => EtatSuivi) => void;

const PHASES: Record<Phase, string> = {
  attente: "En attente d'un pli",
  enCours: "Pli en cours",
  complet: "Pli complet",
  ramassage: "Ramassage…",
  termine: "Manche terminée",
};

const nom = (noms: string[], j: number) => noms[j] || `Joueur ${j + 1}`;

function Cartes({ poses, noms }: { poses: Pose[]; noms: string[] }) {
  return (
    <span>
      {poses.map((p, i) => (
        <span key={i} className="mr-2 whitespace-nowrap text-xs text-slate-400">
          {nom(noms, p.joueur)}{" "}
          <b className={`font-mono ${estBout(p.carte) ? "text-amber-400" : "text-slate-100"}`}>{libelleCourt(p.carte)}</b>
        </span>
      ))}
    </span>
  );
}

const AUTO = "auto";
const versJoueur = (v: string): number | null => (v === AUTO ? null : Number(v));

/**
 * Corrections d'un pli : la caméra ne voit pas les joueurs, l'ordre d'arrivée des cartes peut se tromper
 * (cartes posées ensemble, joueur hors tour). Chaque champ « Auto » laisse la déduction faire.
 */
function CorrectionPli({ cible, poses, entameAuto, avecGagnant, surcharge, table, noms, onCorriger }: {
  cible: CibleCorrection;
  poses: Pose[];
  /** Entame déduite (gagnant du pli précédent), sans la correction. */
  entameAuto: number;
  avecGagnant?: boolean;
  surcharge: SurchargePli;
  table: number[];
  noms: string[];
  onCorriger: Corriger;
}) {
  const nomCible = cible === "courant" ? "pli en cours" : `pli ${cible}`;
  const options = (auto: string) => [
    <option key={AUTO} value={AUTO}>{auto}</option>,
    ...table.map((j) => <option key={j} value={j}>{nom(noms, j)}</option>),
  ];
  const modifie = surcharge.entame !== undefined || surcharge.gagnant !== undefined || Object.keys(surcharge.joueurs ?? {}).length > 0;
  return (
    <details className="mt-1 rounded-lg border border-slate-800 p-2 text-xs" data-testid={`correction-${cible}`}>
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Corriger{modifie ? " (modifié)" : ""}
      </summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center justify-between gap-2 text-slate-400">
          Entame
          <select aria-label={`Entame du ${nomCible}`} className={`${classeSelect} max-w-[11rem]`} value={surcharge.entame ?? AUTO}
            onChange={(e) => onCorriger((x) => corrigerEntame(x, cible, versJoueur(e.target.value)))}>
            {options(`Auto (${nom(noms, entameAuto)})`)}
          </select>
        </label>
        {poses.map((p) => (
          <label key={p.carte} className="flex items-center justify-between gap-2 text-slate-400">
            <b className={`font-mono ${estBout(p.carte) ? "text-amber-400" : "text-slate-100"}`}>{libelleCourt(p.carte)}</b>
            <select aria-label={`Joueur de ${libelleCourt(p.carte)} (${nomCible})`} className={`${classeSelect} max-w-[11rem]`}
              value={surcharge.joueurs?.[p.carte] ?? AUTO}
              onChange={(e) => onCorriger((x) => corrigerJoueur(x, cible, p.carte, versJoueur(e.target.value)))}>
              {options("Auto")}
            </select>
          </label>
        ))}
        {avecGagnant && typeof cible === "number" && (
          <label className="flex items-center justify-between gap-2 text-slate-400">
            Gagnant
            <select aria-label={`Gagnant du ${nomCible}`} className={`${classeSelect} max-w-[11rem]`} value={surcharge.gagnant ?? AUTO}
              onChange={(e) => onCorriger((x) => corrigerGagnant(x, cible, versJoueur(e.target.value)))}>
              {options("Auto (règles)")}
            </select>
          </label>
        )}
        {modifie && <Bouton onClick={() => onCorriger((x) => effacerCorrections(x, cible))}>Effacer les corrections</Bouton>}
      </div>
    </details>
  );
}

/** Entame déduite du pli qui suit les `n` premiers plis : le gagnant du n-ième, ou l'entame de la donne. */
const entameApres = (etat: EtatSuivi, n: number): number => (n > 0 ? etat.plis[n - 1].gagnant : etat.config.entameInitiale);

export default function PanneauPli({ etat, noms, onCorriger }: { etat: EtatSuivi; noms: string[]; onCorriger?: Corriger }) {
  const dernier = etat.plis[etat.plis.length - 1];
  const { table } = etat.config;
  return (
    <>
      <Section titre="Pli en cours" droite={<span className="font-mono text-[10px] text-slate-400">{plisRestants(etat)}/{nbPlisTotal(etat)} plis restants</span>}>
        <p className="text-sm font-semibold text-amber-400" data-testid="phase">{PHASES[etat.phase]}</p>
        {etat.phase === "enCours" && (
          <div className="mt-1" data-testid="pli-en-cours">
            <Cartes poses={etat.poseCourante} noms={noms} />
          </div>
        )}
        {(etat.phase === "complet" || etat.phase === "ramassage") && dernier && (
          <div className="mt-1" data-testid="pli-complet">
            <Cartes poses={dernier.poses} noms={noms} />
            <p className="mt-1 text-sm">
              Pli {dernier.numero} remporté par <b className="text-amber-400">{nom(noms, dernier.gagnant)}</b>
            </p>
          </div>
        )}
        {etat.phase === "attente" && etat.plis.length < nbPlisTotal(etat) && (
          <p className="mt-1 text-xs text-slate-500">Entame attendue : {nom(noms, etat.entameAttendue)}</p>
        )}
        {onCorriger && etat.plis.length < nbPlisTotal(etat) && (etat.phase === "attente" || etat.phase === "enCours") && (
          <CorrectionPli cible="courant" poses={etat.poseCourante} entameAuto={entameApres(etat, etat.plis.length)} surcharge={etat.surchargeCourante}
            table={table} noms={noms} onCorriger={onCorriger} />
        )}
      </Section>

      <Section titre="Historique des plis">
        {etat.plis.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun pli terminé.</p>
        ) : (
          <ol className="space-y-1" data-testid="historique">
            {[...etat.plis].reverse().map((p) => (
              <li key={p.numero} className="text-xs text-slate-400" data-testid="pli-historique">
                <span className="mr-1.5 whitespace-nowrap font-mono text-[10px] uppercase">Pli {p.numero}</span>
                <Cartes poses={p.poses} noms={noms} />
                <b className="text-slate-100">→ {nom(noms, p.gagnant)}</b>
                {p.surcharge && <span className="ml-1 text-[10px] text-amber-400">corrigé</span>}
                {onCorriger && (
                  <CorrectionPli cible={p.numero} poses={p.poses} entameAuto={entameApres(etat, p.numero - 1)} avecGagnant surcharge={p.surcharge ?? {}}
                    table={table} noms={noms} onCorriger={onCorriger} />
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
