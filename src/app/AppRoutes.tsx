/**
 * Arbre des routes de l'application ; les écrans à graphiques sont chargés à la demande.
 * @module
 */

import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import Tables from "@/pages/Tables";

// Chargées à la demande : tout sauf l'accueil (`Tables`). Les écrans à graphiques
// importent Recharts, la plus grosse dépendance du bundle.
const Tirage = lazy(() => import("@/pages/Tirage"));
const Configuration = lazy(() => import("@/pages/Configuration"));
const CompositionTable = lazy(() => import("@/pages/CompositionTable"));
const Historique = lazy(() => import("@/pages/Historique"));
const Classement = lazy(() => import("@/pages/Classement"));
const Feuille = lazy(() => import("@/pages/Feuille"));
const FicheJoueur = lazy(() => import("@/pages/FicheJoueur"));
// Le suivi caméra embarque le moteur de reconnaissance (onnxruntime) : chargé seulement à l'ouverture de l'écran.
const Suivi = lazy(() => import("@/pages/Suivi"));

/**
 * Route `/tirage/:id` : écran du donneur de la table en composition ; redirige vers `/` si l'id ne correspond pas au tirage en cours.
 */
const RouteTirage = observer(function RouteTirage() {
  const store = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  const { tirage } = store;
  if (!tirage || tirage.id !== id) return <Navigate to="/" replace />;
  return (
    <Tirage
      joueurs={tirage.joueurs}
      joueursId={tirage.joueursId}
      badges={tirage.badges}
      parDonne={tirage.parDonne}
      onRetour={() => {
        store.annulerTirage();
        navigate("/");
      }}
      onValider={async (choix) => {
        const tableId = await store.validerTirage(choix);
        if (tableId) navigate(`/partie/${tableId}`);
      }}
    />
  );
});

/**
 * Route `/partie/:id` : charge la table demandée puis affiche sa feuille ; redirige vers `/` si elle est introuvable.
 */
const RoutePartie = observer(function RoutePartie() {
  const store = useStore();
  const { table } = store;
  const navigate = useNavigate();
  const { id } = useParams();
  useEffect(() => {
    if (!id) return;
    table.charger(id).then((trouvee) => {
      if (!trouvee) navigate("/"); // id inconnu (lien mort, table déjà fermée ailleurs)
      else void store.recalculerBadgesTable(); // tant que la table est ouverte, ses badges suivent l'historique
    });
  }, [id, table, store, navigate]);

  if (table.id !== id || !table.partie) return <div className="min-h-screen bg-slate-950" />;
  return <Feuille partie={table.partie} />;
});

/**
 * Route `/partie/:id/suivi` : suivi caméra de la donne en cours ; charge la table comme `/partie/:id`.
 */
const RouteSuivi = observer(function RouteSuivi() {
  const { table } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  useEffect(() => {
    if (!id) return;
    table.charger(id).then((trouvee) => {
      if (!trouvee) navigate("/");
    });
  }, [id, table, navigate]);

  if (table.id !== id || !table.partie) return <div className="min-h-screen bg-slate-950" />;
  return <Suivi />;
});

/**
 * Routes : `/` (tables ouvertes), `/composition`, `/tirage/:id`, `/partie/:id`, `/partie/:id/suivi`, `/joueurs`, `/joueurs/:id`, `/historique`, `/historique/:id`, `/classement`. Toute autre adresse redirige vers `/`.
 */
export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <Routes>
        <Route path="/joueurs" element={<Configuration />} />
        <Route path="/joueurs/:id" element={<FicheJoueur />} />
        <Route path="/classement" element={<Classement />} />
        <Route path="/historique" element={<Historique />} />
        <Route path="/historique/:id" element={<Historique />} />
        <Route path="/composition" element={<CompositionTable />} />
        <Route path="/tirage/:id" element={<RouteTirage />} />
        <Route path="/partie/:id" element={<RoutePartie />} />
        <Route path="/partie/:id/suivi" element={<RouteSuivi />} />
        <Route path="/" element={<Tables />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
