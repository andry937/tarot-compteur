import { useState, useEffect } from "react";
import { cleArchive } from "../stockage.js";
import { CSS } from "../styles.js";
import ArchiveFeuille from "./ArchiveFeuille.jsx";

export default function Historique({ index, roster, onRetour }) {
  const [id, setId] = useState(null);
  const [record, setRecord] = useState(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (!id) {
      setRecord(null);
      return;
    }
    setChargement(true);
    (async () => {
      try {
        const r = await window.storage.get(cleArchive(id));
        setRecord(JSON.parse(r.value));
      } catch (e) {
        console.error("Lecture de l'archive impossible", e);
      }
      setChargement(false);
    })();
  }, [id]);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  if (id) {
    const resume = index.find((r) => r.id === id);
    return (
      <div className="tarot">
        <style>{CSS}</style>
        <div className="t-head">
          <div>
            <div className="t-eyebrow">{resume ? fmtDate(resume.date) : "Archive"}</div>
            <h1 className="t-title">Partie close</h1>
          </div>
          <button className="t-ghost" onClick={() => setId(null)}>
            Retour
          </button>
        </div>
        {chargement && (
          <div className="t-setup">
            <p className="t-intro">Chargement de la feuille…</p>
          </div>
        )}
        {record && <ArchiveFeuille record={record} roster={roster} />}
      </div>
    );
  }

  return (
    <div className="tarot">
      <style>{CSS}</style>
      <div className="t-head">
        <div>
          <div className="t-eyebrow">
            {index.length} partie{index.length > 1 ? "s" : ""} archivée
            {index.length > 1 ? "s" : ""}
          </div>
          <h1 className="t-title">Historique</h1>
        </div>
        <button className="t-ghost" onClick={onRetour}>
          Retour
        </button>
      </div>

      <div className="t-classement">
        {index.map((p) => {
          const meneur = (p.joueurs || [])
            .map((nom, i) => ({ nom, pts: p.totaux ? p.totaux[i] : 0 }))
            .sort((a, b) => b.pts - a.pts)[0];
          return (
            <button key={p.id} className="t-archive-row" onClick={() => setId(p.id)}>
              <div>
                <span className="t-archive-date">{fmtDate(p.date)}</span>
                <span className="t-archive-joueurs">{(p.joueurs || []).join(", ")}</span>
              </div>
              <div className="t-archive-droite">
                <span className="t-archive-donnes">{p.nbDonnes} donnes</span>
                {meneur && (
                  <span className="t-archive-meneur">
                    {meneur.nom} {meneur.pts > 0 ? "+" : ""}
                    {meneur.pts}
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {index.length === 0 && (
          <div className="t-empty">
            <p>Aucune partie archivée.</p>
            <span>Elle apparaîtra ici dès qu'une feuille sera close</span>
          </div>
        )}
      </div>
    </div>
  );
}

