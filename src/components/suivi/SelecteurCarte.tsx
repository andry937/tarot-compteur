import { COULEURS, libelleCarte, toutesLesCartes } from "@/domain/cartes/cartes";
import { NOM_ROI } from "@/domain/score/regles";
import { classeSelect } from "@/vision/ui";

interface Props {
  valeur: string;
  onChange: (carte: string) => void;
  etiquette: string;
  testId?: string;
  compact?: boolean;
}

const CARTES = toutesLesCartes();
const GROUPES: { titre: string; cartes: string[] }[] = [
  { titre: "Atouts et Excuse", cartes: CARTES.filter((c) => c.startsWith("atout-") || c === "excuse") },
  ...COULEURS.map((c) => ({ titre: NOM_ROI[c], cartes: CARTES.filter((x) => x.startsWith(`${c}-`)) })),
];

/** Liste déroulante des 78 cartes, rangées par famille. */
export default function SelecteurCarte({ valeur, onChange, etiquette, testId, compact }: Props) {
  return (
    <select aria-label={etiquette} data-testid={testId} value={valeur} onChange={(e) => onChange(e.target.value)}
      className={compact ? "rounded-md border border-slate-700 bg-slate-900 px-1 py-1 text-xs text-slate-100" : classeSelect}>
      {GROUPES.map((g) => (
        <optgroup key={g.titre} label={g.titre}>
          {g.cartes.map((c) => (
            <option key={c} value={c}>{libelleCarte(c)}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
