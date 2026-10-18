import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import Tirage from "@/pages/Tirage";
import Configuration from "@/pages/Configuration";
import CompositionTable from "@/pages/CompositionTable";
import Classement from "@/pages/Classement";
import Tables from "@/pages/Tables";

// Chargées à la demande : ces trois écrans importent Recharts (via
// GraphiqueComparatif/GraphiquePersonnel), la plus grosse dépendance du
// bundle — inutile de l'imposer aux écrans qui n'affichent aucun graphique.
const Historique = lazy(() => import("@/pages/Historique"));
const Feuille = lazy(() => import("@/pages/Feuille"));
const FicheJoueur = lazy(() => import("@/pages/FicheJoueur"));

const RouteTirage = observer(function RouteTirage() {
  const store = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  const { tirage } = store;
  if (!tirage || tirage.id !== id) return <Navigate to="/" replace />;
  return (
    <Tirage
      joueurs={tirage.joueurs}
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

const RoutePartie = observer(function RoutePartie() {
  const { table } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  useEffect(() => {
    if (!id) return;
    table.charger(id).then((trouvee) => {
      if (!trouvee) navigate("/"); // id inconnu (lien mort, table déjà fermée ailleurs)
    });
  }, [id, table, navigate]);

  if (table.id !== id || !table.partie) return <div className="min-h-screen bg-slate-950" />;
  return <Feuille partie={table.partie} />;
});

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
        <Route path="/" element={<Tables />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
