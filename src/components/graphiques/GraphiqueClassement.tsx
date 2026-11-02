/**
 * Graphique de l'évolution du classement général (Recharts).
 * @module
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PointEvolution } from "@/domain/stats/elo";
import { Section } from "@/components/ui";

interface GraphiqueClassementProps {
  /** Joueurs à tracer (ceux du classement), dans l'ordre du classement. */
  joueurs: { id: string; nom: string }[];
  evolution: PointEvolution[];
}

const COULEURS = [
  "#fbbf24", "#34d399", "#38bdf8", "#fb7185",
  "#a78bfa", "#fb923c", "#2dd4bf", "#e879f9",
  "#a3e635", "#22d3ee", "#f472b6", "#818cf8",
];

/** Note de chaque joueur du classement après chaque partie archivée. Un joueur
 * n'a pas de point tant qu'il n'a pas joué. */
export default function GraphiqueClassement({ joueurs, evolution }: GraphiqueClassementProps) {
  if (joueurs.length === 0 || evolution.length < 2) return null;
  const data = evolution.map((p) => {
    const point: Record<string, number> = { partie: p.partie };
    joueurs.forEach((j) => {
      if (j.id in p.notes) point[j.nom] = p.notes[j.id];
    });
    return point;
  });

  return (
    <Section title="Évolution des notes">
      <div className="h-64 w-full sm:h-72" data-testid="graphique-classement">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="partie"
              stroke="#64748b"
              tick={{ fontSize: 10, fontFamily: "monospace" }}
              label={{ value: "Partie", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }}
            />
            <YAxis stroke="#64748b" tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12, borderRadius: 8 }}
              labelFormatter={(v) => `Partie ${v}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {joueurs.map((j, i) => (
              <Line
                key={j.id}
                type="monotone"
                dataKey={j.nom}
                stroke={COULEURS[i % COULEURS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
