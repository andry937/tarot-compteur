import { useState } from "react";
import { normaliser } from "../utils/identite";
import type { Fiche } from "../utils/identite";
import type { HistoriqueEntree } from "../types";
import { Page, Header, GhostLink, Field, Label, Chip, Cta, Bar } from "../components/ui";

const nomsParDefaut = (n: number): string[] => Array.from({ length: n }, () => "");

interface CompositionTableProps {
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
  onValider: (noms: string[], parDonne: number) => void;
}

export default function CompositionTable({ roster, historiqueIndex, onValider }: CompositionTableProps) {
  const [nbSetup, setNbSetup] = useState(5);
  const [parDonneSetup, setParDonneSetup] = useState(5);
  const [nomsSetup, setNomsSetup] = useState<string[]>(nomsParDefaut(5));
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const majNb = (delta: number) => {
    const n = Math.min(12, Math.max(3, nbSetup + delta));
    setNbSetup(n);
    setNomsSetup((noms) =>
      n > noms.length
        ? [...noms, ...Array.from({ length: n - noms.length }, () => "")]
        : noms.slice(0, n)
    );
    if (parDonneSetup > n) setParDonneSetup(n);
  };
  const options = [3, 4, 5].filter((n) => n <= nbSetup);

  const actifs = roster.filter((r) => r.actif).length;

  return (
    <Page>
      <Header
        eyebrow="Tarot à la française"
        title="Feuille de marque"
        actions={
          <>
            <GhostLink to="/joueurs">Joueurs{actifs > 0 ? ` (${actifs})` : ""}</GhostLink>
            <GhostLink to="/historique">
              Historique{historiqueIndex.length > 0 ? ` (${historiqueIndex.length})` : ""}
            </GhostLink>
            <GhostLink to="/classement">Classement</GhostLink>
          </>
        }
      />

      <Field>
        <Label>Joueurs à table</Label>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 text-xl hover:border-slate-500"
            onClick={() => majNb(-1)}
            aria-label="Un joueur de moins"
          >
            −
          </button>
          <b className="min-w-[2.2rem] text-center font-serif text-3xl font-bold">{nbSetup}</b>
          <button
            type="button"
            className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 text-xl hover:border-slate-500"
            onClick={() => majNb(1)}
            aria-label="Un joueur de plus"
          >
            +
          </button>
          <span className="text-xs leading-snug text-slate-400">
            {nbSetup > parDonneSetup
              ? `${nbSetup - parDonneSetup} au repos à chaque donne`
              : "tout le monde joue"}
          </span>
        </div>
      </Field>

      <Field>
        <Label>Joueurs par donne</Label>
        <div className="flex flex-wrap gap-2">
          {options.map((n) => (
            <Chip key={n} on={parDonneSetup === n} onClick={() => setParDonneSetup(n)}>
              {n}
              <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">
                {n === 5 ? "avec appelé" : n === 4 ? "classique" : "à trois"}
              </small>
            </Chip>
          ))}
        </div>
      </Field>

      <Field>
        <Label>Ordre autour de la table</Label>
        <div className="flex flex-col gap-2">
          {nomsSetup.map((nom, i) => {
            const val = normaliser(nom);
            const prises = nomsSetup.filter((_, j) => j !== i).map(normaliser);
            const suggestions = roster
              .filter((r) => r.actif)
              .filter((r) => normaliser(r.nom) !== val)
              .filter((r) => !prises.includes(normaliser(r.nom)))
              .filter((r) => val === "" || normaliser(r.nom).includes(val))
              .slice(0, 6);
            return (
              <div
                key={i}
                data-testid="champ-nom"
                className={`relative ${dragIndex === i ? "cursor-grabbing opacity-50" : "cursor-grab"}`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== i) {
                    setNomsSetup((n) => {
                      const copy = [...n];
                      [copy[dragIndex], copy[i]] = [copy[i], copy[dragIndex]];
                      return copy;
                    });
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <input
                  className="w-full select-text rounded-lg border border-slate-700 bg-slate-900/70 px-3.5 py-3 text-[15px] text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  value={nom}
                  maxLength={12}
                  placeholder={`Joueur ${i + 1}`}
                  onFocus={() => setFocusIndex(i)}
                  onBlur={() => setTimeout(() => setFocusIndex((f) => (f === i ? null : f)), 120)}
                  onChange={(e) =>
                    setNomsSetup((n) => n.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
                {focusIndex === i && suggestions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {suggestions.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] text-amber-300"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNomsSetup((n) => n.map((x, j) => (j === i ? r.nom : x)));
                          setFocusIndex(null);
                        }}
                      >
                        {r.nom}
                      </button>
                    ))}
                  </div>
                )}
                {prises.includes(val) && val !== "" && (
                  <p className="mt-1 font-mono text-[10px] text-rose-400">Déjà pris par un autre siège</p>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <Bar>
        {(() => {
          const nomsTrim = nomsSetup.map((n) => n.trim());
          const manquants = nomsTrim.filter((n) => n === "").length;
          const valeurs = nomsTrim.map(normaliser);
          const doublon = valeurs.some((v, i) => v !== "" && valeurs.indexOf(v) !== i);
          const valide = manquants === 0 && !doublon;
          const libelle = doublon
            ? "Deux sièges ont le même nom"
            : manquants > 0
            ? `Encore ${manquants} joueur${manquants > 1 ? "s" : ""} à nommer`
            : "Tirer qui distribue";
          return (
            <Cta disabled={!valide} onClick={() => onValider(nomsTrim, parDonneSetup)}>
              {libelle}
            </Cta>
          );
        })()}
      </Bar>
    </Page>
  );
}
