/**
 * Classement par soirée : points cumulés sur les parties jouées à moins de 24 h les unes des autres.
 * @module
 */
import { useMemo, useState } from "react";
import { fmt } from "@/domain/score/regles";
import type { Fiche } from "@/domain/joueurs/identite";
import type { PartieAnalysee } from "@/domain/stats/stats";
import { classementSoiree, grouperSoirees, libelleSoiree } from "@/domain/stats/soirees";
import type { Soiree } from "@/domain/stats/soirees";
import { GhostButton, Section, RankRow, Empty } from "@/components/ui";

interface ClassementSoireeProps {
  parties: PartieAnalysee[];
  roster: Fiche[];
  chargement: boolean;
  /** Lance l'animation de fin de soirée pour la soirée affichée. */
  onAnimer: (soiree: Soiree) => void;
}

/** Sélecteur de soirée (la plus récente d'abord) et classement en points de la soirée choisie. */
export default function ClassementSoiree({ parties, roster, chargement, onAnimer }: ClassementSoireeProps) {
  const soirees = useMemo(() => grouperSoirees(parties), [parties]);
  const [rang, setRang] = useState(0);
  const i = Math.min(rang, Math.max(soirees.length - 1, 0));
  const soiree = soirees[i];
  const lignes = useMemo(() => (soiree ? classementSoiree(soiree, roster) : []), [soiree, roster]);

  if (chargement) return <p className="text-sm text-slate-400">Calcul du classement…</p>;
  if (!soiree) return <Empty title="Aucune soirée pour l'instant." hint="Une soirée regroupe les parties jouées à moins de 24 h les unes des autres" />;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2" data-testid="selecteur-soiree">
        <GhostButton aria-label="Soirée précédente" disabled={i >= soirees.length - 1} onClick={() => setRang(i + 1)}>
          ←
        </GhostButton>
        <span className="text-center font-semibold capitalize text-slate-100" data-testid="soiree-courante">
          {libelleSoiree(soiree)}
          <span className="block font-mono text-[10px] font-normal normal-case tracking-wider text-slate-400">
            {soiree.parties.length} partie{soiree.parties.length > 1 ? "s" : ""}
          </span>
        </span>
        <GhostButton aria-label="Soirée suivante" disabled={i === 0} onClick={() => setRang(i - 1)}>
          →
        </GhostButton>
      </div>
      <Section>
        {lignes.map((l, r) => (
          <RankRow
            key={l.id}
            rang={r + 1}
            nom={l.nom}
            meta={`${l.donnes} donne${l.donnes > 1 ? "s" : ""} · ${l.parties} partie${l.parties > 1 ? "s" : ""}`}
            valeur={fmt(l.pts)}
            negatif={l.pts < 0}
            testId="soiree-row"
          />
        ))}
      </Section>
      {lignes.length > 0 && (
        <div className="mt-3">
          <GhostButton onClick={() => onAnimer(soiree)}>🎉 Voir l'animation de la soirée</GhostButton>
        </div>
      )}
    </>
  );
}
