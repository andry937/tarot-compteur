/**
 * Primitives visuelles partagées par tous les écrans (Tailwind). Remplacent
 * les classes CSS globales `t-*` de l'ancien styles.ts — même vocabulaire,
 * reconstruit en composants pour garder chaque écran court et cohérent.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

const ghostClasses =
  "whitespace-nowrap rounded-full border border-slate-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:border-slate-500 hover:text-white";

export function GhostButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${ghostClasses} ${className}`} {...rest} />;
}

export function GhostLink({ className = "", ...rest }: LinkProps) {
  return <Link className={`${ghostClasses} ${className}`} {...rest} />;
}

export function Cta({
  compact,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) {
  return (
    <button
      type="button"
      className={`w-full rounded-xl bg-amber-400 text-center font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "py-2.5" : "py-4"} ${className}`}
      {...rest}
    />
  );
}

export function Chip({
  on,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={!!on}
      className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
        on
          ? "border-amber-400 bg-amber-400 font-semibold text-slate-900"
          : "border-slate-700 bg-slate-900/60 text-slate-100 hover:border-slate-500"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
      {children}
    </span>
  );
}

export function Field({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-5 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{children}</div>;
}

export function Header({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 py-5">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-xl px-4 pb-32 sm:max-w-2xl sm:px-6 lg:max-w-3xl">{children}</div>;
}

export function Bar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto max-w-xl sm:max-w-2xl lg:max-w-3xl">{children}</div>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center">
      <p className="font-serif text-lg">{title}</p>
      {hint && <span className="mt-1 block font-mono text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
      {title && <div className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{title}</div>}
      {children}
    </div>
  );
}

export function RankRow({
  rang,
  nom,
  meta,
  valeur,
  negatif,
  onClick,
  testId,
}: {
  rang?: number;
  nom: ReactNode;
  meta?: ReactNode;
  valeur: ReactNode;
  negatif?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  const contenu = (
    <>
      {rang !== undefined && <span className="w-5 shrink-0 font-mono text-[10px] text-slate-500">{rang}</span>}
      <span className="flex-1 truncate text-sm">{nom}</span>
      {meta && <span className="shrink-0 font-mono text-[10px] text-slate-500">{meta}</span>}
      <span
        className={`min-w-[3.5rem] shrink-0 text-right font-serif text-lg font-bold ${negatif ? "text-rose-400" : ""}`}
      >
        {valeur}
      </span>
    </>
  );
  const classes =
    "flex w-full items-baseline gap-2.5 border-b border-slate-800 px-1 py-2.5 text-left last:border-0";
  if (onClick) {
    return (
      <button type="button" className={`${classes} hover:bg-slate-800/40`} onClick={onClick} data-testid={testId}>
        {contenu}
      </button>
    );
  }
  return (
    <div className={classes} data-testid={testId}>
      {contenu}
    </div>
  );
}

export function ArchiveRow({
  gauche,
  droite,
  onClick,
  testId,
}: {
  gauche: ReactNode;
  droite: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex w-full items-center justify-between gap-3 border-b border-slate-800 py-3 text-left last:border-0 hover:bg-slate-800/40"
    >
      {gauche}
      {droite}
    </button>
  );
}

/** Pas de marge intégrée : à composer avec un `className="mt-…"` selon le contexte d'appel. */
export function Lien({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 underline decoration-dotted underline-offset-4 hover:text-slate-200 ${className}`}
      {...rest}
    />
  );
}
