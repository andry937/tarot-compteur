import type { Alerte } from "@/vision/domain/machinePli";
import { Section } from "@/vision/ui";

const STYLE = {
  info: "border-sky-500/40 text-sky-200",
  avertissement: "border-amber-500/50 text-amber-200",
  erreur: "border-rose-500/60 text-rose-200",
} as const;

export default function PanneauAlertes({ alertes }: { alertes: Alerte[] }) {
  return (
    <Section titre={`Alertes (${alertes.length})`}>
      {alertes.length === 0 ? (
        <p className="text-xs text-slate-500">Aucune incohérence détectée.</p>
      ) : (
        <ul className="space-y-1" data-testid="alertes">
          {[...alertes].reverse().map((a) => (
            <li key={a.cle} data-gravite={a.gravite} className={`rounded-lg border px-2 py-1 text-xs ${STYLE[a.gravite]}`}>
              {a.message}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
