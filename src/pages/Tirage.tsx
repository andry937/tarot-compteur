import { useState } from "react";
import { ROMAINS, melangerAtouts, nomAtout } from "@/domain/score/regles";
import type { Atout } from "@/domain/score/regles";
import { Page, Header, GhostButton, Chip, Cta, Bar, Lien } from "@/components/ui";

interface Tire {
  joueur: number;
  carte: number;
}

interface TirageProps {
  joueurs: string[];
  onValider: (depart: number) => void;
  onRetour: () => void;
}

export default function Tirage({ joueurs, onValider, onRetour }: TirageProps) {
  const [paquet, setPaquet] = useState<Atout[]>(melangerAtouts);
  const [tires, setTires] = useState<Tire[]>([]);
  const [excuse, setExcuse] = useState<string | null>(null);
  const [manuel, setManuel] = useState(false);
  const [choix, setChoix] = useState(0);

  const suivant = tires.length;
  const fini = suivant >= joueurs.length;
  const plusFaible = fini
    ? tires.reduce((a, b) => (b.carte < a.carte ? b : a)).joueur
    : null;
  const entame = fini ? ((plusFaible as number) + 1) % joueurs.length : null;

  const tirer = () => {
    const reste = [...paquet];
    const carte = reste.shift() as Atout;
    setPaquet(reste);
    if (carte === "excuse") {
      setExcuse(joueurs[suivant]);
      return;
    }
    setExcuse(null);
    setTires([...tires, { joueur: suivant, carte }]);
  };

  const recommencer = () => {
    setPaquet(melangerAtouts());
    setTires([]);
    setExcuse(null);
  };

  return (
    <Page>
      <Header
        eyebrow="Avant la première donne"
        title="Qui distribue ?"
        actions={<GhostButton onClick={onRetour}>Retour</GhostButton>}
      />

      {manuel ? (
        <>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            Désignez le donneur de la première donne.
          </p>
          <div className="flex flex-wrap gap-2">
            {joueurs.map((j, i) => (
              <Chip key={i} on={choix === i} onClick={() => setChoix(i)}>
                {j}
              </Chip>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-800 pt-4">
            <p className="font-serif text-xl">
              {joueurs[choix]} distribue, {joueurs[(choix + 1) % joueurs.length]} entame.
            </p>
          </div>
          <Lien className="mt-4" onClick={() => setManuel(false)}>
            Revenir au tirage
          </Lien>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            Chacun retourne un atout. La carte la plus faible distribue la première donne, et son
            voisin de droite entame. L'Excuse ne compte pas : on tire à nouveau.
          </p>

          {tires.map((t) => (
            <div
              key={t.joueur}
              className={`mb-2 flex items-center justify-between gap-2.5 rounded-lg border px-3.5 py-3 ${
                plusFaible === t.joueur
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-slate-700 bg-slate-900/40"
              }`}
            >
              <span className="flex-1 truncate text-sm">{joueurs[t.joueur]}</span>
              <span className="text-right font-serif text-xl font-bold leading-none text-amber-400">
                {ROMAINS[t.carte]}
                <small className="mt-0.5 block font-mono text-[9px] font-normal uppercase tracking-wide text-slate-400">
                  {nomAtout(t.carte)}
                </small>
              </span>
            </div>
          ))}

          {excuse && (
            <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-amber-400">
              {excuse} tire l'Excuse — carte blanche, on retire.
            </p>
          )}

          {fini && (
            <div className="mt-5 border-t border-slate-800 pt-4">
              <p className="font-serif text-xl">
                {joueurs[plusFaible as number]} distribue, {joueurs[entame as number]} entame.
              </p>
              <span className="mt-2 block font-mono text-[11px] leading-relaxed text-slate-400">
                Le donneur avance ensuite d'une place à chaque donne, dans l'ordre de la table.
              </span>
            </div>
          )}

          <Lien className="mt-4" onClick={fini ? recommencer : () => setManuel(true)}>
            {fini ? "Refaire le tirage" : "Désigner à la main"}
          </Lien>
        </>
      )}

      <Bar>
        {manuel ? (
          <Cta onClick={() => onValider(choix)}>Ouvrir la feuille</Cta>
        ) : fini ? (
          <Cta onClick={() => onValider(plusFaible as number)}>Ouvrir la feuille</Cta>
        ) : (
          <Cta onClick={tirer}>Tirer pour {joueurs[suivant]}</Cta>
        )}
      </Bar>
    </Page>
  );
}
