/**
 * Filet de sécurité contre les erreurs d'affichage.
 * @module
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Cta } from "@/components/ui";

interface Props {
  /** Application à protéger. */
  children: ReactNode;
}

interface Etat {
  /** `true` après une exception de rendu. */
  erreur: boolean;
}

/**
 * Filet de sécurité : sans lui, une exception de rendu ou l'échec d'un
 * `import()` paresseux (typique : onglet resté ouvert pendant un nouveau
 * déploiement, dont les anciens chunks JS n'existent plus) démonte toute
 * l'app et laisse une page blanche. Les données sont déjà persistées au fil de
 * l'eau, recharger la page est donc sans risque.
 */
export default class ErrorBoundary extends Component<Props, Etat> {
  /** `true` après une exception de rendu : l'écran « Recharger » remplace alors l'application. */
  state: Etat = { erreur: false };

  /** Bascule en mode erreur dès qu'un descendant lève une exception. */
  static getDerivedStateFromError(): Etat {
    return { erreur: true };
  }

  /** Journalise l'exception et la pile des composants. */
  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error("Erreur d'affichage", erreur, info.componentStack);
  }

  /** Affiche les enfants, ou l'écran « Recharger » après une erreur. */
  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-xs text-center">
          <p className="mb-2 font-serif text-xl font-bold text-slate-100">Une erreur est survenue</p>
          <p className="mb-5 text-sm text-slate-400">
            L'application a besoin d'être rechargée (une nouvelle version est peut-être disponible).
          </p>
          <Cta onClick={() => window.location.reload()}>Recharger</Cta>
        </div>
      </div>
    );
  }
}
