/**
 * Saisie des cartes jouées, dans l'ordre de jeu.
 * @module
 */

import { useState, type ReactNode } from "react";
import { useConfirmation } from "@/hooks/useConfirmation";
import { COULEURS, SYMBOLE_COULEUR, EXCUSE, idAtout, idCouleur, libelleCourt, libelleCarte, estBout, nbPlis, deriverPlis, tailleChien } from "@/domain/cartes/cartes";
import { NOM_ROI } from "@/domain/score/regles";
import { Page, Header, GhostButton, Section, Label, Chip } from "@/components/ui";
import JournalPlis from "./JournalPlis";

interface CartesJoueesProps {
  joueurs: string[];
  /** Sièges à table pour la donne en cours, dans l'ordre de jeu (donneur en premier). */
  table: number[];
  numero: number;
  /** Siège qui entame le premier pli (par défaut le joueur après le donneur, `table[1]`). */
  entame?: number;
  cartes: string[];
  /** Boutons d'en-tête (retour à la feuille, ou Annuler/Enregistrer dans l'éditeur d'une donne inscrite). */
  actions: ReactNode;
  onModifier: (cartes: string[]) => void;
  chien: string[];
  onModifierChien: (chien: string[]) => void;
}

/** Aide-mémoire : on note les cartes dans l'ordre de jeu, l'app déduit qui les a posées et qui remporte chaque pli. */
export default function CartesJouees({ joueurs, table, numero, entame: entameImposee, cartes, actions, onModifier, chien, onModifierChien }: CartesJoueesProps) {
  const [modeChien, setModeChien] = useState(false);
  const tailleDuChien = tailleChien(table.length);
  const auChien = new Set(chien);
  const entame = entameImposee ?? (table.length > 1 ? table[1] : table[0]);
  const { prochainJoueur, termine, plis } = deriverPlis(table, entame, cartes);
  const jouees = new Set(cartes);
  const atoutsRestants = 22 - cartes.filter((c) => c.startsWith("atout-") || c === EXCUSE).length;
  const pliCourant = Math.min(plis.length || 1, nbPlis(table.length));

  const poser = (id: string) => {
    if (modeChien) {
      // Retourner / retirer une carte du chien (jusqu'à sa taille réglementaire).
      if (auChien.has(id)) onModifierChien(chien.filter((c) => c !== id));
      else if (chien.length < tailleDuChien) onModifierChien([...chien, id]);
      return;
    }
    if (termine || jouees.has(id)) return;
    onModifier([...cartes, id]);
  };

  const { enAttente: confirmerEffacer, declencher: surEffacer } = useConfirmation(() => onModifier([]));

  const touche = (id: string) => {
    const tombee = jouees.has(id);
    return (
      <button
        key={id}
        type="button"
        data-testid="carte"
        data-carte={id}
        aria-label={libelleCarte(id)}
        disabled={modeChien ? !auChien.has(id) && chien.length >= tailleDuChien : tombee || termine}
        data-chien={auChien.has(id) ? "oui" : undefined}
        onClick={() => poser(id)}
        className={`rounded-md border px-1 py-2 text-center font-mono text-[12px] transition ${
          modeChien && auChien.has(id)
            ? "border-sky-400 bg-sky-950 font-semibold text-sky-300"
            : tombee
            ? "border-slate-800 bg-slate-950 text-slate-700 line-through"
            : auChien.has(id)
              ? "border-sky-500/60 bg-slate-900 text-sky-300 hover:bg-slate-800"
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
        actions={actions}
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

      <div className="mb-3 flex gap-2" role="group" aria-label="Que noter ?">
        <Chip on={!modeChien} onClick={() => setModeChien(false)}>
          Plis
        </Chip>
        <Chip on={modeChien} onClick={() => setModeChien(true)}>
          Chien ({chien.length}/{tailleDuChien})
        </Chip>
      </div>
      {modeChien && (
        <p className="mb-3 text-xs leading-relaxed text-slate-400" data-testid="aide-chien">
          Touchez les {tailleDuChien} cartes retournées au chien (Petite ou Garde). Elles restent jouables : le
          preneur peut les garder en main.
        </p>
      )}

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

      {chien.length > 0 && (
        <Section title="Chien">
          <p className="text-[12.5px] text-slate-300" data-testid="chien-vu">
            {chien.map(libelleCarte).join(" · ")}
          </p>
        </Section>
      )}

      {plis.length > 0 && (
        <Section title="Plis joués">
          <Label>Dans l'ordre de jeu</Label>
          <JournalPlis joueurs={joueurs} table={table} entame={entame} cartes={cartes} />
        </Section>
      )}
    </Page>
  );
}
