/**
 * Écran du classement général (`/classement`).
 * @module
 */

import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import { useNavigate } from "react-router-dom";
import { calculerClassementElo } from "@/domain/stats/elo";
import type { ClassementElo } from "@/domain/stats/elo";
import { chargerParties } from "@/lib/storage/archives";
import { Page, Header, GhostLink, GhostButton, Section, RankRow, Empty } from "@/components/ui";
import ExplicationElo from "@/components/stats/ExplicationElo";

/** Nombre de donnes jouées requis pour figurer au classement. */
export const DONNES_MIN = 50;

/** Classement général des joueurs ayant assez de donnes, recalculé depuis toutes les archives. */
export default observer(function Classement() {
  const store = useStore();
  const { roster } = store.registre;
  const historiqueIndex = store.historique.index;
  const navigate = useNavigate();
  const [classement, setClassement] = useState<ClassementElo[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [export_, setExport] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  /** Export en lecture seule (joueurs + parties archivées) pour analyser le
   * classement hors de l'app : copié dans le presse-papier, sinon affiché
   * dans une zone de texte à sélectionner (mobile). */
  const exporter = async () => {
    const parties = await chargerParties(historiqueIndex);
    const json = JSON.stringify({ roster, parties });
    setExport(json);
    try {
      await navigator.clipboard.writeText(json);
      setCopie(true);
    } catch {
      setCopie(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    (async () => {
      const parties = await chargerParties(historiqueIndex);
      // Seuls ceux qui ont joué au moins DONNES_MIN donnes figurent au classement,
      // mais tous pèsent dans le calcul des notes.
      // Les joueurs sans nom (« ∅ », anciens joueurs importés) pèsent dans le calcul
      // des notes des autres mais n'ont pas leur place dans l'affichage du classement.
      setClassement(
        calculerClassementElo(parties, roster).filter(
          (c) => c.nom.trim() !== "" && c.nom.trim() !== "∅" && c.matchs >= DONNES_MIN
        )
      );
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historiqueIndex.length]);

  return (
    <Page>
      <Header eyebrow="Classement général" title="Note" actions={<GhostLink to="/">Accueil</GhostLink>} />

      {chargement && <p className="text-sm text-slate-400">Calcul du classement…</p>}

      {!chargement && classement && classement.length === 0 && (
        <Empty title="Personne n'a encore atteint le seuil." hint={`Seuls les joueurs ayant joué au moins ${DONNES_MIN} donnes figurent au classement`} />
      )}

      {!chargement && classement && classement.length > 0 && (
        <Section>
          {classement.map((c, r) => (
            <RankRow
              key={c.id}
              rang={r + 1}
              nom={c.nom}
              meta={`${c.matchs} donne${c.matchs > 1 ? "s" : ""}`}
              valeur={c.note}
              onClick={() => navigate(`/joueurs/${c.id}`)}
            />
          ))}
        </Section>
      )}

      <ExplicationElo />

      <details className="mt-6 border-t border-slate-800 pt-4">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Exporter les données
        </summary>
        <div className="mt-3">
          <GhostButton onClick={exporter}>Copier les données</GhostButton>
          {export_ && copie && <p className="mt-2 text-xs text-slate-400">Copié dans le presse-papier.</p>}
          {export_ && !copie && (
            <textarea
              readOnly
              value={export_}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 h-32 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 font-mono text-[10px] text-slate-300"
            />
          )}
        </div>
      </details>
    </Page>
  );
});
