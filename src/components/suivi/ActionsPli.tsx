import { useState } from "react";
import { carteDejaJouee } from "@/vision/domain/corrections";
import type { EtatSuivi } from "@/vision/domain/machinePli";
import { libelleCarte } from "@/domain/cartes/cartes";
import SelecteurCarte from "./SelecteurCarte";
import { Bouton, Section, classeSelect } from "@/vision/ui";

interface Props {
  etat: EtatSuivi;
  noms: string[];
  onAnnulerPli: () => boolean;
  onCorrigerIdentite: (numero: number, rang: number, carte: string) => boolean;
  onAjouterCarte: (joueur: number, carte: string) => boolean;
}

const nom = (noms: string[], j: number) => noms[j] || `Joueur ${j + 1}`;

type Ou = NonNullable<ReturnType<typeof carteDejaJouee>>;

const lieu = (ou: Ou): string =>
  ou === "en-cours" ? "dans le pli en cours"
  : ou === "chien" ? "dans le chien"
  : ou === "ecart" ? "dans l'écart"
  : `jouée au pli ${ou}`;

/** Explication d'un refus parce que la carte est déjà ailleurs dans la manche ; `null` si elle est libre. */
const explicationCarteDejaJouee = (etat: EtatSuivi, carte: string): string | null => {
  const ou = carteDejaJouee(etat, carte);
  return ou === null ? null : `${libelleCarte(carte)} est déjà ${lieu(ou)}.`;
};

/**
 * Corrections qui touchent aux cartes elles-mêmes : annuler un pli, changer la carte lue, ajouter une carte
 * que la caméra n'a pas vue. Un refus est expliqué à côté du bouton (carte déjà jouée, joueur déjà servi…).
 */
export default function ActionsPli({ etat, noms, onAnnulerPli, onCorrigerIdentite, onAjouterCarte }: Props) {
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [confirmerPli, setConfirmerPli] = useState(false);
  const [ajout, setAjout] = useState({ joueur: etat.config.table[0], carte: "atout-1" });
  const dernier = etat.plis[etat.plis.length - 1];
  const [corr, setCorr] = useState({ numero: dernier?.numero ?? 1, rang: 0, carte: "atout-1" });
  const table = etat.config.table;
  const plisCorrigeables = etat.plis.slice(-6);

  const annuler = () => {
    const ok = onAnnulerPli();
    setRetour({ ok, texte: ok ? `Pli ${dernier?.numero} annulé. Pour le rejouer, retirez ses cartes de la table puis reposez-les.` : "Rien à annuler." });
  };

  const ajouter = () => {
    const ok = onAjouterCarte(ajout.joueur, ajout.carte);
    if (ok) return setRetour({ ok: true, texte: `${libelleCarte(ajout.carte)} ajoutée pour ${nom(noms, ajout.joueur)}.` });
    const raison =
      explicationCarteDejaJouee(etat, ajout.carte) ?? (etat.phase === "termine" ? "La manche est terminée." : `${nom(noms, ajout.joueur)} a déjà une carte dans le pli en cours.`);
    setRetour({ ok: false, texte: `Carte non ajoutée : ${raison}` });
  };

  // Le pli et le rang affichés doivent toujours exister : un pli annulé ou sorti de la liste des 6 derniers
  // retombe sur le dernier pli, sinon le menu montrerait une valeur que l'état ne contient plus.
  const numero = plisCorrigeables.some((p) => p.numero === corr.numero) ? corr.numero : dernier?.numero ?? 1;
  const cartesDuPli = etat.plis.find((p) => p.numero === numero)?.poses.length ?? 0;
  const rang = corr.rang < cartesDuPli ? corr.rang : 0;

  const corriger = () => {
    const ok = onCorrigerIdentite(numero, rang, corr.carte);
    if (ok) return setRetour({ ok: true, texte: `Pli ${numero} : carte corrigée en ${libelleCarte(corr.carte)}.` });
    const raison =
      explicationCarteDejaJouee(etat, corr.carte) ??
      (cartesDuPli === 0 ? "ce pli n'existe plus." : "carte inconnue, ou identique à celle déjà lue.");
    setRetour({ ok: false, texte: `Correction refusée : ${raison}` });
  };

  return (
    <Section titre="Corriger les cartes">
      <div className="flex flex-wrap gap-2">
        <Bouton disabled={!dernier} data-testid="annuler-pli"
          onClick={() => (confirmerPli ? (setConfirmerPli(false), annuler()) : setConfirmerPli(true))} onBlur={() => setConfirmerPli(false)}>
          {confirmerPli ? `Confirmer : annuler le pli ${dernier?.numero}` : "Annuler le dernier pli"}
        </Bouton>
      </div>

      {etat.phase !== "termine" && (
        <div className="mt-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Carte oubliée par la caméra</h3>
          <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-[1fr_1.4fr_auto]">
            <select aria-label="Joueur de la carte oubliée" className={classeSelect} value={ajout.joueur} data-testid="ajout-joueur"
              onChange={(e) => setAjout({ ...ajout, joueur: Number(e.target.value) })}>
              {table.map((j) => <option key={j} value={j}>{nom(noms, j)}</option>)}
            </select>
            <SelecteurCarte etiquette="Carte oubliée" valeur={ajout.carte} testId="ajout-carte" onChange={(carte) => setAjout({ ...ajout, carte })} />
            <Bouton variante="plein" data-testid="ajouter-carte" onClick={ajouter}>Ajouter</Bouton>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Elle est placée en dernier dans le pli en cours : le pli se termine dès qu'il est complet.</p>
        </div>
      )}

      {plisCorrigeables.length > 0 && (
        <div className="mt-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Carte mal lue dans un pli terminé</h3>
          <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-[auto_auto_1.4fr_auto]">
            <select aria-label="Pli à corriger" className={classeSelect} value={numero} data-testid="corr-pli"
              onChange={(e) => setCorr({ ...corr, numero: Number(e.target.value), rang: 0 })}>
              {plisCorrigeables.map((p) => <option key={p.numero} value={p.numero}>Pli {p.numero}</option>)}
            </select>
            <select aria-label="Rang de la carte à corriger" className={classeSelect} value={rang} data-testid="corr-rang"
              onChange={(e) => setCorr({ ...corr, rang: Number(e.target.value) })}>
              {Array.from({ length: cartesDuPli }, (_, i) => <option key={i} value={i}>Carte {i + 1}</option>)}
            </select>
            <SelecteurCarte etiquette="Vraie carte" valeur={corr.carte} testId="corr-carte" onChange={(carte) => setCorr({ ...corr, carte })} />
            <Bouton data-testid="corriger-carte" onClick={corriger}>Corriger</Bouton>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Le gagnant du pli et l'entame des suivants sont recalculés. Annulable.</p>
        </div>
      )}

      {retour && (
        <p role="status" data-testid="retour-correction" className={`mt-3 rounded-lg border px-2 py-1 text-xs ${retour.ok ? "border-emerald-500/40 text-emerald-200" : "border-rose-500/60 text-rose-200"}`}>
          {retour.texte}
        </p>
      )}
    </Section>
  );
}
