import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { cleArchive } from "../lib/stockage";
import type { Fiche } from "../utils/identite";
import type { HistoriqueEntree, ArchiveRecord } from "../types";
import { CSS } from "../styles/styles";
import ArchiveFeuille from "../components/ArchiveFeuille";

interface HistoriqueProps {
  index: HistoriqueEntree[];
  roster: Fiche[];
  onRetour: () => void;
  onSupprimer: (id: string) => void;
}

export default function Historique({ index, roster, onRetour, onSupprimer }: HistoriqueProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ArchiveRecord | null>(null);
  const [chargement, setChargement] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const surSupprimer = () => {
    if (!id) return;
    if (!confirmerSuppression) {
      setConfirmerSuppression(true);
      setTimeout(() => setConfirmerSuppression(false), 4000);
      return;
    }
    setConfirmerSuppression(false);
    onSupprimer(id);
  };

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

  const fmtDate = (iso: string) =>
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
          <div className="t-head-actions">
            <Link className="t-ghost" to="/">
              Accueil
            </Link>
            <button className="t-ghost" onClick={() => navigate("/historique")}>
              Retour
            </button>
            <button className="t-ghost" onClick={surSupprimer}>
              {confirmerSuppression ? "Confirmer ?" : "Supprimer"}
            </button>
          </div>
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
            <button key={p.id} className="t-archive-row" onClick={() => navigate(`/historique/${p.id}`)}>
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
