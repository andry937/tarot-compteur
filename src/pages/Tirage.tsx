import { useState } from "react";
import type { ChoixDonneur } from "@/domain/types";
import { Page, Header, GhostButton, Field, Label, Chip, Cta, Bar } from "@/components/ui";

interface TirageProps {
  joueurs: string[];
  parDonne: number;
  onValider: (choix: ChoixDonneur) => void;
  onRetour: () => void;
}

const btnFleche =
  "h-9 w-9 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 text-base text-slate-200 hover:border-slate-500 disabled:opacity-30";

export default function Tirage({ joueurs, parDonne, onValider, onRetour }: TirageProps) {
  const [ordre, setOrdre] = useState<number[]>(() => joueurs.map((_, i) => i));
  const [auRepos, setAuRepos] = useState<number[]>([]);
  const [donneur, setDonneur] = useState(0);

  const nbRepos = Math.max(0, joueurs.length - parDonne);
  const jouant = ordre.filter((i) => !auRepos.includes(i));
  const reposManquants = nbRepos - auRepos.length;
  const donneurValide = jouant.includes(donneur) ? donneur : jouant[0];
  const entame = jouant[(jouant.indexOf(donneurValide) + 1) % jouant.length];

  const deplacer = (pos: number, delta: number) =>
    setOrdre((o) => {
      const copie = [...o];
      [copie[pos], copie[pos + delta]] = [copie[pos + delta], copie[pos]];
      return copie;
    });

  const basculerRepos = (i: number) => {
    if (auRepos.includes(i)) setAuRepos(auRepos.filter((x) => x !== i));
    else if (auRepos.length < nbRepos) setAuRepos([...auRepos, i]);
  };

  return (
    <Page>
      <Header
        eyebrow="Avant la première donne"
        title="Qui distribue ?"
        actions={<GhostButton onClick={onRetour}>Retour</GhostButton>}
      />

      <Field>
        <Label>
          <span>Ordre autour de la table</span>
          {nbRepos > 0 && (
            <em className="not-italic text-amber-400">
              {auRepos.length} / {nbRepos} au repos
            </em>
          )}
        </Label>
        <div className="flex flex-col gap-2" data-testid="ordre-joueurs">
          {ordre.map((i, pos) => {
            const repos = auRepos.includes(i);
            return (
              <div key={i} className="flex items-center gap-2" data-testid="ligne-joueur">
                <button
                  type="button"
                  className={btnFleche}
                  aria-label={`Monter ${joueurs[i]}`}
                  disabled={pos === 0}
                  onClick={() => deplacer(pos, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={btnFleche}
                  aria-label={`Descendre ${joueurs[i]}`}
                  disabled={pos === ordre.length - 1}
                  onClick={() => deplacer(pos, 1)}
                >
                  ↓
                </button>
                <div className={`flex-1 ${repos ? "opacity-40" : ""}`}>
                  <Chip on={!repos && donneurValide === i} onClick={() => !repos && setDonneur(i)}>
                    {joueurs[i]}
                  </Chip>
                </div>
                {nbRepos > 0 && (
                  <button
                    type="button"
                    aria-pressed={repos}
                    aria-label={`Repos ${joueurs[i]}`}
                    className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
                      repos
                        ? "border-amber-400 bg-amber-400/10 text-amber-300"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                    onClick={() => basculerRepos(i)}
                  >
                    Repos
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <p className="mb-2 text-sm leading-relaxed text-slate-400">Touchez un joueur pour le désigner donneur.</p>
        {reposManquants > 0 ? (
          <p className="font-serif text-xl">
            Désignez {reposManquants} joueur{reposManquants > 1 ? "s" : ""} au repos.
          </p>
        ) : (
          <p className="font-serif text-xl">
            {joueurs[donneurValide]} distribue, {joueurs[entame]} entame.
          </p>
        )}
        <span className="mt-2 block font-mono text-[11px] leading-relaxed text-slate-400">
          Le donneur avance ensuite d'une place à chaque donne, dans l'ordre de la table.
        </span>
      </div>

      <Bar>
        <Cta
          disabled={reposManquants > 0}
          onClick={() => onValider({ ordre, auRepos, donneur: donneurValide })}
        >
          Ouvrir la feuille
        </Cta>
      </Bar>
    </Page>
  );
}
