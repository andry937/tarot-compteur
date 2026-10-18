import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { calculerClassementElo } from "@/domain/stats/elo";
import type { ClassementElo } from "@/domain/stats/elo";
import type { Fiche } from "@/domain/joueurs/identite";
import type { HistoriqueEntree } from "@/domain/types";
import { chargerParties } from "@/lib/storage/archives";
import { Page, Header, GhostLink, Section, RankRow, Empty } from "@/components/ui";
import ExplicationElo from "@/components/stats/ExplicationElo";

interface ClassementProps {
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
}

/** Nombre de donnes jouées requis pour figurer au classement. */
export const DONNES_MIN = 50;

export default function Classement({ roster, historiqueIndex }: ClassementProps) {
  const navigate = useNavigate();
  const [classement, setClassement] = useState<ClassementElo[] | null>(null);
  const [chargement, setChargement] = useState(true);

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
    </Page>
  );
}
