import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { resoudreFiche } from "../utils/identite";
import type { Fiche } from "../utils/identite";
import { calculerStatsJoueur } from "../utils/stats";
import type { PartieAnalysee, Role, StatsJoueur } from "../utils/stats";
import type { HistoriqueEntree, ArchiveRecord } from "../types";
import { cleArchive } from "../lib/stockage";
import { fmt } from "../utils/regles";
import { CSS } from "../styles/styles";

interface FicheJoueurProps {
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
}

const LABEL_ROLE: Record<Role, string> = {
  preneur: "Preneur",
  appele: "Appelé",
  defense: "Défense",
  repos: "Repos",
};

const NOM_ROI: Record<string, string> = {
  coeur: "Cœur",
  carreau: "Carreau",
  trefle: "Trèfle",
  pique: "Pique",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function FicheJoueur({ roster, historiqueIndex }: FicheJoueurProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsJoueur | null>(null);
  const [chargement, setChargement] = useState(true);

  const ficheFinale = id ? resoudreFiche(id, roster) : null;

  // Cluster de tous les identifiants (actifs ou fusionnés) qui résolvent
  // vers la même fiche — une fusion ne réécrit jamais les archives, donc
  // sans ça les donnes jouées sous l'ancienne identité disparaîtraient.
  const cluster = ficheFinale
    ? roster.filter((f) => resoudreFiche(f.id, roster)?.id === ficheFinale.id).map((f) => f.id)
    : [];

  useEffect(() => {
    if (!ficheFinale) {
      setChargement(false);
      return;
    }
    const partiesConcernees = historiqueIndex.filter((h) =>
      (h.joueursId || []).some((pid) => cluster.includes(pid))
    );
    setChargement(true);
    (async () => {
      const parties: PartieAnalysee[] = [];
      for (const h of partiesConcernees) {
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
      const idPresent = cluster.find((pid) =>
        parties.some((p) => p.joueursId.includes(pid))
      );
      setStats(calculerStatsJoueur(idPresent ?? ficheFinale.id, parties));
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, historiqueIndex.length]);

  if (!id || !ficheFinale) {
    return (
      <div className="tarot">
        <style>{CSS}</style>
        <div className="t-head">
          <div>
            <h1 className="t-title">Joueur introuvable</h1>
          </div>
          <div className="t-head-actions">
            <Link className="t-ghost" to="/">
              Accueil
            </Link>
            <Link className="t-ghost" to="/joueurs">
              Retour
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tarot">
      <style>{CSS}</style>
      <div className="t-head">
        <div>
          <div className="t-eyebrow">
            {stats ? `${stats.partiesJouees} partie${stats.partiesJouees > 1 ? "s" : ""} · ${stats.donneesJouees} donne${stats.donneesJouees > 1 ? "s" : ""}` : "Statistiques"}
          </div>
          <h1 className="t-title">{ficheFinale.nom}</h1>
        </div>
        <div className="t-head-actions">
          <Link className="t-ghost" to="/">
            Accueil
          </Link>
          <Link className="t-ghost" to="/joueurs">
            Retour
          </Link>
        </div>
      </div>

      {chargement && (
        <div className="t-setup">
          <p className="t-intro">Chargement des statistiques…</p>
        </div>
      )}

      {!chargement && stats && stats.partiesJouees === 0 && (
        <div className="t-empty">
          <p>Aucune donne jouée pour l'instant.</p>
          <span>Les stats apparaîtront ici dès que ce joueur aura joué une partie</span>
        </div>
      )}

      {!chargement && stats && stats.partiesJouees > 0 && (
        <>
          <div className="t-classement">
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>
              Points totaux
            </div>
            <div className="t-cl-row">
              <span className="t-cl-nom">Cumul sur {stats.donneesJouees} donnes</span>
              <span className="t-cl-pts" data-neg={stats.pointsTotaux < 0 ? 1 : 0}>
                {fmt(stats.pointsTotaux)}
              </span>
            </div>
          </div>

          <div className="t-classement">
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>
              Par rôle
            </div>
            {(["preneur", "appele", "defense"] as Role[]).map((role) => {
              const r = stats.parRole[role];
              const taux = r.donnes > 0 ? Math.round((r.victoires / r.donnes) * 100) : null;
              return (
                <div className="t-cl-row" key={role}>
                  <span className="t-cl-nom">{LABEL_ROLE[role]}</span>
                  <span className="t-cl-donnes">{r.donnes} donnes</span>
                  <span className="t-cl-pts">{taux !== null ? `${taux}% de victoires` : "—"}</span>
                </div>
              );
            })}
            <div className="t-cl-row">
              <span className="t-cl-nom">Nombre de fois appelé</span>
              <span className="t-cl-pts">{stats.foisAppele}</span>
            </div>
          </div>

          {stats.contratsPreneur.length > 0 && (
            <div className="t-classement">
              <div className="t-eyebrow" style={{ marginBottom: 6 }}>
                Contrats de prédilection (en tant que preneur)
              </div>
              {stats.contratsPreneur.map((c) => (
                <div className="t-cl-row" key={c.contrat}>
                  <span className="t-cl-nom">{c.contrat}</span>
                  <span className="t-cl-pts">{c.fois}</span>
                </div>
              ))}
            </div>
          )}

          {stats.roisAppelesParLui.length > 0 && (
            <div className="t-classement">
              <div className="t-eyebrow" style={{ marginBottom: 6 }}>
                Rois appelés (en tant que preneur)
              </div>
              {stats.roisAppelesParLui.map((r) => (
                <div className="t-cl-row" key={r.roi}>
                  <span className="t-cl-nom">{NOM_ROI[r.roi]}</span>
                  <span className="t-cl-pts">{r.fois}</span>
                </div>
              ))}
            </div>
          )}

          {(stats.meilleureDonne || stats.pireDonne) && (
            <div className="t-classement">
              <div className="t-eyebrow" style={{ marginBottom: 6 }}>
                Meilleure / pire donne
              </div>
              {stats.meilleureDonne && (
                <button
                  className="t-archive-row"
                  onClick={() => navigate(`/historique/${stats.meilleureDonne!.archiveId}`)}
                >
                  <span className="t-archive-joueurs">Meilleure — {fmtDate(stats.meilleureDonne.date)}</span>
                  <span className="t-cl-pts">{fmt(stats.meilleureDonne.points)}</span>
                </button>
              )}
              {stats.pireDonne && (
                <button
                  className="t-archive-row"
                  onClick={() => navigate(`/historique/${stats.pireDonne!.archiveId}`)}
                >
                  <span className="t-archive-joueurs">Pire — {fmtDate(stats.pireDonne.date)}</span>
                  <span className="t-cl-pts" data-neg={stats.pireDonne.points < 0 ? 1 : 0}>
                    {fmt(stats.pireDonne.points)}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="t-classement">
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>
              Parties jouées
            </div>
            {stats.parties.map((p) => (
              <button
                key={p.archiveId}
                className="t-archive-row"
                onClick={() => navigate(`/historique/${p.archiveId}`)}
              >
                <div>
                  <span className="t-archive-date">{fmtDate(p.date)}</span>
                  <span className="t-archive-joueurs">{p.nbDonnes} donnes jouées</span>
                </div>
                <div className="t-archive-droite">
                  <span className="t-cl-pts" data-neg={p.points < 0 ? 1 : 0}>
                    {fmt(p.points)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
