/**
 * Graphique de l'évolution du classement général (Recharts).
 * @module
 */

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PointEvolution } from "@/domain/stats/elo";
import { Section, Chip } from "@/components/ui";

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
  const [masques, setMasques] = useState<Set<string>>(new Set());
  if (joueurs.length === 0 || evolution.length < 2) return null;
  const basculer = (id: string) =>
    setMasques((m) => {
      const n = new Set(m);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const data = evolution.map((p) => {
    const point: Record<string, number> = { partie: p.partie };
    joueurs.forEach((j) => {
      if (j.id in p.notes) point[j.nom] = p.notes[j.id];
    });
    return point;
  });

  return (
    <Section title="Évolution des notes">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {joueurs.map((j, i) => (
          <Chip
            key={j.id}
            on={!masques.has(j.id)}
            onClick={() => basculer(j.id)}
            className="!py-1 !text-xs"
            data-testid="graphique-classement-joueur"
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COULEURS[i % COULEURS.length] }} />
            {j.nom}
          </Chip>
        ))}
      </div>
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
            {joueurs.map((j, i) => masques.has(j.id) ? null : (
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
