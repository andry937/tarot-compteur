import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import type { Fiche } from "../utils/identite";
import type { Donne } from "../utils/regles";
import type { Partie, TirageEnCours, HistoriqueEntree, Annulation } from "../types";
import Tirage from "../pages/Tirage";
import Configuration from "../pages/Configuration";
import CompositionTable from "../pages/CompositionTable";
import Classement from "../pages/Classement";

// Chargées à la demande : ces trois écrans importent Recharts (via
// GraphiqueComparatif/GraphiquePersonnel), la plus grosse dépendance du
// bundle — inutile de l'imposer aux écrans qui n'affichent aucun graphique.
const Historique = lazy(() => import("../pages/Historique"));
const Feuille = lazy(() => import("../pages/Feuille"));
const FicheJoueur = lazy(() => import("../pages/FicheJoueur"));

export interface AppRoutesProps {
  partie: Partie | null;
  tirage: TirageEnCours | null;
  donnes: Donne[];
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
  annulations: Annulation[];
  joueurs: string[];
  nbTotal: number;
  totaux: number[];
  jouees: number[];
  cumuls: number[][];
  onFermerJoueurs: () => void;
  onRoster: (suivant: Fiche[]) => void;
  onRetourHistorique: () => void;
  onValiderComposition: (noms: string[], parDonne: number) => void;
  onValiderTirage: (depart: number) => void;
  onRetourTirage: () => void;
  onAjouterDonne: (d: Donne) => void;
  onModifierDonne: (i: number, d: Donne) => void;
  onEffacerDonne: (i: number) => void;
  onAjouterAnnulation: (a: Annulation) => void;
  onNouvellePartie: () => void;
  onQuitterPartie: () => void;
  onSupprimerPartie: (id: string) => void;
}

export default function AppRoutes({
  partie,
  tirage,
  donnes,
  roster,
  historiqueIndex,
  annulations,
  joueurs,
  nbTotal,
  totaux,
  jouees,
  cumuls,
  onFermerJoueurs,
  onRoster,
  onRetourHistorique,
  onValiderComposition,
  onValiderTirage,
  onRetourTirage,
  onAjouterDonne,
  onModifierDonne,
  onEffacerDonne,
  onAjouterAnnulation,
  onNouvellePartie,
  onQuitterPartie,
  onSupprimerPartie,
}: AppRoutesProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <Routes>
        <Route
          path="/joueurs"
          element={
            <Configuration
              roster={roster}
              historiqueIndex={historiqueIndex}
              onFermer={onFermerJoueurs}
              onRoster={onRoster}
            />
          }
        />
        <Route
          path="/joueurs/:id"
          element={<FicheJoueur roster={roster} historiqueIndex={historiqueIndex} />}
        />
        <Route
          path="/classement"
          element={<Classement roster={roster} historiqueIndex={historiqueIndex} />}
        />
        <Route
          path="/historique"
          element={
            <Historique
              index={historiqueIndex}
              roster={roster}
              onRetour={onRetourHistorique}
              onSupprimer={onSupprimerPartie}
            />
          }
        />
        <Route
          path="/historique/:id"
          element={
            <Historique
              index={historiqueIndex}
              roster={roster}
              onRetour={onRetourHistorique}
              onSupprimer={onSupprimerPartie}
            />
          }
        />
        <Route
          path="/tirage"
          element={
            tirage && !partie ? (
              <Tirage joueurs={tirage.joueurs} onRetour={onRetourTirage} onValider={onValiderTirage} />
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
                onAjouterDonne={onAjouterDonne}
                onModifierDonne={onModifierDonne}
                onEffacerDonne={onEffacerDonne}
                onAjouterAnnulation={onAjouterAnnulation}
                onNouvellePartie={onNouvellePartie}
                onQuitterPartie={onQuitterPartie}
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
              <CompositionTable roster={roster} historiqueIndex={historiqueIndex} onValider={onValiderComposition} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
