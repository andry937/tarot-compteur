import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { calculerClassementElo } from "../utils/elo";
import type { ClassementElo } from "../utils/elo";
import type { PartieAnalysee } from "../utils/stats";
import type { Fiche } from "../utils/identite";
import type { HistoriqueEntree, ArchiveRecord } from "../types";
import { cleArchive } from "../lib/stockage";
import { Page, Header, GhostLink, Section, RankRow, Empty } from "../components/ui";

interface ClassementProps {
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
}

export default function Classement({ roster, historiqueIndex }: ClassementProps) {
  const navigate = useNavigate();
  const [classement, setClassement] = useState<ClassementElo[] | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    (async () => {
      const parties: PartieAnalysee[] = [];
      for (const h of historiqueIndex) {
        try {
          const r = await window.storage.get(cleArchive(h.id));
          const record: ArchiveRecord = JSON.parse(r.value);
          parties.push({
            archiveId: h.id,
            date: h.date,
            joueursId: record.joueursId,
            donnes: record.donnes,
          });
        } catch (e) {
          console.error("Lecture de l'archive impossible", e);
        }
      }
      setClassement(calculerClassementElo(parties, roster));
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historiqueIndex.length]);

  return (
    <Page>
      <Header eyebrow="Classement général" title="Elo" actions={<GhostLink to="/">Accueil</GhostLink>} />

      {chargement && <p className="text-sm text-slate-400">Calcul du classement…</p>}

      {!chargement && classement && classement.length === 0 && (
        <Empty title="Aucune partie archivée pour l'instant." hint="Le classement apparaîtra ici dès qu'une feuille sera close" />
      )}

      {!chargement && classement && classement.length > 0 && (
        <Section>
          {classement.map((c, r) => (
            <RankRow
              key={c.id}
              rang={r + 1}
              nom={c.nom}
              meta={`${c.matchs} donne${c.matchs > 1 ? "s" : ""}`}
              valeur={c.elo}
              onClick={() => navigate(`/joueurs/${c.id}`)}
            />
          ))}
        </Section>
      )}
    </Page>
  );
}
