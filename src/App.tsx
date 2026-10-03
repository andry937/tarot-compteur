import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { resumerDonnees } from "./utils/regles";
import type { Donne } from "./utils/regles";
import { resoudreNom, resoudreOuCreerFiches, genId } from "./utils/identite";
import type { Fiche } from "./utils/identite";
import { invaliderArchive } from "./lib/archives";
import { CLE_PARTIE, CLE_ROSTER, CLE_HISTORIQUE, CLE_TABLES, cleArchive, cleTable, lireJson } from "./lib/stockage";
import type { Partie, TirageEnCours, HistoriqueEntree, Annulation, ArchiveRecord } from "./types";
import AppRoutes from "./router/AppRoutes";
import { Cta } from "./components/ui";

export default function App() {
  const navigate = useNavigate();
  const [pret, setPret] = useState(false);
  // Une lecture a échoué au démarrage (≠ clé absente) : on n'écrit RIEN tant que
  // les données n'ont pas été relues, sinon l'état vide écraserait les vraies.
  const [erreurChargement, setErreurChargement] = useState(false);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [tablesIndex, setTablesIndex] = useState<HistoriqueEntree[]>([]);
  const [tableActiveId, setTableActiveId] = useState<string | null>(null);
  const [partie, setPartie] = useState<Partie | null>(null);
  const [tirage, setTirage] = useState<TirageEnCours | null>(null);
  const [donnes, setDonnes] = useState<Donne[]>([]);
  const [roster, setRoster] = useState<Fiche[]>([]);
  const [historiqueIndex, setHistoriqueIndex] = useState<HistoriqueEntree[]>([]);
  const [annulations, setAnnulations] = useState<Annulation[]>([]);
  const [cartesEnCours, setCartesEnCours] = useState<string[]>([]);
  const [chienEnCours, setChienEnCours] = useState<string[]>([]);

  useEffect(() => {
    /** Migration unique : l'ancien emplacement à une seule table active
     * devient une table ouverte parmi d'autres, puis est abandonné. */
    const migrerAncienneTable = async () => {
      const p = await lireJson<Partial<ArchiveRecord>>(CLE_PARTIE); // absent : rien à migrer
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
      const indexActuel = (await lireJson<HistoriqueEntree[]>(CLE_TABLES)) ?? [];
      await window.storage.set(CLE_TABLES, JSON.stringify([resume, ...indexActuel]));
      await window.storage.delete(CLE_PARTIE);
    };

    (async () => {
      try {
        await migrerAncienneTable();
        // En parallèle : un stockage lent ou mal configuré ne doit bloquer
        // l'affichage que d'un délai, pas de trois mis bout à bout.
        const [tables, ros, hist] = await Promise.all([
          lireJson<HistoriqueEntree[]>(CLE_TABLES),
          lireJson<Fiche[]>(CLE_ROSTER),
          lireJson<HistoriqueEntree[]>(CLE_HISTORIQUE),
        ]);
        // null = clé absente (premier lancement) : on garde l'état vide d'origine.
        if (tables) setTablesIndex(tables);
        if (ros) setRoster(ros);
        if (hist) setHistoriqueIndex(hist);
        setPret(true);
      } catch (e) {
        console.error("Lecture du stockage impossible", e);
        setErreurChargement(true);
      }
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
      setCartesEnCours(rec.cartesEnCours || []);
      setChienEnCours(rec.chienEnCours || []);
      setTableActiveId(id);
    } catch (e) {
      navigate("/"); // id inconnu (lien mort, table déjà fermée ailleurs)
    }
  };

  useEffect(() => {
    if (!pret || !partie || !tableActiveId) return;
    (async () => {
      try {
        await window.storage.set(cleTable(tableActiveId), JSON.stringify({ ...partie, donnes, annulations, cartesEnCours, chienEnCours }));
      } catch (e) {
        console.error("Sauvegarde impossible", e);
      }
    })();
  }, [partie, donnes, annulations, cartesEnCours, chienEnCours, pret, tableActiveId]);

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
    setCartesEnCours([]);
    setChienEnCours([]);
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
          invaliderArchive(id);
          await window.storage.set(cleArchive(id), JSON.stringify({ ...partie, donnes, annulations }));
          const suivant = [resume, ...historiqueIndex];
          await window.storage.set(CLE_HISTORIQUE, JSON.stringify(suivant));
          setHistoriqueIndex(suivant);
        } catch (e) {
          // Surtout ne pas supprimer la table : l'archive n'existe peut-être pas,
          // et ce serait la seule copie des donnes. Elle reste ouverte, on réessaie.
          console.error("Archivage impossible", e);
          setAvertissement("Archivage impossible : la table reste ouverte, réessayez la clôture une fois la connexion rétablie.");
          return;
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
    setCartesEnCours([]);
    setChienEnCours([]);
    setTableActiveId(null);
    navigate("/");
  };

  const supprimerPartie = async (id: string) => {
    try {
      invaliderArchive(id);
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

  if (erreurChargement)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-xs text-center">
          <p className="mb-2 font-serif text-xl font-bold text-slate-100">Données inaccessibles</p>
          <p className="mb-5 text-sm text-slate-400">
            Impossible de lire le stockage (connexion coupée ou trop lente). Rien n'a été modifié.
          </p>
          <Cta onClick={() => window.location.reload()}>Réessayer</Cta>
        </div>
      </div>
    );

  if (!pret) return <div className="min-h-screen bg-slate-950" />;

  return (
    <>
      {avertissement && (
        <div role="alert" className="fixed inset-x-0 top-0 z-50 flex items-start gap-3 bg-rose-900 px-4 py-3 text-sm text-rose-50">
          <span className="flex-1">{avertissement}</span>
          <button type="button" aria-label="Fermer l'avertissement" onClick={() => setAvertissement(null)}>
            ✕
          </button>
        </div>
      )}
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
        setCartesEnCours([]);
        setChienEnCours([]);
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
      cartesEnCours={cartesEnCours}
      onModifierCartes={setCartesEnCours}
      chienEnCours={chienEnCours}
      onModifierChien={setChienEnCours}
      onAjouterDonne={(d) => {
        // Les cartes notées pendant la main sont rattachées à la donne inscrite.
        setDonnes((ds) => [
          ...ds,
          {
            ...d,
            ...(cartesEnCours.length ? { cartesJouees: cartesEnCours } : {}),
            ...(chienEnCours.length ? { chien: chienEnCours } : {}),
          },
        ]);
        setCartesEnCours([]);
        setChienEnCours([]);
      }}
      onModifierDonne={(i, d) => setDonnes((ds) => ds.map((old, k) => (k === i ? d : old)))}
      onEffacerDonne={(i) => setDonnes((ds) => ds.filter((_, k) => k !== i))}
      onAjouterAnnulation={(a) => {
        setAnnulations((arr) => [...arr, a]);
        setCartesEnCours([]);
        setChienEnCours([]); // la donne est rejouée : le brouillon n'a plus de sens
      }}
      onCloturerPartie={cloturerPartie}
      onQuitterPartie={quitterPartie}
      onSupprimerPartie={supprimerPartie}
      onModifierDonneArchive={modifierDonneArchive}
    />
    </>
  );
}
