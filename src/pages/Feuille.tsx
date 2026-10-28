/**
 * Écran de la feuille de marque d'une table ouverte (`/partie/:id`).
 * @module
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import { useConfirmation } from "@/hooks/useConfirmation";
import { tableDeLaDonne, fmt } from "@/domain/score/regles";
import type { Partie } from "@/domain/types";
import Saisie from "@/components/saisie/Saisie";
import ScoreGrid from "@/components/feuille/ScoreGrid";
import StatsPartie from "@/components/stats/StatsPartie";
import GraphiqueComparatif from "@/components/graphiques/GraphiqueComparatif";
import { entameDeLaDonne } from "@/domain/cartes/cartes";
import JournalPlis from "@/components/cartes/JournalPlis";
import EcranMains from "@/components/cartes/EcranMains";
import { Page, Header, GhostButton, GhostLink, Chip, Cta, Bar, Section, RankRow, Lien } from "@/components/ui";

/** La table active vient du store ; `partie` est passée par RoutePartie, qui a déjà vérifié qu'elle est chargée. */
export default observer(function Feuille({ partie }: {
  /** Composition de la table active, déjà chargée par la route. */
  partie: Partie;
}) {
  const store = useStore();
  const navigate = useNavigate();
  const t = store.table;
  const { joueurs, nbTotal, donnes, annulations, cartesEnCours, chienEnCours } = t;
  const { totaux, jouees } = t.resume;
  const { parDonne } = partie;
  const depart = partie.depart || 0;

  const [cumule, setCumule] = useState(true);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [saisie, setSaisie] = useState<{ index: number | null } | null>(null);
  const [mainsOuvert, setMainsOuvert] = useState<number | null>(null);
  const [petitSecOuvert, setPetitSecOuvert] = useState(false);
  const [joueurPetitSec, setJoueurPetitSec] = useState<number | null>(null);

  const [ordreOuvert, setOrdreOuvert] = useState(false);
  /** Brouillon du nouvel ordre : `ordre[position] = siège actuel`. */
  const [ordre, setOrdre] = useState<number[]>([]);
  const deplacer = (pos: number, sens: -1 | 1) =>
    setOrdre((o) => {
      const j = pos + sens;
      if (j < 0 || j >= o.length) return o;
      const c = [...o];
      [c[pos], c[j]] = [c[j], c[pos]];
      return c;
    });

  const rotation = nbTotal > parDonne;
  const prochaine = tableDeLaDonne(donnes.length, nbTotal, parDonne, depart);
  const auRepos = joueurs.map((_, i) => i).filter((i) => !prochaine.includes(i));

  const { enAttente: confirmerCloture, declencher: surCloturer } = useConfirmation(async () => {
    if (await store.cloturerPartie()) navigate("/");
  });

  // « Rejouer » : clôture cette table (les joueurs ne peuvent pas être assis à deux
  // tables) puis ouvre la composition d'une nouvelle table avec les mêmes joueurs.
  const { enAttente: confirmerRejouer, declencher: surRejouer } = useConfirmation(async () => {
    const composition = { noms: joueurs, parDonne };
    if (await store.cloturerPartie()) navigate("/composition", { state: composition });
  });

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
            <GhostButton
              onClick={() => {
                // Retour sans rien modifier : la table reste ouverte, reprenable plus tard.
                t.desactiver();
                navigate("/");
              }}
            >
              Accueil
            </GhostButton>
            <GhostButton onClick={surCloturer}>{confirmerCloture ? "Confirmer ?" : "Clôturer"}</GhostButton>
            <GhostButton onClick={surRejouer}>{confirmerRejouer ? "Confirmer ?" : "Rejouer"}</GhostButton>
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
        {!ordreOuvert ? (
          <Lien
            onClick={() => {
              setOrdre(joueurs.map((_, i) => i));
              setOrdreOuvert(true);
            }}
          >
            Changer l'ordre des joueurs
          </Lien>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-black/20 p-3.5" data-testid="changer-ordre">
            <span className="mb-2 flex font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Ordre autour de la table
            </span>
            <p className="mb-3 text-xs leading-relaxed text-slate-400">
              Les donnes déjà jouées gardent leurs joueurs. {joueurs[prochaine[0]]} reste le prochain donneur.
            </p>
            <div className="flex flex-col gap-1.5">
              {ordre.map((s, pos) => (
                <div key={s} className="flex items-center gap-2 text-sm text-slate-100">
                  <span className="flex-1">{joueurs[s]}</span>
                  <Chip on={false} onClick={() => deplacer(pos, -1)}>
                    ↑<span className="sr-only"> Monter {joueurs[s]}</span>
                  </Chip>
                  <Chip on={false} onClick={() => deplacer(pos, 1)}>
                    ↓<span className="sr-only"> Descendre {joueurs[s]}</span>
                  </Chip>
                </div>
              ))}
            </div>
            <div className="mt-3.5 flex items-center gap-2">
              <Lien onClick={() => setOrdreOuvert(false)}>Annuler</Lien>
              <div className="flex-1">
                <Cta
                  compact
                  onClick={() => {
                    t.reordonner(ordre);
                    setOrdreOuvert(false);
                    setOuverte(null);
                  }}
                >
                  Appliquer l'ordre
                </Cta>
              </div>
            </div>
          </div>
        )}
      </div>

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
                    t.ajouterAnnulation({
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
          <>
            {ouverte !== null && (donnes[ouverte]?.cartesJouees?.length || donnes[ouverte]?.chien?.length) ? (
              <details className="mt-2.5">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Cartes jouées ({donnes[ouverte].cartesJouees?.length ?? 0}{donnes[ouverte].chien?.length ? " · chien" : ""})
                </summary>
                <div className="mt-1.5">
                  <JournalPlis
                    clair
                    joueurs={joueurs}
                    table={donnes[ouverte].table}
                    entame={entameDeLaDonne(donnes[ouverte])}
                    cartes={donnes[ouverte].cartesJouees ?? []}
                    chien={donnes[ouverte].chien}
                  />
                </div>
              </details>
            ) : null}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ouverte !== null && donnes[ouverte]?.cartesJouees?.length ? (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-100"
                onClick={() => setMainsOuvert(ouverte)}
              >
                Voir les mains
              </button>
            ) : null}
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
                t.effacerDonne(ouverte as number);
                setOuverte(null);
              }}
            >
              Effacer cette donne
            </button>
          </div>
          </>
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

      {mainsOuvert !== null && donnes[mainsOuvert] && (
        <EcranMains
          joueurs={joueurs}
          donne={donnes[mainsOuvert]}
          numero={mainsOuvert + 1}
          onFermer={() => setMainsOuvert(null)}
        />
      )}

      {saisie && (
        <Saisie
          joueurs={joueurs}
          parDonne={parDonne}
          tableProposee={saisie.index !== null ? donnes[saisie.index].table : prochaine}
          total={nbTotal}
          numero={saisie.index !== null ? saisie.index + 1 : donnes.length + 1}
          donneInitiale={saisie.index !== null ? donnes[saisie.index] : undefined}
          brouillon={
            saisie.index === null
              ? { cartes: cartesEnCours, chien: chienEnCours, onCartes: t.modifierCartes, onChien: t.modifierChien }
              : undefined
          }
          onFermer={() => setSaisie(null)}
          onValider={(d) => {
            if (saisie.index !== null) {
              t.modifierDonne(saisie.index, d);
            } else {
              t.ajouterDonne(d);
            }
            setSaisie(null);
          }}
        />
      )}
    </Page>
  );
});
