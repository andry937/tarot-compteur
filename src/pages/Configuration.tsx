import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import { Link, useNavigate } from "react-router-dom";
import { resoudreNom, ontDejaJoueEnsemble } from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";
import { Page, Header, GhostButton, Label, Chip, Cta, Lien } from "@/components/ui";

export default observer(function Configuration() {
  const store = useStore();
  const navigate = useNavigate();
  const { roster } = store.registre;
  const historiqueIndex = store.historique.index;
  const onRoster = store.registre.persister;
  const [renommage, setRenommage] = useState<string | null>(null);
  const [texteRenommage, setTexteRenommage] = useState("");
  const [fusionDepuis, setFusionDepuis] = useState<string | null>(null);
  const [erreurFusion, setErreurFusion] = useState<string | null>(null);
  const [voirDesactives, setVoirDesactives] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOuvert) return;
    const fermerSiExterieur = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOuvert(null);
      }
    };
    const fermerSurEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOuvert(null);
    };
    document.addEventListener("mousedown", fermerSiExterieur);
    document.addEventListener("keydown", fermerSurEchap);
    return () => {
      document.removeEventListener("mousedown", fermerSiExterieur);
      document.removeEventListener("keydown", fermerSurEchap);
    };
  }, [menuOuvert]);

  const comptes: Record<string, number> = {};
  historiqueIndex.forEach((h) => {
    (h.joueursId || []).forEach((id) => {
      comptes[id] = (comptes[id] || 0) + 1;
    });
  });

  const parNom = (a: Fiche, b: Fiche) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
  const actifs = roster.filter((r) => r.actif).sort(parNom);
  const desactives = roster.filter((r) => !r.actif).sort(parNom);

  const renommer = (id: string, nomBrut: string) => {
    const nom = nomBrut.trim();
    if (!nom) return;
    onRoster(roster.map((r) => (r.id === id ? { ...r, nom } : r)));
    setRenommage(null);
  };

  const basculerActif = (id: string) => {
    onRoster(roster.map((r) => (r.id === id ? { ...r, actif: !r.actif } : r)));
  };

  const fusionner = (idSource: string, idCible: string) => {
    if (ontDejaJoueEnsemble(idSource, idCible, historiqueIndex)) {
      setErreurFusion("Ces deux joueurs ont déjà joué à la même table — fusion refusée.");
      return;
    }
    onRoster(
      roster.map((r) => (r.id === idSource ? { ...r, actif: false, redirigeVers: idCible } : r))
    );
    setFusionDepuis(null);
    setErreurFusion(null);
  };

  return (
    <Page>
      <Header
        eyebrow={`${actifs.length} joueur${actifs.length > 1 ? "s" : ""}`}
        title="Joueurs"
        actions={<GhostButton onClick={() => navigate("/")}>Retour</GhostButton>}
      />

      {actifs.length === 0 && (
        <p className="mb-4 text-sm leading-relaxed text-slate-400">
          Aucun joueur enregistré pour l'instant — les noms saisis lors d'une partie apparaîtront ici.
        </p>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3">
        {actifs.map((f) => (
          <div
            key={f.id}
            data-testid="roster-row"
            className={`flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 py-3.5 last:border-0 ${
              menuOuvert === f.id ? "relative z-10" : ""
            }`}
          >
            {renommage === f.id ? (
              <div className="w-full">
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3.5 py-3 text-[15px] text-slate-100 focus:border-amber-400 focus:outline-none"
                  autoFocus
                  value={texteRenommage}
                  maxLength={12}
                  onChange={(e) => setTexteRenommage(e.target.value)}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Lien onClick={() => setRenommage(null)}>Annuler</Lien>
                  <div className="flex-1">
                    <Cta compact onClick={() => renommer(f.id, texteRenommage)}>
                      Valider
                    </Cta>
                  </div>
                </div>
              </div>
            ) : fusionDepuis === f.id ? (
              <div className="w-full">
                <Label>Fusionner {f.nom} dans…</Label>
                <div className="flex flex-wrap gap-2">
                  {actifs
                    .filter((r) => r.id !== f.id)
                    .map((cible) => (
                      <Chip key={cible.id} onClick={() => fusionner(f.id, cible.id)}>
                        {cible.nom}
                      </Chip>
                    ))}
                </div>
                {erreurFusion && <p className="mt-1.5 font-mono text-[10px] text-rose-400">{erreurFusion}</p>}
                <Lien
                  className="mt-3"
                  onClick={() => {
                    setFusionDepuis(null);
                    setErreurFusion(null);
                  }}
                >
                  Annuler
                </Lien>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px]" data-testid="roster-nom">
                    {f.nom}
                  </span>
                  <small className="font-mono text-[10px] text-slate-400">
                    {comptes[f.id] || 0} partie{(comptes[f.id] || 0) > 1 ? "s" : ""}
                  </small>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white"
                    to={`/joueurs/${f.id}`}
                  >
                    Stats
                  </Link>
                  <div className="relative" ref={menuOuvert === f.id ? menuRef : undefined}>
                    <button
                      type="button"
                      aria-label="Plus d'actions"
                      aria-haspopup="true"
                      aria-expanded={menuOuvert === f.id}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-base text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                      onClick={() => setMenuOuvert((cur) => (cur === f.id ? null : f.id))}
                    >
                      ⋮
                    </button>
                    {menuOuvert === f.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-40 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg shadow-black/40">
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2.5 text-left font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={() => {
                            setRenommage(f.id);
                            setTexteRenommage(f.nom);
                            setMenuOuvert(null);
                          }}
                        >
                          Renommer
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2.5 text-left font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={() => {
                            setFusionDepuis(f.id);
                            setMenuOuvert(null);
                          }}
                        >
                          Fusionner
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3.5 py-2.5 text-left font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={() => {
                            basculerActif(f.id);
                            setMenuOuvert(null);
                          }}
                        >
                          Désactiver
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {desactives.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white"
            onClick={() => setVoirDesactives((v) => !v)}
          >
            {voirDesactives ? "Masquer" : "Voir"} les joueurs désactivés ({desactives.length})
          </button>
          {voirDesactives && (
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-3">
              {desactives.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2.5 border-b border-slate-800 py-3.5 last:border-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px]">{f.nom}</span>
                    <small className="font-mono text-[10px] text-slate-400">
                      {f.redirigeVers
                        ? `fusionnée dans ${resoudreNom(f.redirigeVers, roster, f.nom)}`
                        : `${comptes[f.id] || 0} partie${(comptes[f.id] || 0) > 1 ? "s" : ""}`}
                    </small>
                  </div>
                  {!f.redirigeVers && (
                    <button
                      type="button"
                      className="font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white"
                      onClick={() => basculerActif(f.id)}
                    >
                      Réactiver
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
});
