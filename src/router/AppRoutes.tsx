import { Routes, Route, Navigate } from "react-router-dom";
import type { Fiche } from "../utils/identite";
import type { Donne } from "../utils/regles";
import type { Partie, TirageEnCours, HistoriqueEntree, Annulation } from "../types";
import Tirage from "../pages/Tirage";
import Historique from "../pages/Historique";
import Configuration from "../pages/Configuration";
import CompositionTable from "../pages/CompositionTable";
import Feuille from "../pages/Feuille";

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
  onEffacerDonne: (i: number) => void;
  onAjouterAnnulation: (a: Annulation) => void;
  onNouvellePartie: () => void;
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
  onEffacerDonne,
  onAjouterAnnulation,
  onNouvellePartie,
}: AppRoutesProps) {
  return (
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
        path="/historique"
        element={<Historique index={historiqueIndex} roster={roster} onRetour={onRetourHistorique} />}
      />
      <Route
        path="/historique/:id"
        element={<Historique index={historiqueIndex} roster={roster} onRetour={onRetourHistorique} />}
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
              onEffacerDonne={onEffacerDonne}
              onAjouterAnnulation={onAjouterAnnulation}
              onNouvellePartie={onNouvellePartie}
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
  );
}
