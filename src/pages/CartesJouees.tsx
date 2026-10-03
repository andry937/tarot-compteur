import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COULEURS, SYMBOLE_COULEUR, EXCUSE, idAtout, idCouleur, libelleCourt, libelleCarte, estBout, nbPlis, deriverPlis } from "../utils/cartes";
import { NOM_ROI } from "../utils/regles";
import { Page, Header, GhostButton, Section, Label } from "../components/ui";
import JournalPlis from "../components/JournalPlis";

interface CartesJoueesProps {
  joueurs: string[];
  /** Sièges à table pour la donne en cours, dans l'ordre de jeu (donneur en premier). */
  table: number[];
  numero: number;
  cartes: string[];
  idTable: string;
  onModifier: (cartes: string[]) => void;
}

/** Aide-mémoire : on note les cartes dans l'ordre de jeu, l'app déduit qui les a posées et qui remporte chaque pli. */
export default function CartesJouees({ joueurs, table, numero, cartes, idTable, onModifier }: CartesJoueesProps) {
  const navigate = useNavigate();
  const [confirmerEffacer, setConfirmerEffacer] = useState(false);
  const entame = table.length > 1 ? table[1] : table[0];
  const { prochainJoueur, termine, plis } = deriverPlis(table, entame, cartes);
  const jouees = new Set(cartes);
  const atoutsRestants = 22 - cartes.filter((c) => c.startsWith("atout-") || c === EXCUSE).length;
  const pliCourant = Math.min(plis.length || 1, nbPlis(table.length));

  const poser = (id: string) => {
    if (termine || jouees.has(id)) return;
    onModifier([...cartes, id]);
  };

  const surEffacer = () => {
    if (!confirmerEffacer) {
      setConfirmerEffacer(true);
      setTimeout(() => setConfirmerEffacer(false), 4000);
      return;
    }
    setConfirmerEffacer(false);
    onModifier([]);
  };

  const touche = (id: string) => {
    const tombee = jouees.has(id);
    return (
      <button
        key={id}
        type="button"
        data-testid="carte"
        data-carte={id}
        aria-label={libelleCarte(id)}
        disabled={tombee || termine}
        onClick={() => poser(id)}
        className={`rounded-md border px-1 py-2 text-center font-mono text-[12px] transition ${
          tombee
            ? "border-slate-800 bg-slate-950 text-slate-700 line-through"
            : estBout(id)
              ? "border-amber-400/70 bg-slate-900 font-semibold text-amber-400 hover:bg-slate-800"
              : "border-slate-700 bg-slate-900/60 text-slate-100 hover:border-slate-500"
        }`}
      >
        {libelleCourt(id)}
      </button>
    );
  };

  return (
    <Page>
      <Header
        eyebrow={`Donne ${numero} · ${cartes.length} carte${cartes.length > 1 ? "s" : ""} notée${cartes.length > 1 ? "s" : ""}`}
        title="Cartes jouées"
        actions={<GhostButton onClick={() => navigate(`/partie/${idTable}`)}>Feuille</GhostButton>}
      />

      <dl className="mb-4 rounded-xl border border-slate-800 border-l-2 border-l-amber-400 bg-black/20 px-3.5 py-3">
        <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-400">
          {termine ? "Main terminée" : `Pli ${pliCourant}/${nbPlis(table.length)}`}
        </dt>
        <dd className="mt-1 text-sm leading-snug" data-testid="a-qui-de-jouer">
          {termine ? (
            "Toutes les cartes sont tombées."
          ) : (
            <>
              C'est à <b className="font-semibold text-slate-100">{joueurs[prochainJoueur as number]}</b> de jouer
            </>
          )}
        </dd>
        <dd className="mt-1.5 text-xs text-slate-400">
          Atouts restants (Excuse comprise) : <b className="font-mono text-amber-400" data-testid="atouts-restants">{atoutsRestants}</b>/22
        </dd>
      </dl>

      <Section title="Atouts">
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 21 }, (_, i) => touche(idAtout(i + 1)))}
          {touche(EXCUSE)}
        </div>
      </Section>
      {COULEURS.map((c) => (
        <Section key={c} title={`${NOM_ROI[c]} ${SYMBOLE_COULEUR[c]}`}>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 14 }, (_, i) => touche(idCouleur(c, i + 1)))}
          </div>
        </Section>
      ))}

      <div className="mt-4 flex gap-2">
        <GhostButton disabled={cartes.length === 0} onClick={() => onModifier(cartes.slice(0, -1))}>
          Annuler la dernière carte
        </GhostButton>
        <GhostButton disabled={cartes.length === 0} onClick={surEffacer}>
          {confirmerEffacer ? "Confirmer ?" : "Tout effacer"}
        </GhostButton>
      </div>

      {plis.length > 0 && (
        <Section title="Plis joués">
          <Label>Dans l'ordre de jeu</Label>
          <JournalPlis joueurs={joueurs} table={table} entame={entame} cartes={cartes} />
        </Section>
      )}
    </Page>
  );
}
