import { useState } from "react";
import { tableDeLaDonne, fmt } from "../utils/regles";
import type { Donne } from "../utils/regles";
import type { Annulation } from "../types";
import Saisie from "../components/Saisie";
import ScoreGrid from "../components/ScoreGrid";
import StatsPartie from "../components/StatsPartie";
import GraphiqueComparatif from "../components/GraphiqueComparatif";
import { Page, Header, GhostButton, GhostLink, Chip, Cta, Bar, Section, RankRow, Lien } from "../components/ui";

interface FeuilleProps {
  joueurs: string[];
  nbTotal: number;
  parDonne: number;
  depart: number;
  donnes: Donne[];
  annulations: Annulation[];
  totaux: number[];
  jouees: number[];
  cumuls: number[][];
  onAjouterDonne: (d: Donne) => void;
  onModifierDonne: (i: number, d: Donne) => void;
  onEffacerDonne: (i: number) => void;
  onAjouterAnnulation: (a: Annulation) => void;
  onNouvellePartie: () => void;
  onQuitterPartie: () => void;
}

export default function Feuille({
  joueurs,
  nbTotal,
  parDonne,
  depart,
  donnes,
  annulations,
  totaux,
  jouees,
  onAjouterDonne,
  onModifierDonne,
  onEffacerDonne,
  onAjouterAnnulation,
  onNouvellePartie,
  onQuitterPartie,
}: FeuilleProps) {
  const [cumule, setCumule] = useState(true);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [saisie, setSaisie] = useState<{ index: number | null } | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [confirmerQuitter, setConfirmerQuitter] = useState(false);
  const [petitSecOuvert, setPetitSecOuvert] = useState(false);
  const [joueurPetitSec, setJoueurPetitSec] = useState<number | null>(null);

  const rotation = nbTotal > parDonne;
  const prochaine = tableDeLaDonne(donnes.length, nbTotal, parDonne, depart);
  const auRepos = joueurs.map((_, i) => i).filter((i) => !prochaine.includes(i));

  const surNouvellePartie = () => {
    if (!confirmer) {
      setConfirmer(true);
      setTimeout(() => setConfirmer(false), 4000);
      return;
    }
    setConfirmer(false);
    onNouvellePartie();
  };

  const surQuitterPartie = () => {
    if (!confirmerQuitter) {
      setConfirmerQuitter(true);
      setTimeout(() => setConfirmerQuitter(false), 4000);
      return;
    }
    setConfirmerQuitter(false);
    onQuitterPartie();
  };

  const classement = joueurs
    .map((nom, i) => ({ nom, i, pts: totaux[i], n: jouees[i] }))
    .sort((a, b) => b.pts - a.pts);

  return (
    <Page>
      <Header
        eyebrow={`${nbTotal} à table · ${parDonne} par donne · ${donnes.length} jouée${donnes.length > 1 ? "s" : ""}`}
        title="Feuille de marque"
        actions={
          <>
            <GhostLink to="/historique">Historique</GhostLink>
            <GhostButton onClick={surQuitterPartie}>{confirmerQuitter ? "Confirmer ?" : "Accueil"}</GhostButton>
            <GhostButton onClick={surNouvellePartie}>{confirmer ? "Confirmer ?" : "Nouvelle"}</GhostButton>
          </>
        }
      />

      <dl className="mb-4 rounded-xl border border-slate-800 border-l-2 border-l-amber-400 bg-black/20 px-3.5 py-3">
        <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-400">
          Donne {donnes.length + 1}
        </dt>
        <dd className="mt-1 text-sm leading-snug">
          <b className="font-semibold text-slate-100">{joueurs[prochaine[0]]}</b> distribue ·{" "}
          <b className="font-semibold text-slate-100">{joueurs[prochaine[1]]}</b> entame
        </dd>
        {donnes.length > 0 && (
          <dd className="mt-1.5 text-xs text-slate-400">
            En tête : <b className="font-semibold text-amber-400">{classement[0].nom}</b>{" "}
            <span className="font-mono">{fmt(classement[0].pts)}</span>
          </dd>
        )}
        <dd className="mt-1.5 text-xs text-slate-400">À la table : {prochaine.map((i) => joueurs[i]).join(", ")}</dd>
        {auRepos.length > 0 && (
          <dd className="mt-1 text-xs text-slate-400">Au repos : {auRepos.map((i) => joueurs[i]).join(", ")}</dd>
        )}
      </dl>

      <div className="mb-4">
        {!petitSecOuvert ? (
          <Lien onClick={() => setPetitSecOuvert(true)}>Petit sec ? Annuler la donne</Lien>
        ) : (
          <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-3.5">
            <span className="mb-2 flex font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Qui a le Petit sec ?
            </span>
            <p className="mb-3 text-xs leading-relaxed text-slate-400">
              Seul atout en main : Le Petit, sans l'Excuse. La donne est annulée et redonnée par{" "}
              {joueurs[prochaine[0]]}.
            </p>
            <div className="flex flex-wrap gap-2">
              {prochaine.map((i) => (
                <Chip key={i} on={joueurPetitSec === i} onClick={() => setJoueurPetitSec(i)}>
                  {joueurs[i]}
                </Chip>
              ))}
            </div>
            <div className="mt-3.5 flex items-center gap-2">
              <Lien
                onClick={() => {
                  setPetitSecOuvert(false);
                  setJoueurPetitSec(null);
                }}
              >
                Annuler
              </Lien>
              <div className="flex-1">
                <Cta
                  compact
                  disabled={joueurPetitSec === null}
                  onClick={() => {
                    onAjouterAnnulation({
                      id: `${Date.now()}`,
                      avantDonne: donnes.length,
                      table: prochaine,
                      donneur: prochaine[0],
                      joueur: joueurPetitSec as number,
                      date: new Date().toISOString(),
                    });
                    setPetitSecOuvert(false);
                    setJoueurPetitSec(null);
                  }}
                >
                  Confirmer la redistribution
                </Cta>
              </div>
            </div>
          </div>
        )}
      </div>

      <ScoreGrid
        joueurs={joueurs}
        nbTotal={nbTotal}
        donnes={donnes}
        cumule={cumule}
        onCumule={setCumule}
        ouverte={ouverte}
        onOuvrir={setOuverte}
        vide={
          <div className="p-8 text-center">
            <p className="font-serif text-lg">La feuille est vierge.</p>
            <span className="mt-1 block font-mono text-xs text-slate-500">
              Notez la première donne pour lancer la partie
            </span>
          </div>
        }
        detailExtra={
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-100"
              onClick={() => setSaisie({ index: ouverte })}
            >
              Modifier cette donne
            </button>
            <button
              type="button"
              className="rounded-full border border-rose-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-rose-600 hover:bg-rose-100"
              onClick={() => {
                onEffacerDonne(ouverte as number);
                setOuverte(null);
              }}
            >
              Effacer cette donne
            </button>
          </div>
        }
      />

      <StatsPartie donnes={donnes} joueurs={joueurs} nbTotal={nbTotal} />
      <GraphiqueComparatif donnes={donnes} joueurs={joueurs} nbTotal={nbTotal} />

      {donnes.length > 0 && (
        <Section title="Classement">
          {classement.map((c, r) => (
            <RankRow
              key={c.i}
              rang={r + 1}
              nom={c.nom}
              meta={`${c.n} donnes`}
              valeur={c.pts}
              negatif={c.pts < 0}
              testId="classement-row"
            />
          ))}
        </Section>
      )}

      {annulations.length > 0 && (
        <Section title="Redistributions">
          {annulations
            .slice()
            .reverse()
            .map((a) => (
              <div key={a.id} className="py-1 font-mono text-[11px] leading-relaxed text-slate-400">
                Avant la donne {a.avantDonne + 1} — Petit sec de {joueurs[a.joueur]}, redonne.
              </div>
            ))}
        </Section>
      )}

      <details className="mt-6 border-t border-slate-800 pt-4">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Comment les points sont comptés
        </summary>
        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
          Le preneur doit réunir <code className="font-mono text-amber-400">56 / 51 / 41 / 36</code> points selon
          qu'il possède 0, 1, 2 ou 3 bouts. Le score d'une donne vaut{" "}
          <code className="font-mono text-amber-400">(25 + écart) × contrat</code>, auquel s'ajoutent le petit au
          bout (10 × contrat, pour le camp qui le réalise), la poignée (20 / 30 / 40, pour le camp gagnant) et le
          chelem (200 non annoncé, 400 annoncé, −200 s'il chute). Le preneur gagne ou perd ce score autant de fois
          qu'il y a de défenseurs ; à cinq, l'appelé en prend une part et le preneur deux.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
          <strong className="text-slate-100">Petit sec</strong> — si le seul atout d'un joueur est Le Petit, sans
          l'Excuse, il doit l'annoncer avant les enchères : la donne est annulée et redonnée par le même donneur,
          sans effet sur le score.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
          <strong className="text-slate-100">Misère</strong> — un joueur sans aucun atout (misère d'atout) ou sans
          aucun honneur (misère de tête) peut l'annoncer une fois le chien incorporé, avant la première carte.
          Chaque autre joueur à table lui paie alors 10 points, même dans son propre camp — annoncée à tort, c'est
          l'inverse. L'Excuse annule toute misère.
          {rotation &&
            ` Les joueurs au repos marquent 0 : la table tourne d'un cran à chaque donne, donc au bout de ${nbTotal} donnes chacun aura joué ${parDonne} fois.`}
        </p>
      </details>

      <Bar>
        <Cta onClick={() => setSaisie({ index: null })}>Noter la donne {donnes.length + 1}</Cta>
      </Bar>

      {saisie && (
        <Saisie
          joueurs={joueurs}
          parDonne={parDonne}
          tableProposee={saisie.index !== null ? donnes[saisie.index].table : prochaine}
          total={nbTotal}
          numero={saisie.index !== null ? saisie.index + 1 : donnes.length + 1}
          donneInitiale={saisie.index !== null ? donnes[saisie.index] : undefined}
          onFermer={() => setSaisie(null)}
          onValider={(d) => {
            if (saisie.index !== null) {
              onModifierDonne(saisie.index, d);
            } else {
              onAjouterDonne(d);
            }
            setSaisie(null);
          }}
        />
      )}
    </Page>
  );
}
