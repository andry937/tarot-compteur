import { useState } from "react";
import { Link } from "react-router-dom";
import { normaliser } from "../utils/identite";
import type { Fiche } from "../utils/identite";
import type { HistoriqueEntree } from "../types";
import { CSS } from "../styles/styles";

const nomsParDefaut = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => (i === 0 ? "Andry" : ""));

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

  return (
    <div className="tarot">
      <style>{CSS}</style>
      <div className="t-head">
        <div>
          <div className="t-eyebrow">Tarot à la française</div>
          <h1 className="t-title">Feuille de marque</h1>
        </div>
        <div className="t-head-actions">
          <Link className="t-ghost" to="/joueurs">
            Joueurs{roster.filter((r) => r.actif).length > 0 ? ` (${roster.filter((r) => r.actif).length})` : ""}
          </Link>
          <Link className="t-ghost" to="/historique">
            Historique{historiqueIndex.length > 0 ? ` (${historiqueIndex.length})` : ""}
          </Link>
        </div>
      </div>
      <div className="t-setup">
        <div className="t-field">
          <span className="t-label">Joueurs à table</span>
          <div className="t-count">
            <button className="t-step" onClick={() => majNb(-1)} aria-label="Un joueur de moins">
              −
            </button>
            <b>{nbSetup}</b>
            <button className="t-step" onClick={() => majNb(1)} aria-label="Un joueur de plus">
              +
            </button>
            <span>
              {nbSetup > parDonneSetup
                ? `${nbSetup - parDonneSetup} au repos à chaque donne`
                : "tout le monde joue"}
            </span>
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Joueurs par donne</span>
          <div className="t-chips">
            {options.map((n) => (
              <button
                key={n}
                className="t-chip"
                data-on={parDonneSetup === n ? 1 : 0}
                onClick={() => setParDonneSetup(n)}
              >
                {n}
                <small>{n === 5 ? "avec appelé" : n === 4 ? "classique" : "à trois"}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Ordre autour de la table</span>
          <div className="t-players">
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
                  className="t-champ-nom"
                  draggable
                  data-drag={dragIndex === i ? 1 : 0}
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
                    className="t-input"
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
                    <div className="t-suggestions">
                      {suggestions.map((r) => (
                        <button
                          key={r.id}
                          className="t-suggestion"
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
                    <p className="t-erreur">Déjà pris par un autre siège</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="t-bar">
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
            <button
              className="t-cta"
              disabled={!valide}
              onClick={() => onValider(nomsTrim, parDonneSetup)}
            >
              {libelle}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
