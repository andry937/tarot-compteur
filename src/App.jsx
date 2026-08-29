import { useState, useEffect, useMemo } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { resumerDonnees } from "./regles.js";
import { resoudreNom, resoudreOuCreerFiches } from "./identite.js";
import { CLE_PARTIE, CLE_ROSTER, CLE_HISTORIQUE, cleArchive } from "./stockage.js";
import { CSS } from "./styles.js";
import Tirage from "./composants/Tirage.jsx";
import Historique from "./composants/Historique.jsx";
import Configuration from "./composants/Configuration.jsx";
import CompositionTable from "./composants/CompositionTable.jsx";
import Feuille from "./composants/Feuille.jsx";

export default function App() {
  const navigate = useNavigate();
  const [pret, setPret] = useState(false);
  const [partie, setPartie] = useState(null);
  const [tirage, setTirage] = useState(null);
  const [donnes, setDonnes] = useState([]);
  const [roster, setRoster] = useState([]);
  const [historiqueIndex, setHistoriqueIndex] = useState([]);
  const [annulations, setAnnulations] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(CLE_PARTIE);
        const p = JSON.parse(r.value);
        if (p?.joueursId?.length) {
          setPartie({
            joueursId: p.joueursId,
            joueursNomFige: p.joueursNomFige || p.joueursId.map(() => "?"),
            parDonne: p.parDonne || p.joueursId.length,
            depart: p.depart || 0,
          });
          setDonnes(p.donnes || []);
          setAnnulations(p.annulations || []);
        }
      } catch (e) {
        /* première ouverture : rien d'enregistré */
      }
      try {
        const rj = await window.storage.get(CLE_ROSTER);
        setRoster(JSON.parse(rj.value));
      } catch (e) {
        /* pas encore de trombinoscope */
      }
      try {
        const rh = await window.storage.get(CLE_HISTORIQUE);
        setHistoriqueIndex(JSON.parse(rh.value));
      } catch (e) {
        /* pas encore d'historique */
      }
      setPret(true);
    })();
  }, []);

  useEffect(() => {
    if (!pret || !partie) return;
    (async () => {
      try {
        await window.storage.set(CLE_PARTIE, JSON.stringify({ ...partie, donnes, annulations }));
      } catch (e) {
        console.error("Sauvegarde impossible", e);
      }
    })();
  }, [partie, donnes, annulations, pret]);

  const joueurs = partie
    ? partie.joueursId.map((id, i) => resoudreNom(id, roster, partie.joueursNomFige[i]))
    : [];
  const nbTotal = joueurs.length;

  const { totaux, jouees, cumuls } = useMemo(
    () => resumerDonnees(donnes, nbTotal),
    [donnes, nbTotal]
  );

  const persisterRoster = async (suivant) => {
    setRoster(suivant);
    try {
      await window.storage.set(CLE_ROSTER, JSON.stringify(suivant));
    } catch (e) {
      console.error("Sauvegarde du trombinoscope impossible", e);
    }
  };

  /** Rapproche ou crée les fiches pour ces noms, persiste le registre, renvoie les identifiants. */
  const majRoster = async (noms) => {
    const { ids, roster: suivant } = resoudreOuCreerFiches(noms, roster);
    await persisterRoster(suivant);
    return ids;
  };

  const nouvellePartie = async () => {
    if (donnes.length > 0) {
      const id = `${Date.now()}`;
      const resume = {
        id,
        date: new Date().toISOString(),
        joueurs,
        joueursId: partie.joueursId,
        parDonne: partie.parDonne,
        nbDonnes: donnes.length,
        totaux,
      };
      try {
        await window.storage.set(
          cleArchive(id),
          JSON.stringify({ ...partie, donnes, annulations })
        );
        const suivant = [resume, ...historiqueIndex];
        await window.storage.set(CLE_HISTORIQUE, JSON.stringify(suivant));
        setHistoriqueIndex(suivant);
      } catch (e) {
        console.error("Archivage impossible", e);
      }
    }
    try {
      await window.storage.delete(CLE_PARTIE);
    } catch (e) {
      /* rien à supprimer */
    }
    setPartie(null);
    setDonnes([]);
    setAnnulations([]);
    navigate("/");
  };

  if (!pret)
    return (
      <div className="tarot">
        <style>{CSS}</style>
      </div>
    );

  return (
    <Routes>
      <Route
        path="/joueurs"
        element={
          <Configuration
            roster={roster}
            historiqueIndex={historiqueIndex}
            onFermer={() => navigate("/")}
            onRoster={persisterRoster}
          />
        }
      />
      <Route
        path="/historique"
        element={<Historique index={historiqueIndex} roster={roster} onRetour={() => navigate("/")} />}
      />
      <Route
        path="/historique/:id"
        element={<Historique index={historiqueIndex} roster={roster} onRetour={() => navigate("/")} />}
      />
      <Route
        path="/tirage"
        element={
          tirage && !partie ? (
            <Tirage
              joueurs={tirage.joueurs}
              onRetour={() => {
                setTirage(null);
                navigate("/");
              }}
              onValider={(depart) => {
                setPartie({
                  joueursId: tirage.joueursId,
                  joueursNomFige: tirage.joueurs,
                  parDonne: tirage.parDonne,
                  depart,
                });
                setDonnes([]);
                setAnnulations([]);
                setTirage(null);
                navigate("/partie");
              }}
            />
          ) : (
            <Navigate to={partie ? "/partie" : "/"} replace />
          )
        }
      />
      <Route
        path="/partie"
        element={
          partie ? (
            <Feuille
              joueurs={joueurs}
              nbTotal={nbTotal}
              parDonne={partie.parDonne}
              depart={partie.depart || 0}
              donnes={donnes}
              annulations={annulations}
              totaux={totaux}
              jouees={jouees}
              cumuls={cumuls}
              onAjouterDonne={(d) => setDonnes((ds) => [...ds, d])}
              onEffacerDonne={(i) => setDonnes((ds) => ds.filter((_, k) => k !== i))}
              onAjouterAnnulation={(a) => setAnnulations((arr) => [...arr, a])}
              onNouvellePartie={nouvellePartie}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/"
        element={
          partie ? (
            <Navigate to="/partie" replace />
          ) : (
            <CompositionTable
              roster={roster}
              historiqueIndex={historiqueIndex}
              onValider={async (noms, parDonne) => {
                const ids = await majRoster(noms);
                setTirage({ joueurs: noms, joueursId: ids, parDonne });
                navigate("/tirage");
              }}
            />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
