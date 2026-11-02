/**
 * Podium animé (3 marches, le vainqueur se révèle en dernier), partagé par les annonces de fin de partie et de soirée.
 * @module
 */
import { fmt } from "@/domain/score/regles";

/** Hauteur, médaille et décalage (en secondes) d'apparition de chaque marche. */
const MARCHES = [
  { medaille: "🥇", hauteur: "h-28", decalage: 1.2 },
  { medaille: "🥈", hauteur: "h-20", decalage: 0.6 },
  { medaille: "🥉", hauteur: "h-14", decalage: 0 },
];

/** Podium des trois premiers (de `lignes`, déjà triées) ; rien s'il y a moins de deux joueurs. */
export default function PodiumAnime({
  lignes,
  delai = 0.4,
  testId,
}: {
  lignes: { nom: string; pts: number }[];
  /** Secondes d'attente avant la première marche. */
  delai?: number;
  testId?: string;
}) {
  const podium = lignes.slice(0, 3);
  if (podium.length < 2) return null;
  return (
    <div className="mt-6 flex items-end justify-center gap-2" data-testid={testId}>
      {/* Ordre visuel : 2e, 1er, 3e. */}
      {[1, 0, 2].map((rang) => {
        const l = podium[rang];
        if (!l) return null;
        const m = MARCHES[rang];
        return (
          <div
            key={l.nom}
            className="animate-apparition flex w-1/3 max-w-[9rem] flex-col items-center"
            style={{ animationDelay: `${delai + m.decalage}s` }}
          >
            <span className="text-2xl" aria-hidden="true">{m.medaille}</span>
            <span className="mt-1 max-w-full truncate text-sm font-semibold text-slate-100">{l.nom}</span>
            <span className={`font-mono text-xs ${l.pts < 0 ? "text-rose-400" : "text-slate-400"}`}>{fmt(l.pts)}</span>
            <div className={`mt-1 w-full rounded-t-lg border border-b-0 border-slate-700 bg-slate-800 ${m.hauteur} ${rang === 0 ? "border-amber-400/60" : ""}`} />
          </div>
        );
      })}
    </div>
  );
}
