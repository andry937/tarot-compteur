/**
 * Chronomètres de la feuille en cours : durée de la donne qui se joue et de la partie.
 * @module
 */

import { useEffect, useState } from "react";
import type { Donne } from "@/domain/score/regles";
import { formaterDuree } from "@/domain/stats/durees";

/** Affiche « Donne : … · Partie : … », rafraîchi chaque seconde ; rien si le début de la partie est inconnu. */
export default function Chrono({ debut, donnes }: { debut?: number; donnes: Donne[] }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const debutDonne = donnes.length ? donnes[donnes.length - 1].finA : debut;
  if (debut === undefined) return null;
  return (
    <dd className="mt-1.5 font-mono text-xs text-slate-400" data-testid="chrono">
      ⏱ Donne : {debutDonne !== undefined ? formaterDuree(maintenant - debutDonne) : "—"} · Partie :{" "}
      {formaterDuree(maintenant - debut)}
    </dd>
  );
}
