import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { resumerDonnees } from "./utils/regles";
import type { Donne } from "./utils/regles";
import { resoudreNom, resoudreOuCreerFiches } from "./utils/identite";
import type { Fiche } from "./utils/identite";
import { CLE_PARTIE, CLE_ROSTER, CLE_HISTORIQUE, cleArchive } from "./lib/stockage";
import type { Partie, TirageEnCours, HistoriqueEntree, Annulation } from "./types";
import { CSS } from "./styles/styles";
import AppRoutes from "./router/AppRoutes";

export default function App() {
  const navigate = useNavigate();
  const [pret, setPret] = useState(false);
  const [partie, setPartie] = useState<Partie | null>(null);
  const [tirage, setTirage] = useState<TirageEnCours | null>(null);
  const [donnes, setDonnes] = useState<Donne[]>([]);
  const [roster, setRoster] = useState<Fiche[]>([]);
  const [historiqueIndex, setHistoriqueIndex] = useState<HistoriqueEntree[]>([]);
  const [annulations, setAnnulations] = useState<Annulation[]>([]);

  useEffect(() => {
    const chargerPartie = async () => {
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
        /* première ouverture, rien d'enregistré, ou stockage indisponible */
      }
    };
    const chargerRoster = async () => {
      try {
        const rj = await window.storage.get(CLE_ROSTER);
        setRoster(JSON.parse(rj.value));
      } catch (e) {
        /* pas encore de trombinoscope, ou stockage indisponible */
      }
    };
    const chargerHistorique = async () => {
      try {
        const rh = await window.storage.get(CLE_HISTORIQUE);
        setHistoriqueIndex(JSON.parse(rh.value));
      } catch (e) {
        /* pas encore d'historique, ou stockage indisponible */
      }
    };

    // En parallèle : un stockage lent ou mal configuré ne doit bloquer
    // l'affichage que d'un délai, pas de trois mis bout à bout.
    Promise.all([chargerPartie(), chargerRoster(), chargerHistorique()]).finally(() => {
      setPret(true);
    });
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

  const persisterRoster = async (suivant: Fiche[]) => {
    setRoster(suivant);
    try {
      await window.storage.set(CLE_ROSTER, JSON.stringify(suivant));
    } catch (e) {
      console.error("Sauvegarde du trombinoscope impossible", e);
    }
  };

  /** Rapproche ou crée les fiches pour ces noms, persiste le registre, renvoie les identifiants. */
  const majRoster = async (noms: string[]): Promise<string[]> => {
    const { ids, roster: suivant } = resoudreOuCreerFiches(noms, roster);
    await persisterRoster(suivant);
    return ids;
  };

  const nouvellePartie = async () => {
    if (donnes.length > 0 && partie) {
      const id = `${Date.now()}`;
      const resume: HistoriqueEntree = {
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
    <AppRoutes
      partie={partie}
      tirage={tirage}
      donnes={donnes}
      roster={roster}
      historiqueIndex={historiqueIndex}
      annulations={annulations}
      joueurs={joueurs}
      nbTotal={nbTotal}
      totaux={totaux}
      jouees={jouees}
      cumuls={cumuls}
      onFermerJoueurs={() => navigate("/")}
      onRoster={persisterRoster}
      onRetourHistorique={() => navigate("/")}
      onValiderComposition={async (noms, parDonne) => {
        const ids = await majRoster(noms);
        setTirage({ joueurs: noms, joueursId: ids, parDonne });
        navigate("/tirage");
      }}
      onValiderTirage={(depart) => {
        if (!tirage) return;
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
      onRetourTirage={() => {
        setTirage(null);
        navigate("/");
      }}
      onAjouterDonne={(d) => setDonnes((ds) => [...ds, d])}
      onEffacerDonne={(i) => setDonnes((ds) => ds.filter((_, k) => k !== i))}
      onAjouterAnnulation={(a) => setAnnulations((arr) => [...arr, a])}
      onNouvellePartie={nouvellePartie}
    />
  );
}
