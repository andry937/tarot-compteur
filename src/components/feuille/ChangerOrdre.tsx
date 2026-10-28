/**
 * Panneau « Changer l'ordre des joueurs » de la feuille en cours : flèches ↑/↓ puis application.
 * @module
 */

import { useState } from "react";
import { Chip, Cta, Lien } from "@/components/ui";

/** Brouillon d'ordre local ; `onAppliquer` reçoit `ordre[nouveau] = siège actuel`. */
export default function ChangerOrdre({ joueurs, donneur, onAppliquer }: {
  /** Noms affichés, dans l'ordre actuel des sièges. */
  joueurs: string[];
  /** Nom du prochain donneur (il le reste après le changement). */
  donneur: string;
  /** Applique le nouvel ordre. */
  onAppliquer: (ordre: number[]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  /** Brouillon du nouvel ordre : `ordre[position] = siège actuel`. */
  const [ordre, setOrdre] = useState<number[]>([]);

  const deplacer = (pos: number, sens: -1 | 1) =>
    setOrdre((o) => {
      const j = pos + sens;
      if (j < 0 || j >= o.length) return o;
      const c = [...o];
      [c[pos], c[j]] = [c[j], c[pos]];
      return c;
    });

  if (!ouvert) {
    return (
      <Lien
        onClick={() => {
          setOrdre(joueurs.map((_, i) => i));
          setOuvert(true);
        }}
      >
        Changer l'ordre des joueurs
      </Lien>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-black/20 p-3.5" data-testid="changer-ordre">
      <span className="mb-2 flex font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Ordre autour de la table
      </span>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        Les donnes déjà jouées gardent leurs joueurs. {donneur} reste le prochain donneur.
      </p>
      <div className="flex flex-col gap-1.5">
        {ordre.map((s, pos) => (
          <div key={s} className="flex items-center gap-2 text-sm text-slate-100">
            <span className="flex-1">{joueurs[s]}</span>
            <Chip on={false} onClick={() => deplacer(pos, -1)}>
              ↑<span className="sr-only"> Monter {joueurs[s]}</span>
            </Chip>
            <Chip on={false} onClick={() => deplacer(pos, 1)}>
              ↓<span className="sr-only"> Descendre {joueurs[s]}</span>
            </Chip>
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <Lien onClick={() => setOuvert(false)}>Annuler</Lien>
        <div className="flex-1">
          <Cta
            compact
            onClick={() => {
              onAppliquer(ordre);
              setOuvert(false);
            }}
          >
            Appliquer l'ordre
          </Cta>
        </div>
      </div>
    </div>
  );
}
