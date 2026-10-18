import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useParams, useNavigate } from "react-router-dom";
import { cleArchive } from "@/lib/storage/stockage";
import { invaliderArchive } from "@/lib/storage/archives";
import { resumerDonnees } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import type { ArchiveRecord } from "@/domain/types";
import ArchiveFeuille from "@/components/feuille/ArchiveFeuille";
import { Page, Header, GhostButton, GhostLink, Empty, ArchiveRow } from "@/components/ui";

export default observer(function Historique() {
  const store = useStore();
  const index = store.historique.index;
  const { roster } = store.registre;
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ArchiveRecord | null>(null);
  const [chargement, setChargement] = useState(false);

  const { enAttente: confirmerSuppression, declencher: surSupprimer } = useConfirmation(() => {
    if (!id) return;
    store.historique.supprimer(id).then(() => navigate("/historique"));
  });

  const surModifierDonne = async (donneIndex: number, d: Donne) => {
    if (!id || !record) return;
    const nouveau: ArchiveRecord = {
      ...record,
      donnes: record.donnes.map((old, k) => (k === donneIndex ? d : old)),
    };
    setRecord(nouveau); // affichage immédiat
    try {
      invaliderArchive(id);
      await window.storage.set(cleArchive(id), JSON.stringify(nouveau));
      const { totaux } = resumerDonnees(nouveau.donnes, nouveau.joueursId.length);
      store.historique.modifierTotaux(id, totaux);
    } catch (e) {
      console.error("Modification de la donne archivée impossible", e);
    }
  };

  useEffect(() => {
    if (!id) {
      setRecord(null);
      return;
    }
    setChargement(true);
    (async () => {
      try {
        const r = await window.storage.get(cleArchive(id));
        setRecord(JSON.parse(r.value));
      } catch (e) {
        console.error("Lecture de l'archive impossible", e);
      }
      setChargement(false);
    })();
  }, [id]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  if (id) {
    const resume = index.find((r) => r.id === id);
    return (
      <Page>
        <Header
          eyebrow={resume ? fmtDate(resume.date) : "Archive"}
          title="Partie close"
          actions={
            <>
              <GhostLink to="/">Accueil</GhostLink>
              <GhostButton onClick={() => navigate("/historique")}>Retour</GhostButton>
              <GhostButton onClick={surSupprimer}>
                {confirmerSuppression ? "Confirmer ?" : "Supprimer"}
              </GhostButton>
            </>
          }
        />
        {chargement && <p className="text-sm text-slate-400">Chargement de la feuille…</p>}
        {record && <ArchiveFeuille record={record} roster={roster} onModifierDonne={surModifierDonne} />}
      </Page>
    );
  }

  return (
    <Page>
      <Header
        eyebrow={`${index.length} partie${index.length > 1 ? "s" : ""} archivée${index.length > 1 ? "s" : ""}`}
        title="Historique"
        actions={<GhostButton onClick={() => navigate("/")}>Retour</GhostButton>}
      />

      {index.length === 0 ? (
        <Empty title="Aucune partie archivée." hint="Elle apparaîtra ici dès qu'une feuille sera close" />
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3">
          {index.map((p) => {
            const meneur = (p.joueurs || [])
              .map((nom, i) => ({ nom, pts: p.totaux ? p.totaux[i] : 0 }))
              .sort((a, b) => b.pts - a.pts)[0];
            return (
              <ArchiveRow
                key={p.id}
                testId="archive-row"
                onClick={() => navigate(`/historique/${p.id}`)}
                gauche={
                  <div className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      {fmtDate(p.date)}
                    </span>
                    <span className="mt-0.5 block truncate text-[13.5px]">{(p.joueurs || []).join(", ")}</span>
                  </div>
                }
                droite={
                  <div className="shrink-0 text-right">
                    <span className="block font-mono text-[10px] text-slate-400">{p.nbDonnes} donnes</span>
                    {meneur && (
                      <span className="mt-0.5 block font-serif text-[15px] font-bold text-amber-400">
                        {meneur.nom} {meneur.pts > 0 ? "+" : ""}
                        {meneur.pts}
                      </span>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </Page>
  );
});
