import { useState } from "react";
import { Link } from "react-router-dom";
import { CONTRATS, calculer, tableDeLaDonne, fmt } from "../regles.js";
import { CSS } from "../styles.js";
import Saisie from "./Saisie.jsx";

export default function Feuille({
  joueurs,
  nbTotal,
  parDonne,
  depart,
  donnes,
  annulations,
  totaux,
  jouees,
  cumuls,
  onAjouterDonne,
  onEffacerDonne,
  onAjouterAnnulation,
  onNouvellePartie,
}) {
  const [cumule, setCumule] = useState(true);
  const [ouverte, setOuverte] = useState(null);
  const [saisie, setSaisie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [petitSecOuvert, setPetitSecOuvert] = useState(false);
  const [joueurPetitSec, setJoueurPetitSec] = useState(null);

  const rotation = nbTotal > parDonne;
  const prochaine = tableDeLaDonne(donnes.length, nbTotal, parDonne, depart);
  const auRepos = joueurs.map((_, i) => i).filter((i) => !prochaine.includes(i));

  const surNouvellePartie = () => {
    if (!confirmer) {
      setConfirmer(true);
      setTimeout(() => setConfirmer(false), 4000);
      return;
    }
    setConfirmer(false);
    onNouvellePartie();
  };

  const classement = joueurs
    .map((nom, i) => ({ nom, i, pts: totaux[i], n: jouees[i] }))
    .sort((a, b) => b.pts - a.pts);
  const d0 = ouverte !== null ? donnes[ouverte] : null;
  const detail = d0 ? calculer(d0, nbTotal) : null;

  return (
    <div className="tarot">
      <style>{CSS}</style>

      <div className="t-head">
        <div>
          <div className="t-eyebrow">
            {nbTotal} à table · {parDonne} par donne · {donnes.length} jouée
            {donnes.length > 1 ? "s" : ""}
          </div>
          <h1 className="t-title">Feuille de marque</h1>
        </div>
        <div className="t-head-actions">
          <Link className="t-ghost" to="/historique">
            Historique
          </Link>
          <button className="t-ghost" onClick={surNouvellePartie}>
            {confirmer ? "Confirmer ?" : "Nouvelle"}
          </button>
        </div>
      </div>

      <dl className="t-tour">
        <dt>Donne {donnes.length + 1}</dt>
        <dd>
          <b>{joueurs[prochaine[0]]}</b> distribue · <b>{joueurs[prochaine[1]]}</b> entame
        </dd>
        <dd className="repos">À la table : {prochaine.map((i) => joueurs[i]).join(", ")}</dd>
        {auRepos.length > 0 && (
          <dd className="repos">Au repos : {auRepos.map((i) => joueurs[i]).join(", ")}</dd>
        )}
      </dl>

      <div className="t-petitsec">
        {!petitSecOuvert ? (
          <button className="t-lien" onClick={() => setPetitSecOuvert(true)}>
            Petit sec ? Annuler la donne
          </button>
        ) : (
          <div className="t-petitsec-panel">
            <span className="t-label">Qui a le Petit sec ?</span>
            <p className="t-petitsec-note">
              Seul atout en main : Le Petit, sans l'Excuse. La donne est annulée et redonnée
              par {joueurs[prochaine[0]]}.
            </p>
            <div className="t-chips">
              {prochaine.map((i) => (
                <button
                  key={i}
                  className="t-chip"
                  data-on={joueurPetitSec === i ? 1 : 0}
                  onClick={() => setJoueurPetitSec(i)}
                >
                  {joueurs[i]}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="t-lien"
                style={{ margin: 0 }}
                onClick={() => {
                  setPetitSecOuvert(false);
                  setJoueurPetitSec(null);
                }}
              >
                Annuler
              </button>
              <button
                className="t-cta"
                style={{ flex: 1, padding: "11px" }}
                disabled={joueurPetitSec === null}
                onClick={() => {
                  onAjouterAnnulation({
                    id: `${Date.now()}`,
                    avantDonne: donnes.length,
                    table: prochaine,
                    donneur: prochaine[0],
                    joueur: joueurPetitSec,
                    date: new Date().toISOString(),
                  });
                  setPetitSecOuvert(false);
                  setJoueurPetitSec(null);
                }}
              >
                Confirmer la redistribution
              </button>
            </div>
          </div>
        )}
      </div>

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
              {donnes.length === 0 && (
                <tr>
                  <td colSpan={nbTotal + 1}>
                    <div className="t-empty">
                      <p>La feuille est vierge.</p>
                      <span>Notez la première donne pour lancer la partie</span>
                    </div>
                  </td>
                </tr>
              )}
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
            <button
              className="t-del"
              onClick={() => {
                onEffacerDonne(ouverte);
                setOuverte(null);
              }}
            >
              Effacer cette donne
            </button>
          </div>
        )}
      </div>

      {rotation && donnes.length > 0 && (
        <div className="t-classement">
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>
            Classement
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
      )}

      {annulations.length > 0 && (
        <div className="t-journal">
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>
            Redistributions
          </div>
          {annulations
            .slice()
            .reverse()
            .map((a) => (
              <div className="t-journal-line" key={a.id}>
                Avant la donne {a.avantDonne + 1} — Petit sec de {joueurs[a.joueur]}, redonne.
              </div>
            ))}
        </div>
      )}

      <details className="t-rules">
        <summary>Comment les points sont comptés</summary>
        <p>
          Le preneur doit réunir <code>56 / 51 / 41 / 36</code> points selon qu'il possède 0, 1, 2
          ou 3 bouts. Le score d'une donne vaut <code>(25 + écart) × contrat</code>, auquel
          s'ajoutent le petit au bout (10 × contrat, pour le camp qui le réalise), la poignée
          (20 / 30 / 40, pour le camp gagnant) et le chelem (200 non annoncé, 400 annoncé, −200
          s'il chute). Le preneur gagne ou perd ce score autant de fois qu'il y a de défenseurs ; à
          cinq, l'appelé en prend une part et le preneur deux.
        </p>
        <p>
          <strong style={{ color: "var(--craie)" }}>Petit sec</strong> — si le seul atout d'un
          joueur est Le Petit, sans l'Excuse, il doit l'annoncer avant les enchères : la donne est
          annulée et redonnée par le même donneur, sans effet sur le score.
        </p>
        <p>
          <strong style={{ color: "var(--craie)" }}>Misère</strong> — un joueur sans aucun atout
          (misère d'atout) ou sans aucun honneur (misère de tête) peut l'annoncer une fois le
          chien incorporé, avant la première carte. Chaque autre joueur à table lui paie alors 10
          points, même dans son propre camp — annoncée à tort, c'est l'inverse. L'Excuse annule
          toute misère.
          {rotation &&
            ` Les joueurs au repos marquent 0 : la table tourne d'un cran à chaque donne, donc au bout de ${nbTotal} donnes chacun aura joué ${parDonne} fois.`}
        </p>
      </details>

      <div className="t-bar">
        <button className="t-cta" onClick={() => setSaisie(true)}>
          Noter la donne {donnes.length + 1}
        </button>
      </div>

      {saisie && (
        <Saisie
          joueurs={joueurs}
          parDonne={parDonne}
          tableProposee={prochaine}
          total={nbTotal}
          numero={donnes.length + 1}
          onFermer={() => setSaisie(false)}
          onValider={(d) => {
            onAjouterDonne(d);
            setSaisie(false);
          }}
        />
      )}
    </div>
  );
}
