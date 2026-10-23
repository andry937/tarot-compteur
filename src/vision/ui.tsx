import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Bouton({ variante = "fantome", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "fantome" | "plein" }) {
  const base = "rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40";
  const style =
    variante === "plein"
      ? "bg-amber-400 font-semibold text-slate-900 hover:bg-amber-300"
      : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white";
  return <button type="button" className={`${base} ${style} ${className}`} {...rest} />;
}

export function Section({ titre, children, droite }: { titre: string; children: ReactNode; droite?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{titre}</h2>
        {droite}
      </div>
      {children}
    </section>
  );
}

export function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-slate-400">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider">{libelle}</span>
      {children}
    </label>
  );
}

export const classeSelect = "w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none";
