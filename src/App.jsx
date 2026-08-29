import { useState, useEffect, useMemo } from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { CONTRATS, calculer, resumerDonnees, tableDeLaDonne, fmt } from "./regles.js";
import { normaliser, resoudreNom, resoudreOuCreerFiches } from "./identite.js";
import { CLE_PARTIE, CLE_ROSTER, CLE_HISTORIQUE, cleArchive } from "./stockage.js";
import { CSS } from "./styles.js";
import Saisie from "./composants/Saisie.jsx";
import Tirage from "./composants/Tirage.jsx";
import Historique from "./composants/Historique.jsx";
import Configuration from "./composants/Configuration.jsx";

const nomsParDefaut = (n) =>
  Array.from({ length: n }, (_, i) => (i === 0 ? "Andry" : ""));

export default function App() {
  const navigate = useNavigate();
  const [pret, setPret] = useState(false);
  const [partie, setPartie] = useState(null);
  const [tirage, setTirage] = useState(null);
  const [donnes, setDonnes] = useState([]);
  const [cumule, setCumule] = useState(true);
  const [ouverte, setOuverte] = useState(null);
  const [saisie, setSaisie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [nbSetup, setNbSetup] = useState(5);
  const [parDonneSetup, setParDonneSetup] = useState(5);
  const [nomsSetup, setNomsSetup] = useState(nomsParDefaut(5));
  const [roster, setRoster] = useState([]);
  const [focusIndex, setFocusIndex] = useState(null);
  const [historiqueIndex, setHistoriqueIndex] = useState([]);
  const [annulations, setAnnulations] = useState([]);
  const [petitSecOuvert, setPetitSecOuvert] = useState(false);
  const [joueurPetitSec, setJoueurPetitSec] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(CLE_PARTIE);
        const p = JSON.parse(r.value);
        if (p?.joueursId?.length) {
          setPartie({
            joueursId: p.joueursId,
            joueursNomFige: p.joueursNomFige || p.joueursId.map(() => "?"),
            parDonne: p.parDonne || p.joueursId.length,
            depart: p.depart || 0,
          });
          setDonnes(p.donnes || []);
          setAnnulations(p.annulations || []);
        }
      } catch (e) {
        /* première ouverture : rien d'enregistré */
      }
      try {
        const rj = await window.storage.get(CLE_ROSTER);
        setRoster(JSON.parse(rj.value));
      } catch (e) {
        /* pas encore de trombinoscope */
      }
      try {
        const rh = await window.storage.get(CLE_HISTORIQUE);
        setHistoriqueIndex(JSON.parse(rh.value));
      } catch (e) {
        /* pas encore d'historique */
      }
      setPret(true);
    })();
  }, []);

  useEffect(() => {
    if (!pret || !partie) return;
    (async () => {
      try {
        await window.storage.set(CLE_PARTIE, JSON.stringify({ ...partie, donnes, annulations }));
      } catch (e) {
        console.error("Sauvegarde impossible", e);
      }
    })();
  }, [partie, donnes, annulations, pret]);

  const joueurs = partie
    ? partie.joueursId.map((id, i) => resoudreNom(id, roster, partie.joueursNomFige[i]))
    : [];
  const nbTotal = joueurs.length;

  const { totaux, jouees, cumuls } = useMemo(
    () => resumerDonnees(donnes, nbTotal),
    [donnes, nbTotal]
  );

  const persisterRoster = async (suivant) => {
    setRoster(suivant);
    try {
      await window.storage.set(CLE_ROSTER, JSON.stringify(suivant));
    } catch (e) {
      console.error("Sauvegarde du trombinoscope impossible", e);
    }
  };

  /** Rapproche ou crée les fiches pour ces noms, persiste le registre, renvoie les identifiants. */
  const majRoster = async (noms) => {
    const { ids, roster: suivant } = resoudreOuCreerFiches(noms, roster);
    await persisterRoster(suivant);
    return ids;
  };

  if (!pret)
    return (
      <div className="tarot">
        <style>{CSS}</style>
      </div>
    );

  const ecranTirage = () => (
    <Tirage
      joueurs={tirage.joueurs}
      onRetour={() => {
        setTirage(null);
        navigate("/");
      }}
      onValider={(depart) => {
        setPartie({
          joueursId: tirage.joueursId,
          joueursNomFige: tirage.joueurs,
          parDonne: tirage.parDonne,
          depart,
        });
        setDonnes([]);
        setAnnulations([]);
        setTirage(null);
        navigate("/partie");
      }}
    />
  );

  /* ---------- Composition de la table ---------- */
  const ecranSetup = () => {
    const majNb = (delta) => {
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
                      onBlur={() =>
                        setTimeout(() => setFocusIndex((f) => (f === i ? null : f)), 120)
                      }
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
                onClick={async () => {
                  const ids = await majRoster(nomsTrim);
                  setTirage({ joueurs: nomsTrim, joueursId: ids, parDonne: parDonneSetup });
                  navigate("/tirage");
                }}
              >
                {libelle}
              </button>
            );
          })()}
        </div>
      </div>
    );
  };

  /* ---------- Feuille ---------- */
  const ecranFeuille = () => {
    const parDonne = partie.parDonne;
  const rotation = nbTotal > parDonne;
  const prochaine = tableDeLaDonne(donnes.length, nbTotal, parDonne, partie.depart || 0);
  const auRepos = joueurs.map((_, i) => i).filter((i) => !prochaine.includes(i));

  const nouvellePartie = async () => {
    if (!confirmer) {
      setConfirmer(true);
      setTimeout(() => setConfirmer(false), 4000);
      return;
    }
    if (donnes.length > 0) {
      const id = `${Date.now()}`;
      const resume = {
        id,
        date: new Date().toISOString(),
        joueurs,
        joueursId: partie.joueursId,
        parDonne,
        nbDonnes: donnes.length,
        totaux,
      };
      try {
        await window.storage.set(
          cleArchive(id),
          JSON.stringify({ ...partie, donnes, annulations })
        );
        const suivant = [resume, ...historiqueIndex];
        await window.storage.set(CLE_HISTORIQUE, JSON.stringify(suivant));
        setHistoriqueIndex(suivant);
      } catch (e) {
        console.error("Archivage impossible", e);
      }
    }
    try {
      await window.storage.delete(CLE_PARTIE);
    } catch (e) {
      /* rien à supprimer */
    }
    setPartie(null);
    setDonnes([]);
    setAnnulations([]);
    setOuverte(null);
    setConfirmer(false);
    navigate("/");
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
          <button className="t-ghost" onClick={nouvellePartie}>
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
                  setAnnulations((a) => [
                    ...a,
                    {
                      id: `${Date.now()}`,
                      avantDonne: donnes.length,
                      table: prochaine,
                      donneur: prochaine[0],
                      joueur: joueurPetitSec,
                      date: new Date().toISOString(),
                    },
                  ]);
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
                setDonnes((ds) => ds.filter((_, k) => k !== ouverte));
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
            setDonnes((ds) => [...ds, d]);
            setSaisie(false);
          }}
        />
      )}
    </div>
  );
  };

  return (
    <Routes>
      <Route
        path="/joueurs"
        element={
          <Configuration
            roster={roster}
            historiqueIndex={historiqueIndex}
            onFermer={() => navigate("/")}
            onRoster={persisterRoster}
          />
        }
      />
      <Route
        path="/historique"
        element={<Historique index={historiqueIndex} roster={roster} onRetour={() => navigate("/")} />}
      />
      <Route
        path="/historique/:id"
        element={<Historique index={historiqueIndex} roster={roster} onRetour={() => navigate("/")} />}
      />
      <Route
        path="/tirage"
        element={tirage && !partie ? ecranTirage() : <Navigate to={partie ? "/partie" : "/"} replace />}
      />
      <Route path="/partie" element={partie ? ecranFeuille() : <Navigate to="/" replace />} />
      <Route path="/" element={partie ? <Navigate to="/partie" replace /> : ecranSetup()} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

