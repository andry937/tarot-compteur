/**
 * Graphique de la trajectoire personnelle d'un joueur (Recharts).
 * @module
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { PointTrajectoire } from "@/domain/stats/stats";
import { fmt } from "@/domain/score/regles";
import { Section } from "@/components/ui";

interface GraphiquePersonnelProps {
  trajectoire: PointTrajectoire[];
}

/** Fiche joueur : axe personnel dense — uniquement les donnes réellement
 * jouées par ce joueur, toutes parties confondues, dans l'ordre
 * chronologique (contrairement à la vue comparative d'une partie, il n'y a
 * pas de plateau de repos ici puisque les donnes non jouées sont exclues). */
export default function GraphiquePersonnel({ trajectoire }: GraphiquePersonnelProps) {
  if (trajectoire.length === 0) return null;

  return (
    <Section title="Progression">
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trajectoire} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="index"
              stroke="#64748b"
              tick={{ fontSize: 10, fontFamily: "monospace" }}
              label={{ value: "Donnes jouées", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }}
            />
            <YAxis stroke="#64748b" tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12, borderRadius: 8 }}
              labelFormatter={(v) => `Donne ${v}`}
              formatter={(v) => [fmt(Number(v)), "Cumul"]}
            />
            <Line type="monotone" dataKey="cumul" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
