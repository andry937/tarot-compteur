/**
 * Contexte React donnant accès au `RootStore` depuis les écrans.
 * @module
 */

import { createContext, useContext } from "react";
import type { RootStore } from "@/stores/RootStore";

const StoreContexte = createContext<RootStore | null>(null);

/** Fournisseur du store, monté par `<App/>`. */
export const StoreProvider = StoreContexte.Provider;

/** Store de l'app — uniquement sous <App/>, qui le crée et le fournit. */
export function useStore(): RootStore {
  const store = useContext(StoreContexte);
  if (!store) throw new Error("useStore() appelé hors de <App/>");
  return store;
}
