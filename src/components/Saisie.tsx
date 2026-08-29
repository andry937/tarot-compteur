import { useState } from "react";
import { CONTRATS, SEUILS, POIGNEES, CHELEMS, calculer } from "../utils/regles";
import type { Donne, Misere, PetitAuBout } from "../utils/regles";

interface SaisieProps {
  joueurs: string[];
  parDonne: number;
  tableProposee: number[];
  total: number;
  numero: number;
  onFermer: () => void;
  onValider: (d: Donne) => void;
}

export default function Saisie({ joueurs, parDonne, tableProposee, total, numero, onFermer, onValider }: SaisieProps) {
  const [table, setTable] = useState<number[]>(tableProposee);
  const [donneur, setDonneur] = useState(tableProposee[0]);
  const [preneur, setPreneur] = useState(tableProposee[0]);
  const [appele, setAppele] = useState<number | null>(null);
  const [contrat, setContrat] = useState("garde");
  const [bouts, setBouts] = useState<0 | 1 | 2 | 3>(1);
  const [points, setPoints] = useState(51);
  const [petitAuBout, setPetitAuBout] = useState<PetitAuBout>("aucun");
  const [poignee, setPoignee] = useState("aucune");
  const [chelem, setChelem] = useState("aucun");
  const [miseres, setMiseres] = useState<Misere[]>([]);

  const complete = table.length === parDonne && table.includes(preneur);
  const donne: Donne = {
    table, donneur, preneur, appele, contrat, bouts, points, petitAuBout, poignee, chelem,
    miseres,
  };
  const entame = table.length > 1 ? table[(table.indexOf(donneur) + 1) % table.length] : null;
  const res = calculer(donne, joueurs.length);
  const seuil = SEUILS[bouts];
  const cadrer = (v: number) => Math.min(91, Math.max(0, Math.round(v * 2) / 2));

  const ajouterMisere = () =>
    setMiseres((m) => [
      ...m,
      { id: `${Date.now()}-${m.length}`, joueur: table[0], type: "atout", aTort: false },
    ]);
  const majMisere = (idx: number, patch: Partial<Misere>) =>
    setMiseres((m) => m.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const retirerMisere = (idx: number) => setMiseres((m) => m.filter((_, i) => i !== idx));

  // On conserve l'ordre du tour de table, en partant du donneur.
  const basculer = (i: number) => {
    const brut = table.includes(i) ? table.filter((x) => x !== i) : [...table, i];
    const pivot = brut.includes(donneur) ? donneur : (brut[0] ?? 0);
    const suivant = [...brut].sort(
      (a, b) => ((a - pivot + total) % total) - ((b - pivot + total) % total)
    );
    setTable(suivant);
    if (!suivant.includes(donneur)) setDonneur(suivant[0] ?? 0);
    if (!suivant.includes(preneur)) setPreneur(suivant[0] ?? 0);
    if (appele !== null && !suivant.includes(appele)) setAppele(null);
  };

  return (
    <div className="t-modal" onClick={onFermer}>
      <div className="t-panel" onClick={(e) => e.stopPropagation()}>
        <div className="t-panel-head">
          <span className="t-panel-title">Donne {numero}</span>
          <button className="t-close" onClick={onFermer}>
            Fermer
          </button>
        </div>

        {joueurs.length > parDonne && (
          <div className="t-field">
            <span className="t-label">
              Qui joue cette donne
              <em>
                {table.length} / {parDonne}
              </em>
            </span>
            <div className="t-chips">
              {joueurs.map((j, i) => (
                <button
                  key={i}
                  className="t-chip"
                  data-on={table.includes(i) ? 1 : 0}
                  data-repos={table.includes(i) ? 0 : 1}
                  onClick={() => basculer(i)}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="t-field">
          <span className="t-label">
            Donneur
            {entame !== null && <em>{joueurs[entame]} entame</em>}
          </span>
          <div className="t-chips">
            {table.map((i) => (
              <button
                key={i}
                className="t-chip"
                data-on={donneur === i ? 1 : 0}
                onClick={() => setDonneur(i)}
              >
                {joueurs[i]}
              </button>
            ))}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Preneur</span>
          <div className="t-chips">
            {table.map((i) => (
              <button
                key={i}
                className="t-chip"
                data-on={preneur === i ? 1 : 0}
                onClick={() => {
                  setPreneur(i);
                  if (appele === i) setAppele(null);
                }}
              >
                {joueurs[i]}
              </button>
            ))}
          </div>
        </div>

        {table.length === 5 && (
          <div className="t-field">
            <span className="t-label">Roi appelé chez</span>
            <div className="t-chips">
              <button
                className="t-chip"
                data-on={appele === null ? 1 : 0}
                onClick={() => setAppele(null)}
              >
                Lui-même
                <small>joue seul</small>
              </button>
              {table
                .filter((i) => i !== preneur)
                .map((i) => (
                  <button
                    key={i}
                    className="t-chip"
                    data-on={appele === i ? 1 : 0}
                    onClick={() => setAppele(i)}
                  >
                    {joueurs[i]}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="t-field">
          <span className="t-label">Contrat</span>
          <div className="t-chips">
            {CONTRATS.map((c) => (
              <button
                key={c.id}
                className="t-chip"
                data-on={contrat === c.id ? 1 : 0}
                onClick={() => setContrat(c.id)}
              >
                {c.nom}
                <small>×{c.mult}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Bouts du preneur</span>
          <div className="t-chips">
            {([0, 1, 2, 3] as const).map((b) => (
              <button
                key={b}
                className="t-chip"
                data-on={bouts === b ? 1 : 0}
                onClick={() => setBouts(b)}
              >
                {b}
                <small>{SEUILS[b]} pts</small>
              </button>
            ))}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Points de l'attaque</span>
          <div className="t-points">
            <button
              className="t-step"
              onClick={() => setPoints((p) => cadrer(p - 0.5))}
              aria-label="Retirer un demi-point"
            >
              −
            </button>
            <div className="t-points-val">
              <b>{points}</b>
              <span>sur 91</span>
            </div>
            <button
              className="t-step"
              onClick={() => setPoints((p) => cadrer(p + 0.5))}
              aria-label="Ajouter un demi-point"
            >
              +
            </button>
          </div>
          <input
            className="t-range"
            type="range"
            min="0"
            max="91"
            step="0.5"
            value={points}
            onChange={(e) => setPoints(parseFloat(e.target.value))}
          />
          <div className="t-goal" data-ok={res.reussi ? 1 : 0}>
            {res.reussi
              ? `Contrat réussi de ${res.ecart} pt${res.ecart > 1 ? "s" : ""}`
              : `Chute de ${res.ecart} pt${res.ecart > 1 ? "s" : ""} — il fallait ${seuil}`}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Petit au bout</span>
          <div className="t-chips">
            {[
              { id: "aucun", nom: "Aucun" },
              { id: "attaque", nom: "Attaque" },
              { id: "defense", nom: "Défense" },
            ].map((o) => (
              <button
                key={o.id}
                className="t-chip"
                data-on={petitAuBout === o.id ? 1 : 0}
                onClick={() => setPetitAuBout(o.id as PetitAuBout)}
              >
                {o.nom}
              </button>
            ))}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Poignée</span>
          <div className="t-chips">
            {POIGNEES.map((p) => (
              <button
                key={p.id}
                className="t-chip"
                data-on={poignee === p.id ? 1 : 0}
                onClick={() => setPoignee(p.id)}
              >
                {p.nom}
                {p.val > 0 && <small>+{p.val}</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">Chelem</span>
          <div className="t-chips">
            {CHELEMS.map((c) => (
              <button
                key={c.id}
                className="t-chip"
                data-on={chelem === c.id ? 1 : 0}
                onClick={() => setChelem(c.id)}
              >
                {c.nom}
                {c.val !== 0 && <small>{c.val > 0 ? `+${c.val}` : c.val}</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="t-field">
          <span className="t-label">
            Misère
            <em>{miseres.length > 0 ? `${miseres.length} déclarée${miseres.length > 1 ? "s" : ""}` : ""}</em>
          </span>
          {miseres.map((m, idx) => (
            <div key={m.id} className="t-misere-entree">
              <div className="t-chips">
                {table.map((i) => (
                  <button
                    key={i}
                    className="t-chip"
                    data-on={m.joueur === i ? 1 : 0}
                    onClick={() => majMisere(idx, { joueur: i })}
                  >
                    {joueurs[i]}
                  </button>
                ))}
              </div>
              <div className="t-chips" style={{ marginTop: 7 }}>
                {(
                  [
                    { id: "atout", nom: "Pas d'atout" },
                    { id: "tete", nom: "Pas de tête" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    className="t-chip"
                    data-on={m.type === o.id ? 1 : 0}
                    onClick={() => majMisere(idx, { type: o.id })}
                  >
                    {o.nom}
                  </button>
                ))}
                <button
                  className="t-chip"
                  data-on={m.aTort ? 1 : 0}
                  onClick={() => majMisere(idx, { aTort: !m.aTort })}
                >
                  Annoncée à tort
                </button>
              </div>
              <button className="t-misere-retirer" onClick={() => retirerMisere(idx)}>
                Retirer
              </button>
            </div>
          ))}
          <button className="t-misere-ajouter" onClick={ajouterMisere}>
            + Ajouter une misère
          </button>
        </div>

        <div className="t-preview">
          {complete ? (
            <>
              <div className="t-preview-line">
                <span>{joueurs[preneur]}</span>
                <b>
                  {(res.scores[preneur] as number) > 0 ? "+" : ""}
                  {res.scores[preneur]}
                </b>
              </div>
              {res.avecAppele && (
                <div className="t-preview-line">
                  <span>{joueurs[appele as number]} (appelé)</span>
                  <b>
                    {(res.scores[appele as number] as number) > 0 ? "+" : ""}
                    {res.scores[appele as number]}
                  </b>
                </div>
              )}
              <div className="t-preview-line">
                <span>Chaque défenseur</span>
                <b>
                  {(res.scores[res.defenseurs[0]] as number) > 0 ? "+" : ""}
                  {res.scores[res.defenseurs[0]]}
                </b>
              </div>
            </>
          ) : (
            <div className="t-preview-line">
              <span>Choisissez {parDonne} joueurs pour cette donne</span>
              <b>
                {table.length} / {parDonne}
              </b>
            </div>
          )}
          <button className="t-cta" disabled={!complete} onClick={() => onValider(donne)}>
            Inscrire la donne
          </button>
        </div>
      </div>
    </div>
  );
}
