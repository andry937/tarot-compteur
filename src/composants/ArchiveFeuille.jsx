import { useState } from "react";
import { CONTRATS, calculer, resumerDonnees, fmt } from "../regles.js";
import { resoudreNom } from "../identite.js";

export default function ArchiveFeuille({ record, roster }) {
  const joueursId = record.joueursId || [];
  const joueurs = joueursId.length
    ? joueursId.map((id, i) => resoudreNom(id, roster || [], (record.joueursNomFige || [])[i]))
    : record.joueurs || []; // compat éventuelle d'anciens formats
  const nbTotal = joueurs.length;
  const donnes = record.donnes || [];
  const annulations = record.annulations || [];
  const [ouverte, setOuverte] = useState(null);
  const [cumule, setCumule] = useState(true);

  const { totaux, jouees, cumuls } = resumerDonnees(donnes, nbTotal);
  const classement = joueurs
    .map((nom, i) => ({ nom, i, pts: totaux[i], n: jouees[i] }))
    .sort((a, b) => b.pts - a.pts);
  const d0 = ouverte !== null ? donnes[ouverte] : null;
  const detail = d0 ? calculer(d0, nbTotal) : null;

  return (
    <>
      <div className="t-sheet">
        <div className="t-sheet-top">
          <span className="t-sheet-label">Marque</span>
          <div className="t-toggle">
            <button data-on={!cumule ? 1 : 0} onClick={() => setCumule(false)}>
              Par donne
            </button>
            <button data-on={cumule ? 1 : 0} onClick={() => setCumule(true)}>
              Cumulé
            </button>
          </div>
        </div>

        <div className="t-scroll">
          <table className="t-grid">
            <thead>
              <tr className="t-headrow">
                <th></th>
                {joueurs.map((j, i) => (
                  <th key={i}>
                    <div className="t-name">{j}</div>
                    <div className="t-total" data-neg={totaux[i] < 0 ? 1 : 0}>
                      {totaux[i]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donnes.map((d, r) => {
                const res = calculer(d, nbTotal);
                return (
                  <tr
                    key={r}
                    className="t-row"
                    data-open={ouverte === r ? 1 : 0}
                    onClick={() => setOuverte(ouverte === r ? null : r)}
                  >
                    <td className="t-num">{r + 1}</td>
                    {joueurs.map((_, i) => {
                      const joue = res.scores[i] !== null;
                      return (
                        <td
                          key={i}
                          className="t-cell"
                          data-repos={joue ? 0 : 1}
                          data-neg={joue && (cumule ? cumuls[r][i] : res.scores[i]) < 0 ? 1 : 0}
                          data-preneur={d.preneur === i ? 1 : 0}
                        >
                          {cumule ? cumuls[r][i] : joue ? fmt(res.scores[i]) : "·"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="t-detail">
            <div className="t-detail-line">
              Donne {ouverte + 1} — {joueurs[d0.preneur]} ·{" "}
              {CONTRATS.find((c) => c.id === d0.contrat).nom} · {d0.bouts} bout
              {d0.bouts > 1 ? "s" : ""} · {d0.points} pts
              {detail.avecAppele ? ` · appelé ${joueurs[d0.appele]}` : ""}
            </div>
            <div className="t-detail-line">
              {detail.reussi ? "Contrat réussi de" : "Chute de"} {detail.ecart} pt
              {detail.ecart > 1 ? "s" : ""} (seuil {detail.seuil})
              {d0.petitAuBout !== "aucun" ? ` · petit au bout ${d0.petitAuBout}` : ""}
              {d0.poignee !== "aucune" ? ` · poignée ${d0.poignee}` : ""}
              {d0.chelem !== "aucun" ? " · chelem" : ""}
            </div>
            <div className="t-detail-line">
              À la table : {detail.table.map((i) => joueurs[i]).join(", ")}
              {d0.donneur !== undefined && d0.donneur !== null
                ? ` · ${joueurs[d0.donneur]} distribuait`
                : ""}
            </div>
            {d0.miseres && d0.miseres.length > 0 && (
              <div className="t-detail-line">
                {d0.miseres
                  .map(
                    (m) =>
                      `Misère de ${m.type === "atout" ? "atout" : "tête"} — ${joueurs[m.joueur]}${
                        m.aTort ? " (annoncée à tort)" : ""
                      }`
                  )
                  .join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="t-classement">
        <div className="t-eyebrow" style={{ marginBottom: 6 }}>
          Classement final
        </div>
        {classement.map((c, r) => (
          <div className="t-cl-row" key={c.i}>
            <span className="t-cl-rang">{r + 1}</span>
            <span className="t-cl-nom">{c.nom}</span>
            <span className="t-cl-donnes">{c.n} donnes</span>
            <span className="t-cl-pts" data-neg={c.pts < 0 ? 1 : 0}>
              {c.pts}
            </span>
          </div>
        ))}
      </div>

      {annulations.length > 0 && (
        <div className="t-journal">
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>
            Redistributions
          </div>
          {annulations.map((a) => (
            <div className="t-journal-line" key={a.id}>
              Avant la donne {a.avantDonne + 1} — Petit sec de {joueurs[a.joueur]}, redonne.
            </div>
          ))}
        </div>
      )}
    </>
  );
}

