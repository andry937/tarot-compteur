import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { resumerDonnees } from "./utils/regles";
import type { Donne } from "./utils/regles";
import { resoudreNom, resoudreOuCreerFiches, genId } from "./utils/identite";
import type { Fiche } from "./utils/identite";
import { CLE_PARTIE, CLE_ROSTER, CLE_HISTORIQUE, CLE_TABLES, cleArchive, cleTable } from "./lib/stockage";
import type { Partie, TirageEnCours, HistoriqueEntree, Annulation, ArchiveRecord } from "./types";
import AppRoutes from "./router/AppRoutes";

export default function App() {
  const navigate = useNavigate();
  const [pret, setPret] = useState(false);
  const [tablesIndex, setTablesIndex] = useState<HistoriqueEntree[]>([]);
  const [tableActiveId, setTableActiveId] = useState<string | null>(null);
  const [partie, setPartie] = useState<Partie | null>(null);
  const [tirage, setTirage] = useState<TirageEnCours | null>(null);
  const [donnes, setDonnes] = useState<Donne[]>([]);
  const [roster, setRoster] = useState<Fiche[]>([]);
  const [historiqueIndex, setHistoriqueIndex] = useState<HistoriqueEntree[]>([]);
  const [annulations, setAnnulations] = useState<Annulation[]>([]);

  useEffect(() => {
    /** Migration unique : l'ancien emplacement à une seule table active
     * devient une table ouverte parmi d'autres, puis est abandonné. */
    const migrerAncienneTable = async () => {
      try {
        const r = await window.storage.get(CLE_PARTIE);
        const p = JSON.parse(r.value);
        if (!p?.joueursId?.length) return;
        const id = genId();
        const joueursId: string[] = p.joueursId;
        const joueursNomFige: string[] = p.joueursNomFige || joueursId.map(() => "?");
        const record: ArchiveRecord = {
          joueursId,
          joueursNomFige,
          parDonne: p.parDonne || joueursId.length,
          depart: p.depart || 0,
          donnes: p.donnes || [],
          annulations: p.annulations || [],
        };
        await window.storage.set(cleTable(id), JSON.stringify(record));
        const { totaux } = resumerDonnees(record.donnes, joueursId.length);
        const resume: HistoriqueEntree = {
          id,
          date: new Date().toISOString(),
          joueurs: joueursNomFige,
          joueursId,
          parDonne: record.parDonne,
          nbDonnes: record.donnes.length,
          totaux,
        };
        let indexActuel: HistoriqueEntree[] = [];
        try {
          const rt = await window.storage.get(CLE_TABLES);
          indexActuel = JSON.parse(rt.value);
        } catch (e) {
          /* pas encore de tables ouvertes */
        }
        await window.storage.set(CLE_TABLES, JSON.stringify([resume, ...indexActuel]));
        await window.storage.delete(CLE_PARTIE);
      } catch (e) {
        /* rien à migrer */
      }
    };
    const chargerTablesOuvertes = async () => {
      try {
        const rt = await window.storage.get(CLE_TABLES);
        setTablesIndex(JSON.parse(rt.value));
      } catch (e) {
        /* aucune table ouverte, ou stockage indisponible */
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

    (async () => {
      await migrerAncienneTable();
      // En parallèle : un stockage lent ou mal configuré ne doit bloquer
      // l'affichage que d'un délai, pas de trois mis bout à bout.
      await Promise.all([chargerTablesOuvertes(), chargerRoster(), chargerHistorique()]);
      setPret(true);
    })();
  }, []);

  /** Charge à la demande la table `id` (route /partie/:id) si elle n'est pas déjà active dans cet onglet. */
  const chargerTable = async (id: string) => {
    if (tableActiveId === id) return;
    try {
      const r = await window.storage.get(cleTable(id));
      const rec: ArchiveRecord = JSON.parse(r.value);
      setPartie({
        joueursId: rec.joueursId,
        joueursNomFige: rec.joueursNomFige,
        parDonne: rec.parDonne,
        depart: rec.depart || 0,
      });
      setDonnes(rec.donnes || []);
      setAnnulations(rec.annulations || []);
      setTableActiveId(id);
    } catch (e) {
      navigate("/"); // id inconnu (lien mort, table déjà fermée ailleurs)
    }
  };

  useEffect(() => {
    if (!pret || !partie || !tableActiveId) return;
    (async () => {
      try {
        await window.storage.set(cleTable(tableActiveId), JSON.stringify({ ...partie, donnes, annulations }));
      } catch (e) {
        console.error("Sauvegarde impossible", e);
      }
    })();
  }, [partie, donnes, annulations, pret, tableActiveId]);

  const joueurs = partie
    ? partie.joueursId.map((id, i) => resoudreNom(id, roster, partie.joueursNomFige[i]))
    : [];
  const nbTotal = joueurs.length;

  const { totaux, jouees, cumuls } = useMemo(
    () => resumerDonnees(donnes, nbTotal),
    [donnes, nbTotal]
  );

  // Garde l'entrée de cette table dans l'index (nbDonnes/totaux affichés
  // dans la liste des tables ouvertes) synchronisée avec ses donnes.
  useEffect(() => {
    if (!pret || !tableActiveId) return;
    setTablesIndex((idx) =>
      idx.map((h) => (h.id === tableActiveId ? { ...h, nbDonnes: donnes.length, totaux, joueurs } : h))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnes.length, totaux, tableActiveId, pret]);

  useEffect(() => {
    if (!pret) return;
    window.storage
      .set(CLE_TABLES, JSON.stringify(tablesIndex))
      .catch((e) => console.error("Sauvegarde de l'index des tables impossible", e));
  }, [tablesIndex, pret]);

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

  /** Retour à l'accueil sans rien modifier : la table reste ouverte, reprenable plus tard. */
  const quitterPartie = () => {
    setPartie(null);
    setDonnes([]);
    setAnnulations([]);
    setTableActiveId(null);
    navigate("/");
  };

  /** Clôture la table active dans cet onglet : l'archive si des donnes ont été jouées, puis la retire des tables ouvertes. */
  const cloturerPartie = async () => {
    const id = tableActiveId;
    if (id && partie) {
      if (donnes.length > 0) {
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
          await window.storage.set(cleArchive(id), JSON.stringify({ ...partie, donnes, annulations }));
          const suivant = [resume, ...historiqueIndex];
          await window.storage.set(CLE_HISTORIQUE, JSON.stringify(suivant));
          setHistoriqueIndex(suivant);
        } catch (e) {
          console.error("Archivage impossible", e);
        }
      }
      try {
        await window.storage.delete(cleTable(id));
      } catch (e) {
        /* rien à supprimer */
      }
      setTablesIndex((idx) => idx.filter((h) => h.id !== id));
    }
    setPartie(null);
    setDonnes([]);
    setAnnulations([]);
    setTableActiveId(null);
    navigate("/");
  };

  const supprimerPartie = async (id: string) => {
    try {
      await window.storage.delete(cleArchive(id));
      const suivant = historiqueIndex.filter((h) => h.id !== id);
      await window.storage.set(CLE_HISTORIQUE, JSON.stringify(suivant));
      setHistoriqueIndex(suivant);
    } catch (e) {
      console.error("Suppression de l'archive impossible", e);
    }
    navigate("/historique");
  };

  /** Resynchronise le résumé en cache (totaux) après modification d'une donne archivée
   * — le reste (stats, Elo) se recalcule déjà à la volée depuis `donnes`. */
  const modifierDonneArchive = (id: string, totaux: number[]) => {
    setHistoriqueIndex((idx) => {
      const suivant = idx.map((h) => (h.id === id ? { ...h, totaux } : h));
      window.storage
        .set(CLE_HISTORIQUE, JSON.stringify(suivant))
        .catch((e) => console.error("Sauvegarde de l'historique impossible", e));
      return suivant;
    });
  };

  if (!pret) return <div className="min-h-screen bg-slate-950" />;

  return (
    <AppRoutes
      tablesIndex={tablesIndex}
      tableActiveId={tableActiveId}
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
      onEntrerTable={chargerTable}
      onValiderComposition={async (noms, parDonne) => {
        const ids = await majRoster(noms);
        const id = genId();
        setTirage({ id, joueurs: noms, joueursId: ids, parDonne });
        navigate(`/tirage/${id}`);
      }}
      onValiderTirage={async (depart) => {
        if (!tirage) return;
        const id = tirage.id;
        const nouvelle: Partie = {
          joueursId: tirage.joueursId,
          joueursNomFige: tirage.joueurs,
          parDonne: tirage.parDonne,
          depart,
        };
        setPartie(nouvelle);
        setDonnes([]);
        setAnnulations([]);
        setTableActiveId(id);
        setTirage(null);
        try {
          await window.storage.set(cleTable(id), JSON.stringify({ ...nouvelle, donnes: [], annulations: [] }));
          const resume: HistoriqueEntree = {
            id,
            date: new Date().toISOString(),
            joueurs: tirage.joueurs,
            joueursId: tirage.joueursId,
            parDonne: tirage.parDonne,
            nbDonnes: 0,
            totaux: new Array(tirage.joueurs.length).fill(0),
          };
          setTablesIndex((idx) => [resume, ...idx]);
        } catch (e) {
          console.error("Création de la table impossible", e);
        }
        navigate(`/partie/${id}`);
      }}
      onRetourTirage={() => {
        setTirage(null);
        navigate("/");
      }}
      onAjouterDonne={(d) => setDonnes((ds) => [...ds, d])}
      onModifierDonne={(i, d) => setDonnes((ds) => ds.map((old, k) => (k === i ? d : old)))}
      onEffacerDonne={(i) => setDonnes((ds) => ds.filter((_, k) => k !== i))}
      onAjouterAnnulation={(a) => setAnnulations((arr) => [...arr, a])}
      onCloturerPartie={cloturerPartie}
      onQuitterPartie={quitterPartie}
      onSupprimerPartie={supprimerPartie}
      onModifierDonneArchive={modifierDonneArchive}
    />
  );
}
