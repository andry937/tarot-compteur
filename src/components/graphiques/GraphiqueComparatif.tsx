/**
 * Graphique comparatif des joueurs d'une partie (Recharts).
 * @module
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { resumerDonnees } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import { Section } from "@/components/ui";

interface GraphiqueComparatifProps {
  joueurs: string[];
  donnes: Donne[];
  nbTotal: number;
}

/** Une couleur distincte par joueur, cyclée si plus de 12 à table. */
const COULEURS = [
  "#fbbf24", "#34d399", "#38bdf8", "#fb7185",
  "#a78bfa", "#fb923c", "#2dd4bf", "#e879f9",
  "#a3e635", "#22d3ee", "#f472b6", "#818cf8",
];

/** Vue comparative de la partie : tous les joueurs superposés sur l'axe des
 * donnes globales de cette partie. Un joueur au repos pendant une rotation
 * garde le même cumul d'une donne à l'autre — la ligne dessine naturellement
 * un plateau, sans traitement particulier (même source que ScoreGrid). */
export default function GraphiqueComparatif({ joueurs, donnes, nbTotal }: GraphiqueComparatifProps) {
  if (donnes.length === 0) return null;
  const { cumuls } = resumerDonnees(donnes, nbTotal);
  const data = cumuls.map((ligne, i) => {
    const point: Record<string, number> = { donne: i + 1 };
    joueurs.forEach((nom, j) => {
      point[nom] = ligne[j];
    });
    return point;
  });

  return (
    <Section title="Progression">
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="donne"
              stroke="#64748b"
              tick={{ fontSize: 10, fontFamily: "monospace" }}
              label={{ value: "Donne", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }}
            />
            <YAxis stroke="#64748b" tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12, borderRadius: 8 }}
              labelFormatter={(v) => `Donne ${v}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {joueurs.map((nom, i) => (
              <Line
                key={nom}
                type="monotone"
                dataKey={nom}
                stroke={COULEURS[i % COULEURS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
