import { useState } from "react";
import { resumerDonnees } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import { resoudreNom } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import type { ArchiveRecord } from "@/domain/types";
import { Section, RankRow } from "@/components/ui";
import ScoreGrid from "./ScoreGrid";
import StatsPartie from "@/components/stats/StatsPartie";
import GraphiqueComparatif from "@/components/graphiques/GraphiqueComparatif";
import Saisie from "@/components/saisie/Saisie";
import JournalPlis from "@/components/cartes/JournalPlis";
import EcranMains from "@/components/cartes/EcranMains";
import { entameDeLaDonne } from "@/domain/cartes/cartes";

interface ArchiveFeuilleProps {
  record: ArchiveRecord & { joueurs?: string[] };
  roster: Fiche[];
  onModifierDonne: (index: number, d: Donne) => void;
}

export default function ArchiveFeuille({ record, roster, onModifierDonne }: ArchiveFeuilleProps) {
  const joueursId = record.joueursId || [];
  const joueurs = joueursId.length
    ? joueursId.map((id, i) => resoudreNom(id, roster || [], (record.joueursNomFige || [])[i]))
    : record.joueurs || []; // compat éventuelle d'anciens formats
  const nbTotal = joueurs.length;
  const donnes = record.donnes || [];
  const annulations = record.annulations || [];
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [cumule, setCumule] = useState(true);
  const [saisie, setSaisie] = useState<number | null>(null);
  const [mainsOuvert, setMainsOuvert] = useState<number | null>(null);

  const { totaux, jouees } = resumerDonnees(donnes, nbTotal);
  const classement = joueurs
    .map((nom, i) => ({ nom, i, pts: totaux[i], n: jouees[i] }))
    .sort((a, b) => b.pts - a.pts);

  return (
    <>
      <ScoreGrid
        joueurs={joueurs}
        nbTotal={nbTotal}
        donnes={donnes}
        cumule={cumule}
        onCumule={setCumule}
        ouverte={ouverte}
        onOuvrir={setOuverte}
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
            <button
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-100"
              onClick={() => setSaisie(ouverte)}
            >
              Modifier cette donne
            </button>
            {ouverte !== null && donnes[ouverte]?.cartesJouees?.length ? (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-100"
                onClick={() => setMainsOuvert(ouverte)}
              >
                Voir les mains
              </button>
            ) : null}
          </div>
          </>
        }
      />

      <StatsPartie donnes={donnes} joueurs={joueurs} nbTotal={nbTotal} />
      <GraphiqueComparatif donnes={donnes} joueurs={joueurs} nbTotal={nbTotal} />

      <Section title="Classement final">
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

      {annulations.length > 0 && (
        <Section title="Redistributions">
          {annulations.map((a) => (
            <div key={a.id} className="py-1 font-mono text-[11px] leading-relaxed text-slate-400">
              Avant la donne {a.avantDonne + 1} — Petit sec de {joueurs[a.joueur]}, redonne.
            </div>
          ))}
        </Section>
      )}

      {mainsOuvert !== null && donnes[mainsOuvert] && (
        <EcranMains
          joueurs={joueurs}
          donne={donnes[mainsOuvert]}
          numero={mainsOuvert + 1}
          onFermer={() => setMainsOuvert(null)}
        />
      )}

      {saisie !== null && (
        <Saisie
          joueurs={joueurs}
          parDonne={record.parDonne}
          tableProposee={donnes[saisie].table}
          total={nbTotal}
          numero={saisie + 1}
          donneInitiale={donnes[saisie]}
          onFermer={() => setSaisie(null)}
          onValider={(d) => {
            onModifierDonne(saisie, d);
            setSaisie(null);
          }}
        />
      )}
    </>
  );
}
