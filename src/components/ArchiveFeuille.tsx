import { useState } from "react";
import { resumerDonnees } from "../utils/regles";
import { resoudreNom } from "../utils/identite";
import type { Fiche } from "../utils/identite";
import type { ArchiveRecord } from "../types";
import { Section, RankRow } from "./ui";
import ScoreGrid from "./ScoreGrid";
import StatsPartie from "./StatsPartie";

interface ArchiveFeuilleProps {
  record: ArchiveRecord & { joueurs?: string[] };
  roster: Fiche[];
}

export default function ArchiveFeuille({ record, roster }: ArchiveFeuilleProps) {
  const joueursId = record.joueursId || [];
  const joueurs = joueursId.length
    ? joueursId.map((id, i) => resoudreNom(id, roster || [], (record.joueursNomFige || [])[i]))
    : record.joueurs || []; // compat éventuelle d'anciens formats
  const nbTotal = joueurs.length;
  const donnes = record.donnes || [];
  const annulations = record.annulations || [];
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [cumule, setCumule] = useState(true);

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
      />

      <StatsPartie donnes={donnes} joueurs={joueurs} nbTotal={nbTotal} />

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
    </>
  );
}
