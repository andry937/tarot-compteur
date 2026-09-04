import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { calculerClassementElo } from "../utils/elo";
import type { ClassementElo } from "../utils/elo";
import type { PartieAnalysee } from "../utils/stats";
import type { Fiche } from "../utils/identite";
import type { HistoriqueEntree, ArchiveRecord } from "../types";
import { cleArchive } from "../lib/stockage";
import { CSS } from "../styles/styles";

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
    <div className="tarot">
      <style>{CSS}</style>
      <div className="t-head">
        <div>
          <div className="t-eyebrow">Classement général</div>
          <h1 className="t-title">Elo</h1>
        </div>
        <div className="t-head-actions">
          <Link className="t-ghost" to="/">
            Accueil
          </Link>
        </div>
      </div>

      {chargement && (
        <div className="t-setup">
          <p className="t-intro">Calcul du classement…</p>
        </div>
      )}

      {!chargement && classement && classement.length === 0 && (
        <div className="t-empty">
          <p>Aucune partie archivée pour l'instant.</p>
          <span>Le classement apparaîtra ici dès qu'une feuille sera close</span>
        </div>
      )}

      {!chargement && classement && classement.length > 0 && (
        <div className="t-classement">
          {classement.map((c, r) => (
            <button
              key={c.id}
              className="t-cl-row"
              style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => navigate(`/joueurs/${c.id}`)}
            >
              <span className="t-cl-rang">{r + 1}</span>
              <span className="t-cl-nom">{c.nom}</span>
              <span className="t-cl-donnes">
                {c.matchs} donne{c.matchs > 1 ? "s" : ""}
              </span>
              <span className="t-cl-pts">{c.elo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
