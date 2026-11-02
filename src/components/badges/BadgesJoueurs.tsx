/**
 * Badges des joueurs d'une table : un titre par ligne avec sa preuve en chiffres.
 * @module
 */
import { BADGES } from "@/domain/stats/badges";
import type { BadgeAttribue } from "@/domain/stats/badges";

interface BadgesJoueursProps {
  /** Noms affichés, parallèles à `ids`. */
  noms: string[];
  /** Identifiants des joueurs (ceux de `badges[].joueurId`). */
  ids: string[];
  /** Badges attribués, ou `undefined` tant qu'ils ne sont pas calculés. */
  badges?: BadgeAttribue[];
  /** Affiche un message d'attente tant que les badges ne sont pas arrivés. */
  enCours?: boolean;
}

/** Liste « joueur → badges » ; n'affiche que les joueurs qui en ont un. */
export default function BadgesJoueurs({ noms, ids, badges, enCours }: BadgesJoueursProps) {
  if (!badges) {
    return enCours ? (
      <p className="mt-4 font-mono text-[11px] text-slate-500" data-testid="badges-attente">
        Badges en cours de calcul…
      </p>
    ) : null;
  }
  const lignes = ids
    .map((id, i) => ({ nom: noms[i], liste: badges.filter((b) => b.joueurId === id) }))
    .filter((l) => l.liste.length > 0);
  if (lignes.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-col gap-2" data-testid="badges-joueurs">
      {lignes.map((l) => (
        <li key={l.nom} className="rounded-xl border border-slate-800 bg-black/20 px-3 py-2">
          <b className="text-sm font-semibold text-slate-100">{l.nom}</b>
          {l.liste.map((b) => (
            <div key={b.badge} className="mt-0.5 text-xs text-slate-300" data-testid="badge">
              <span aria-hidden="true">{BADGES[b.badge].emoji}</span>{" "}
              <span className="font-semibold text-amber-300">{BADGES[b.badge].nom}</span>{" "}
              <span className="text-slate-400">· {b.detail}</span>
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}
