import { useState } from "react";
import { ROMAINS, melangerAtouts, nomAtout } from "../regles.js";
import { CSS } from "../styles.js";

export default function Tirage({ joueurs, onValider, onRetour }) {
  const [paquet, setPaquet] = useState(melangerAtouts);
  const [tires, setTires] = useState([]);
  const [excuse, setExcuse] = useState(null);
  const [manuel, setManuel] = useState(false);
  const [choix, setChoix] = useState(0);

  const suivant = tires.length;
  const fini = suivant >= joueurs.length;
  const plusFaible = fini
    ? tires.reduce((a, b) => (b.carte < a.carte ? b : a)).joueur
    : null;
  const entame = fini ? (plusFaible + 1) % joueurs.length : null;

  const tirer = () => {
    const reste = [...paquet];
    const carte = reste.shift();
    setPaquet(reste);
    if (carte === "excuse") {
      setExcuse(joueurs[suivant]);
      return;
    }
    setExcuse(null);
    setTires([...tires, { joueur: suivant, carte }]);
  };

  const recommencer = () => {
    setPaquet(melangerAtouts());
    setTires([]);
    setExcuse(null);
  };

  return (
    <div className="tarot">
      <style>{CSS}</style>
      <div className="t-head">
        <div>
          <div className="t-eyebrow">Avant la première donne</div>
          <h1 className="t-title">Qui distribue ?</h1>
        </div>
        <button className="t-ghost" onClick={onRetour}>
          Retour
        </button>
      </div>

      <div className="t-tirage">
        {manuel ? (
          <>
            <p className="t-intro">Désignez le donneur de la première donne.</p>
            <div className="t-chips">
              {joueurs.map((j, i) => (
                <button
                  key={i}
                  className="t-chip"
                  data-on={choix === i ? 1 : 0}
                  onClick={() => setChoix(i)}
                >
                  {j}
                </button>
              ))}
            </div>
            <div className="t-resultat">
              <p>
                {joueurs[choix]} distribue, {joueurs[(choix + 1) % joueurs.length]} entame.
              </p>
            </div>
            <button className="t-lien" onClick={() => setManuel(false)}>
              Revenir au tirage
            </button>
          </>
        ) : (
          <>
            <p className="t-intro">
              Chacun retourne un atout. La carte la plus faible distribue la première donne, et
              son voisin de droite entame. L'Excuse ne compte pas : on tire à nouveau.
            </p>

            {tires.map((t) => (
              <div key={t.joueur} className="t-carte" data-min={plusFaible === t.joueur ? 1 : 0}>
                <span className="t-carte-nom">{joueurs[t.joueur]}</span>
                <span className="t-carte-val">
                  {ROMAINS[t.carte]}
                  <small>{nomAtout(t.carte)}</small>
                </span>
              </div>
            ))}

            {excuse && <p className="t-excuse">{excuse} tire l'Excuse — carte blanche, on retire.</p>}

            {fini && (
              <div className="t-resultat">
                <p>
                  {joueurs[plusFaible]} distribue, {joueurs[entame]} entame.
                </p>
                <span>
                  Le donneur avance ensuite d'une place à chaque donne, dans l'ordre de la table.
                </span>
              </div>
            )}

            <button className="t-lien" onClick={fini ? recommencer : () => setManuel(true)}>
              {fini ? "Refaire le tirage" : "Désigner à la main"}
            </button>
          </>
        )}
      </div>

      <div className="t-bar">
        {manuel ? (
          <button className="t-cta" onClick={() => onValider(choix)}>
            Ouvrir la feuille
          </button>
        ) : fini ? (
          <button className="t-cta" onClick={() => onValider(plusFaible)}>
            Ouvrir la feuille
          </button>
        ) : (
          <button className="t-cta" onClick={tirer}>
            Tirer pour {joueurs[suivant]}
          </button>
        )}
      </div>
    </div>
  );
}

