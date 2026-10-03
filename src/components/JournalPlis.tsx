import { deriverPlis, libelleCourt, estBout } from "../utils/cartes";

interface JournalPlisProps {
  joueurs: string[];
  /** Sièges à table dans l'ordre de jeu. */
  table: number[];
  /** Siège qui entame le premier pli. */
  entame: number;
  cartes: string[];
  /** Fond clair (détail d'une donne dans la grille « papier ») plutôt que sombre. */
  clair?: boolean;
}

/** Liste en lecture seule des plis déduits d'une suite de cartes (qui a posé quoi, qui a remporté le pli). */
export default function JournalPlis({ joueurs, table, entame, cartes, clair }: JournalPlisProps) {
  const { plis } = deriverPlis(table, entame, cartes);
  const texte = clair ? "text-slate-600" : "text-slate-400";
  const fort = clair ? "text-slate-900" : "text-slate-100";
  return (
    <ol className="space-y-1.5" data-testid="journal-plis">
      {plis.map((p, k) => (
        <li key={k} className={`text-[12px] leading-relaxed ${texte}`} data-testid="pli">
          <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider">Pli {k + 1}</span>
          {p.cartes.map((c, j) => (
            <span key={j} className="mr-2 whitespace-nowrap">
              <span>{joueurs[p.joueurs[j]]}</span>{" "}
              <b className={`font-mono ${estBout(c) ? "text-amber-500" : fort}`}>{libelleCourt(c)}</b>
            </span>
          ))}
          {p.gagnant !== null && (
            <span className={`font-semibold ${fort}`}>→ {joueurs[p.gagnant]}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
