import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { resoudreNom, joueursActuellementAssis } from "../utils/identite";
import type { Fiche } from "../utils/identite";
import type { Donne } from "../utils/regles";
import type { Partie, TirageEnCours, HistoriqueEntree, Annulation } from "../types";
import Tirage from "../pages/Tirage";
import Configuration from "../pages/Configuration";
import CompositionTable from "../pages/CompositionTable";
import Classement from "../pages/Classement";
import Tables from "../pages/Tables";

// Chargées à la demande : ces trois écrans importent Recharts (via
// GraphiqueComparatif/GraphiquePersonnel), la plus grosse dépendance du
// bundle — inutile de l'imposer aux écrans qui n'affichent aucun graphique.
const Historique = lazy(() => import("../pages/Historique"));
const Feuille = lazy(() => import("../pages/Feuille"));
const FicheJoueur = lazy(() => import("../pages/FicheJoueur"));

export interface AppRoutesProps {
  tablesIndex: HistoriqueEntree[];
  tableActiveId: string | null;
  partie: Partie | null;
  tirage: TirageEnCours | null;
  donnes: Donne[];
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
  annulations: Annulation[];
  cartesEnCours: string[];
  onModifierCartes: (cartes: string[]) => void;
  chienEnCours: string[];
  onModifierChien: (chien: string[]) => void;
  joueurs: string[];
  nbTotal: number;
  totaux: number[];
  jouees: number[];
  cumuls: number[][];
  onFermerJoueurs: () => void;
  onRoster: (suivant: Fiche[]) => void;
  onRetourHistorique: () => void;
  onEntrerTable: (id: string) => void;
  onValiderComposition: (noms: string[], parDonne: number) => void;
  onValiderTirage: (depart: number) => void;
  onRetourTirage: () => void;
  onAjouterDonne: (d: Donne) => void;
  onModifierDonne: (i: number, d: Donne) => void;
  onEffacerDonne: (i: number) => void;
  onAjouterAnnulation: (a: Annulation) => void;
  onCloturerPartie: () => void;
  onQuitterPartie: () => void;
  onSupprimerPartie: (id: string) => void;
  onModifierDonneArchive: (id: string, totaux: number[]) => void;
}

function RouteTirage({
  tirage,
  onValider,
  onRetour,
}: {
  tirage: TirageEnCours | null;
  onValider: (depart: number) => void;
  onRetour: () => void;
}) {
  const { id } = useParams();
  if (!tirage || tirage.id !== id) return <Navigate to="/" replace />;
  return <Tirage joueurs={tirage.joueurs} onRetour={onRetour} onValider={onValider} />;
}

function RoutePartie({
  tableActiveId,
  onEntrer,
  partie,
  ...feuilleProps
}: {
  tableActiveId: string | null;
  onEntrer: (id: string) => void;
  partie: Partie | null;
  joueurs: string[];
  nbTotal: number;
  donnes: Donne[];
  annulations: Annulation[];
  cartesEnCours: string[];
  chienEnCours: string[];
  onModifierCartes: (cartes: string[]) => void;
  onModifierChien: (chien: string[]) => void;
  totaux: number[];
  jouees: number[];
  cumuls: number[][];
  onAjouterDonne: (d: Donne) => void;
  onModifierDonne: (i: number, d: Donne) => void;
  onEffacerDonne: (i: number) => void;
  onAjouterAnnulation: (a: Annulation) => void;
  onCloturerPartie: () => void;
  onQuitterPartie: () => void;
}) {
  const { id } = useParams();
  useEffect(() => {
    if (id) onEntrer(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tableActiveId !== id || !partie) return <div className="min-h-screen bg-slate-950" />;
  return (
    <Feuille
      joueurs={feuilleProps.joueurs}
      nbTotal={feuilleProps.nbTotal}
      parDonne={partie.parDonne}
      depart={partie.depart || 0}
      donnes={feuilleProps.donnes}
      annulations={feuilleProps.annulations}
      totaux={feuilleProps.totaux}
      jouees={feuilleProps.jouees}
      cumuls={feuilleProps.cumuls}
      cartesEnCours={feuilleProps.cartesEnCours}
      chienEnCours={feuilleProps.chienEnCours}
      onModifierCartes={feuilleProps.onModifierCartes}
      onModifierChien={feuilleProps.onModifierChien}
      onAjouterDonne={feuilleProps.onAjouterDonne}
      onModifierDonne={feuilleProps.onModifierDonne}
      onEffacerDonne={feuilleProps.onEffacerDonne}
      onAjouterAnnulation={feuilleProps.onAjouterAnnulation}
      onCloturerPartie={feuilleProps.onCloturerPartie}
      onQuitterPartie={feuilleProps.onQuitterPartie}
    />
  );
}

export default function AppRoutes({
  tablesIndex,
  tableActiveId,
  partie,
  tirage,
  donnes,
  roster,
  historiqueIndex,
  annulations,
  cartesEnCours,
  onModifierCartes,
  chienEnCours,
  onModifierChien,
  joueurs,
  nbTotal,
  totaux,
  jouees,
  cumuls,
  onFermerJoueurs,
  onRoster,
  onRetourHistorique,
  onEntrerTable,
  onValiderComposition,
  onValiderTirage,
  onRetourTirage,
  onAjouterDonne,
  onModifierDonne,
  onEffacerDonne,
  onAjouterAnnulation,
  onCloturerPartie,
  onQuitterPartie,
  onSupprimerPartie,
  onModifierDonneArchive,
}: AppRoutesProps) {
  const joueursIndisponibles = [...joueursActuellementAssis(tablesIndex)].map((id) =>
    resoudreNom(id, roster, "?")
  );

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
              onModifierDonneArchive={onModifierDonneArchive}
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
              onModifierDonneArchive={onModifierDonneArchive}
            />
          }
        />
        <Route
          path="/composition"
          element={
            <CompositionTable
              roster={roster}
              joueursIndisponibles={joueursIndisponibles}
              onValider={onValiderComposition}
            />
          }
        />
        <Route
          path="/tirage/:id"
          element={<RouteTirage tirage={tirage} onValider={onValiderTirage} onRetour={onRetourTirage} />}
        />
        <Route
          path="/partie/:id"
          element={
            <RoutePartie
              tableActiveId={tableActiveId}
              onEntrer={onEntrerTable}
              partie={partie}
              joueurs={joueurs}
              nbTotal={nbTotal}
              donnes={donnes}
              annulations={annulations}
              cartesEnCours={cartesEnCours}
              chienEnCours={chienEnCours}
              onModifierCartes={onModifierCartes}
              onModifierChien={onModifierChien}
              totaux={totaux}
              jouees={jouees}
              cumuls={cumuls}
              onAjouterDonne={onAjouterDonne}
              onModifierDonne={onModifierDonne}
              onEffacerDonne={onEffacerDonne}
              onAjouterAnnulation={onAjouterAnnulation}
              onCloturerPartie={onCloturerPartie}
              onQuitterPartie={onQuitterPartie}
            />
          }
        />
        <Route
          path="/"
          element={<Tables tablesIndex={tablesIndex} roster={roster} historiqueIndex={historiqueIndex} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
