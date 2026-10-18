import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import AppRoutes from "@/app/AppRoutes";
import { Cta } from "@/components/ui";
import { RootStore } from "@/stores/RootStore";
import { StoreProvider } from "@/stores/contexte";

export default observer(function App() {
  const [store] = useState(() => new RootStore());

  useEffect(() => {
    store.demarrer();
    return store.arreter;
  }, [store]);

  if (store.erreurChargement)
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

  if (!store.pret) return <div className="min-h-screen bg-slate-950" />;

  return (
    <StoreProvider value={store}>
      {store.avertissement && (
        <div role="alert" className="fixed inset-x-0 top-0 z-50 flex items-start gap-3 bg-rose-900 px-4 py-3 text-sm text-rose-50">
          <span className="flex-1">{store.avertissement}</span>
          <button type="button" aria-label="Fermer l'avertissement" onClick={store.fermerAvertissement}>
            ✕
          </button>
        </div>
      )}
      <AppRoutes />
    </StoreProvider>
  );
});
