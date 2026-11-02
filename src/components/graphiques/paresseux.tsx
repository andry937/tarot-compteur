/**
 * Graphiques chargés à la demande : Recharts (~360 kB, ~107 kB gzip) n'est téléchargé
 * qu'au moment d'afficher un graphique, sans retarder l'écran qui le contient.
 * Les graphiques sont toujours en bas d'écran : rien n'est réservé pendant le
 * chargement (`fallback={null}`), le reste de la page s'affiche aussitôt.
 * @module
 */

import { lazy, Suspense, type ComponentProps } from "react";

const Comparatif = lazy(() => import("./GraphiqueComparatif"));
const Personnel = lazy(() => import("./GraphiquePersonnel"));
const Classement = lazy(() => import("./GraphiqueClassement"));

/** `GraphiqueComparatif` chargé à la demande. */
export function GraphiqueComparatif(props: ComponentProps<typeof Comparatif>) {
  return (
    <Suspense fallback={null}>
      <Comparatif {...props} />
    </Suspense>
  );
}

/** `GraphiquePersonnel` chargé à la demande. */
export function GraphiquePersonnel(props: ComponentProps<typeof Personnel>) {
  return (
    <Suspense fallback={null}>
      <Personnel {...props} />
    </Suspense>
  );
}

/** `GraphiqueClassement` chargé à la demande. */
export function GraphiqueClassement(props: ComponentProps<typeof Classement>) {
  return (
    <Suspense fallback={null}>
      <Classement {...props} />
    </Suspense>
  );
}
