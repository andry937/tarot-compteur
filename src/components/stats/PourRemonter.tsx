/**
 * Section « Pour remonter » de la feuille : écart et contrat à tenter pour les joueurs qui n'ont plus qu'une donne.
 * @module
 */
import { fmt } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import { conseilsRemontee } from "@/domain/stats/remontee";
import type { Rattrapage } from "@/domain/stats/remontee";
import { Section } from "@/components/ui";

interface PourRemonterProps {
  donnes: Donne[];
  /** Noms par siège. */
  joueurs: string[];
  nbTotal: number;
  /** Sièges à table à la prochaine donne. */
  prochaineTable: number[];
}

/** Une ligne « écart + proposition » pour une cible. */
function Ligne({ r, titre }: { r: Rattrapage; titre: string }) {
  const p = r.proposition;
  return (
    <li className="leading-relaxed">
      {titre} <b className="font-semibold text-slate-100">{r.cible}</b> : <span className="font-mono">{fmt(r.ecart)}</span> points d'écart.{" "}
      {p ? (
        <>
          Tentez une <b className="font-semibold text-amber-400">{p.contrat}</b> en faisant{" "}
          <b className="font-semibold">{p.points} points</b> ({p.bouts} bouts)
          {p.difficile && " — audacieux"}.
        </>
      ) : (
        "Hors de portée à la prochaine donne."
      )}
    </li>
  );
}

/** Rien à afficher tant qu'aucun joueur n'est à une donne de la fin. */
export default function PourRemonter({ donnes, joueurs, nbTotal, prochaineTable }: PourRemonterProps) {
  const conseils = conseilsRemontee(donnes, joueurs, nbTotal, prochaineTable);
  if (conseils.length === 0) return null;
  return (
    <Section title="Pour remonter">
      <div className="flex flex-col gap-3 px-1 text-xs text-slate-300" data-testid="pour-remonter">
        {conseils.map((c) => (
          <div key={c.siege} data-testid="conseil-remontee">
            <div className="text-sm font-semibold text-slate-100">
              {c.nom} <span className="font-mono text-[10px] font-normal text-slate-400">{c.rang}ᵉ · dernière donne</span>
            </div>
            {c.joue ? (
              <ul className="mt-1 flex flex-col gap-1">
                <Ligne r={c.devant} titre="Pour dépasser" />
                {c.leader && <Ligne r={c.leader} titre="Pour gagner, rattraper" />}
              </ul>
            ) : (
              <p className="mt-1">Au repos à la prochaine donne : {c.devant.ecart} points de retard sur {c.devant.cible}.</p>
            )}
          </div>
        ))}
        <p className="text-[11px] text-slate-500">
          Calcul pour sa dernière donne en preneur, avec 2 bouts et sans prime, si le joueur visé défend. Une donne de plus
          peut tout changer.
        </p>
      </div>
    </Section>
  );
}
