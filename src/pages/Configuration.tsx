import { useState } from "react";
import { resoudreNom, ontDejaJoueEnsemble } from "../utils/identite";
import type { Fiche } from "../utils/identite";
import type { HistoriqueEntree } from "../types";
import { CSS } from "../styles/styles";

interface ConfigurationProps {
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
  onFermer: () => void;
  onRoster: (suivant: Fiche[]) => void;
}

export default function Configuration({ roster, historiqueIndex, onFermer, onRoster }: ConfigurationProps) {
  const [renommage, setRenommage] = useState<string | null>(null);
  const [texteRenommage, setTexteRenommage] = useState("");
  const [fusionDepuis, setFusionDepuis] = useState<string | null>(null);
  const [erreurFusion, setErreurFusion] = useState<string | null>(null);
  const [voirDesactives, setVoirDesactives] = useState(false);

  const comptes: Record<string, number> = {};
  historiqueIndex.forEach((h) => {
    (h.joueursId || []).forEach((id) => {
      comptes[id] = (comptes[id] || 0) + 1;
    });
  });

  const parNom = (a: Fiche, b: Fiche) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
  const actifs = roster.filter((r) => r.actif).sort(parNom);
  const desactives = roster.filter((r) => !r.actif).sort(parNom);

  const renommer = (id: string, nomBrut: string) => {
    const nom = nomBrut.trim();
    if (!nom) return;
    onRoster(roster.map((r) => (r.id === id ? { ...r, nom } : r)));
    setRenommage(null);
  };

  const basculerActif = (id: string) => {
    onRoster(roster.map((r) => (r.id === id ? { ...r, actif: !r.actif } : r)));
  };

  const fusionner = (idSource: string, idCible: string) => {
    if (ontDejaJoueEnsemble(idSource, idCible, historiqueIndex)) {
      setErreurFusion("Ces deux joueurs ont déjà joué à la même table — fusion refusée.");
      return;
    }
    onRoster(
      roster.map((r) => (r.id === idSource ? { ...r, actif: false, redirigeVers: idCible } : r))
    );
    setFusionDepuis(null);
    setErreurFusion(null);
  };

  return (
    <div className="tarot">
      <style>{CSS}</style>
      <div className="t-head">
        <div>
          <div className="t-eyebrow">
            {actifs.length} joueur{actifs.length > 1 ? "s" : ""}
          </div>
          <h1 className="t-title">Joueurs</h1>
        </div>
        <button className="t-ghost" onClick={onFermer}>
          Retour
        </button>
      </div>

      <div className="t-setup">
        {actifs.length === 0 && (
          <p className="t-intro">
            Aucun joueur enregistré pour l'instant — les noms saisis lors d'une partie
            apparaîtront ici.
          </p>
        )}

        {actifs.map((f) => (
          <div key={f.id} className="t-roster-row">
            {renommage === f.id ? (
              <div className="t-roster-renommer">
                <input
                  className="t-input"
                  autoFocus
                  value={texteRenommage}
                  maxLength={12}
                  onChange={(e) => setTexteRenommage(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="t-lien"
                    style={{ margin: 0 }}
                    onClick={() => setRenommage(null)}
                  >
                    Annuler
                  </button>
                  <button
                    className="t-cta"
                    style={{ flex: 1, padding: "9px" }}
                    onClick={() => renommer(f.id, texteRenommage)}
                  >
                    Valider
                  </button>
                </div>
              </div>
            ) : fusionDepuis === f.id ? (
              <div className="t-roster-fusion">
                <span className="t-label">Fusionner {f.nom} dans…</span>
                <div className="t-chips">
                  {actifs
                    .filter((r) => r.id !== f.id)
                    .map((cible) => (
                      <button
                        key={cible.id}
                        className="t-chip"
                        onClick={() => fusionner(f.id, cible.id)}
                      >
                        {cible.nom}
                      </button>
                    ))}
                </div>
                {erreurFusion && <p className="t-erreur">{erreurFusion}</p>}
                <button
                  className="t-lien"
                  style={{ margin: "10px 0 0" }}
                  onClick={() => {
                    setFusionDepuis(null);
                    setErreurFusion(null);
                  }}
                >
                  Annuler
                </button>
              </div>
            ) : (
              <>
                <div className="t-roster-nom">
                  <span>{f.nom}</span>
                  <small>
                    {comptes[f.id] || 0} partie{(comptes[f.id] || 0) > 1 ? "s" : ""}
                  </small>
                </div>
                <div className="t-roster-actions">
                  <button
                    className="t-lien"
                    style={{ margin: 0 }}
                    onClick={() => {
                      setRenommage(f.id);
                      setTexteRenommage(f.nom);
                    }}
                  >
                    Renommer
                  </button>
                  <button
                    className="t-lien"
                    style={{ margin: 0 }}
                    onClick={() => setFusionDepuis(f.id)}
                  >
                    Fusionner
                  </button>
                  <button className="t-lien" style={{ margin: 0 }} onClick={() => basculerActif(f.id)}>
                    Désactiver
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {desactives.length > 0 && (
          <div className="t-field" style={{ marginTop: 22 }}>
            <button className="t-lien" style={{ margin: 0 }} onClick={() => setVoirDesactives((v) => !v)}>
              {voirDesactives ? "Masquer" : "Voir"} les joueurs désactivés ({desactives.length})
            </button>
            {voirDesactives &&
              desactives.map((f) => (
                <div key={f.id} className="t-roster-row">
                  <div className="t-roster-nom">
                    <span>{f.nom}</span>
                    <small>
                      {f.redirigeVers
                        ? `fusionnée dans ${resoudreNom(f.redirigeVers, roster, f.nom)}`
                        : `${comptes[f.id] || 0} partie${(comptes[f.id] || 0) > 1 ? "s" : ""}`}
                    </small>
                  </div>
                  {!f.redirigeVers && (
                    <div className="t-roster-actions">
                      <button
                        className="t-lien"
                        style={{ margin: 0 }}
                        onClick={() => basculerActif(f.id)}
                      >
                        Réactiver
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
