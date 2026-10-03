import { Component, type ErrorInfo, type ReactNode } from "react";
import { Cta } from "./ui";

/**
 * Filet de sécurité : sans lui, une exception de rendu ou l'échec d'un
 * `import()` paresseux (typique : onglet resté ouvert pendant un nouveau
 * déploiement, dont les anciens chunks JS n'existent plus) démonte toute
 * l'app et laisse une page blanche. Les données sont déjà persistées au fil de
 * l'eau, recharger la page est donc sans risque.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false };

  static getDerivedStateFromError() {
    return { erreur: true };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error("Erreur d'affichage", erreur, info.componentStack);
  }

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
