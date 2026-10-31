/**
 * Formulaire d'inscription ou de modification d'une donne.
 * @module
 */

import { useState } from "react";
import { deduireAttaque } from "@/domain/cartes/cartes";
import EcranCartes from "@/components/cartes/EcranCartes";
import { CONTRATS, SEUILS, CHELEMS, NOM_ROI, NOM_BOUT, calculer } from "@/domain/score/regles";
import type { Bout, Donne, Misere, PetitAuBout, PoigneeDeclaree, Roi } from "@/domain/score/regles";
import { Field, Label, Chip, Cta } from "@/components/ui";
import ChoixJoueur from "./ChoixJoueur";
import PointsAttaque from "./PointsAttaque";
import DeclarationsPoignees from "./DeclarationsPoignees";
import DeclarationsMiseres from "./DeclarationsMiseres";

const ROIS = (Object.entries(NOM_ROI) as [Roi, string][]).map(([id, nom]) => ({ id, nom }));
const BOUTS_PRECIS = (Object.entries(NOM_BOUT) as [Bout, string][]).map(([id, nom]) => ({ id, nom }));

interface SaisieProps {
  joueurs: string[];
  parDonne: number;
  tableProposee: number[];
  total: number;
  numero: number;
  /** Nouvelle donne : sièges au repos à la donne suivante si celle-ci se joue à `table` (affichés sous le repos actuel). */
  reposApres?: (table: number[]) => number[];
  donneInitiale?: Donne;
  /** Nouvelle donne : brouillon des cartes de la main en cours, édité en direct dans `App.tsx`
   * (survit à la fermeture de la saisie). Absent pour la modification d'une donne existante,
   * qui travaille sur une copie locale. */
  brouillon?: {
    cartes: string[];
    chien: string[];
    onCartes: (cartes: string[]) => void;
    onChien: (chien: string[]) => void;
  };
  onFermer: () => void;
  onValider: (d: Donne) => void;
}

/**
 * Formulaire de saisie d'une donne (nouvelle, ou pré-remplie par `donneInitiale` pour la modifier). L'état du formulaire reste local ; seule la validation remonte la donne.
 */
export default function Saisie({
  joueurs,
  parDonne,
  tableProposee,
  total,
  numero,
  reposApres,
  donneInitiale,
  brouillon,
  onFermer,
  onValider,
}: SaisieProps) {
  const [table, setTable] = useState<number[]>(donneInitiale?.table ?? tableProposee);
  const [donneur, setDonneur] = useState(donneInitiale?.donneur ?? tableProposee[0]);
  const [preneur, setPreneur] = useState(donneInitiale?.preneur ?? tableProposee[0]);
  const [appele, setAppele] = useState<number | null>(donneInitiale?.appele ?? null);
  const [roiAppele, setRoiAppele] = useState<Roi | null>(donneInitiale?.roiAppele ?? null);
  const [contrat, setContrat] = useState(donneInitiale?.contrat ?? "garde");
  const [bouts, setBouts] = useState<0 | 1 | 2 | 3>(donneInitiale?.bouts ?? 1);
  const [boutsPrecis, setBoutsPrecis] = useState<Bout[]>(donneInitiale?.boutsPrecis ?? []);
  const [points, setPoints] = useState(donneInitiale?.points ?? 51);
  const [petitAuBout, setPetitAuBout] = useState<PetitAuBout>(donneInitiale?.petitAuBout ?? "aucun");
  const [poignees, setPoignees] = useState<PoigneeDeclaree[]>(donneInitiale?.poignees ?? []);
  const [chelem, setChelem] = useState(donneInitiale?.chelem ?? "aucun");
  const [miseres, setMiseres] = useState<Misere[]>(donneInitiale?.miseres ?? []);
  const [cartesLocales, setCartesLocales] = useState<string[]>(donneInitiale?.cartesJouees ?? []);
  const [chienLocal, setChienLocal] = useState<string[]>(donneInitiale?.chien ?? []);
  const [cartesOuvert, setCartesOuvert] = useState(false);
  const cartes = brouillon ? brouillon.cartes : cartesLocales;
  const chien = brouillon ? brouillon.chien : chienLocal;
  const setCartes = brouillon ? brouillon.onCartes : setCartesLocales;
  const setChien = brouillon ? brouillon.onChien : setChienLocal;

  const roiRequis = table.length === 5;
  const complete =
    table.length === parDonne && table.includes(preneur) && (!roiRequis || roiAppele !== null);
  const donne: Donne = {
    table, donneur, preneur, appele, contrat, bouts, boutsPrecis, points, petitAuBout, poignees, chelem,
    miseres, roiAppele: roiAppele ?? undefined,
    cartesJouees: cartes.length ? cartes : undefined,
    chien: chien.length ? chien : undefined,
  };
  const entame = table.length > 1 ? table[(table.indexOf(donneur) + 1) % table.length] : null;
  const res = calculer(donne, joueurs.length);
  const deduction =
    entame !== null && table.length > 1
      ? deduireAttaque({ table, entame, cartes, preneur, appele, contrat })
      : null;
  const seuil = SEUILS[bouts];
  const cadrer = (v: number) => Math.min(91, Math.max(0, Math.round(v * 2) / 2));

  const toggleBoutPrecis = (b: Bout) =>
    setBoutsPrecis((arr) => (arr.includes(b) ? arr.filter((x) => x !== b) : [...arr, b]));

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

  const reposSuivants = reposApres && table.length === parDonne ? reposApres(table) : [];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-4" onClick={onFermer}>
      <div
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border-t-2 border-amber-400 bg-slate-900 p-4 pb-56 sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-800 sm:border-t-2 sm:pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="font-serif text-xl font-bold sm:text-2xl">Donne {numero}</span>
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white"
            onClick={onFermer}
          >
            Fermer
          </button>
        </div>

        {joueurs.length > parDonne && (
          <Field>
            <Label>
              <span>
                Au repos ({joueurs.length - parDonne} sur {joueurs.length})
              </span>
              <em className="not-italic text-amber-400">
                {table.length} / {parDonne} à table
              </em>
            </Label>
            <div className="flex flex-wrap gap-2">
              {joueurs.map((j, i) => (
                <Chip key={i} on={!table.includes(i)} onClick={() => basculer(i)}>
                  {j}
                </Chip>
              ))}
            </div>
            {reposSuivants.length > 0 && (
              <p className="mt-2 text-xs text-slate-400" data-testid="repos-suivants">
                Donne suivante, au repos :{" "}
                <b className="font-semibold text-slate-100">{reposSuivants.map((i) => joueurs[i]).join(", ")}</b>
              </p>
            )}
          </Field>
        )}

        <details className="group mb-4 rounded-xl border border-slate-800 bg-black/20" data-testid="accordeon-donneur">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">
            <span>
              Donneur : <b className="font-semibold text-slate-100">{joueurs[donneur]}</b>
            </span>
            {entame !== null && <em className="not-italic text-amber-400">{joueurs[entame]} entame</em>}
          </summary>
          <div className="px-3.5 pb-3.5">
            <ChoixJoueur indices={table} joueurs={joueurs} actif={donneur} onChoisir={setDonneur} />
          </div>
        </details>

        <Field>
          <button
            type="button"
            data-testid="ouvrir-cartes"
            className="w-full rounded-lg border border-dashed border-slate-700 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide text-slate-300 hover:border-slate-500"
            onClick={() => setCartesOuvert(true)}
          >
            Cartes jouées{cartes.length + chien.length > 0 ? ` (${cartes.length}${chien.length ? ` · chien ${chien.length}` : ""})` : ""}
          </button>
        </Field>

        <Field>
          <Label>Preneur</Label>
          <ChoixJoueur
            indices={table}
            joueurs={joueurs}
            actif={preneur}
            onChoisir={(i) => {
              setPreneur(i);
              if (appele === i) setAppele(null);
            }}
          />
        </Field>

        {table.length === 5 && (
          <Field>
            <Label>Roi appelé</Label>
            <div className="flex flex-wrap gap-2">
              {ROIS.map((r) => (
                <Chip key={r.id} on={roiAppele === r.id} onClick={() => setRoiAppele(r.id)}>
                  {r.nom}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {table.length === 5 && (
          <Field>
            <Label>Chez qui ?</Label>
            <div className="flex flex-wrap gap-2">
              <Chip on={appele === null} onClick={() => setAppele(null)}>
                Lui-même
                <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">joue seul</small>
              </Chip>
              {table
                .filter((i) => i !== preneur)
                .map((i) => (
                  <Chip key={i} on={appele === i} onClick={() => setAppele(i)}>
                    {joueurs[i]}
                  </Chip>
                ))}
            </div>
          </Field>
        )}

        <Field>
          <Label>Contrat</Label>
          <div className="flex flex-wrap gap-2">
            {CONTRATS.map((c) => (
              <Chip key={c.id} on={contrat === c.id} onClick={() => setContrat(c.id)}>
                {c.nom}
                <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">×{c.mult}</small>
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>Bouts du preneur</Label>
          <div className="flex flex-wrap gap-2">
            {([0, 1, 2, 3] as const).map((b) => (
              <Chip key={b} on={bouts === b} onClick={() => setBouts(b)}>
                {b}
                <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">{SEUILS[b]} pts</small>
              </Chip>
            ))}
          </div>
        </Field>

        <Field>
          <Label>
            <span>Bouts précis du preneur</span>
            <em className="not-italic text-amber-400">si connus</em>
          </Label>
          <div className="flex flex-wrap gap-2">
            {BOUTS_PRECIS.map((b) => (
              <Chip key={b.id} on={boutsPrecis.includes(b.id)} onClick={() => toggleBoutPrecis(b.id)}>
                {b.nom}
              </Chip>
            ))}
          </div>
        </Field>

        <PointsAttaque
          points={points}
          onPoints={setPoints}
          res={res}
          seuil={seuil}
          deduction={deduction}
          nbCartes={cartes.length}
          onUtiliserDeduction={(d) => {
            setPoints(cadrer(d.points));
            setBouts(d.bouts);
            setBoutsPrecis(d.boutsPrecis);
            setPetitAuBout(d.petitAuBout);
          }}
        />

        <Field>
          <Label>Petit au bout</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "aucun", nom: "Aucun" },
              { id: "attaque", nom: "Attaque" },
              { id: "defense", nom: "Défense" },
            ].map((o) => (
              <Chip key={o.id} on={petitAuBout === o.id} onClick={() => setPetitAuBout(o.id as PetitAuBout)}>
                {o.nom}
              </Chip>
            ))}
          </div>
        </Field>

        <DeclarationsPoignees poignees={poignees} table={table} joueurs={joueurs} onChange={setPoignees} />

        <Field>
          <Label>Chelem</Label>
          <div className="flex flex-wrap gap-2">
            {CHELEMS.map((c) => (
              <Chip key={c.id} on={chelem === c.id} onClick={() => setChelem(c.id)}>
                {c.nom}
                {c.val !== 0 && (
                  <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide opacity-70">
                    {c.val > 0 ? `+${c.val}` : c.val}
                  </small>
                )}
              </Chip>
            ))}
          </div>
        </Field>

        <DeclarationsMiseres miseres={miseres} table={table} joueurs={joueurs} onChange={setMiseres} />

        <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur sm:absolute sm:rounded-b-2xl">
          <div className="mx-auto max-w-lg">
            {complete ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                  <span>{joueurs[preneur]}</span>
                  <b className="font-medium text-slate-100">
                    {(res.scores[preneur] as number) > 0 ? "+" : ""}
                    {res.scores[preneur]}
                  </b>
                </div>
                {res.avecAppele && (
                  <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                    <span>{joueurs[appele as number]} (appelé)</span>
                    <b className="font-medium text-slate-100">
                      {(res.scores[appele as number] as number) > 0 ? "+" : ""}
                      {res.scores[appele as number]}
                    </b>
                  </div>
                )}
                <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                  <span>Chaque défenseur</span>
                  <b className="font-medium text-slate-100">
                    {(res.scores[res.defenseurs[0]] as number) > 0 ? "+" : ""}
                    {res.scores[res.defenseurs[0]]}
                  </b>
                </div>
              </>
            ) : (
              <div className="mb-2 flex items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400">
                <span>Choisissez {parDonne} joueurs pour cette donne</span>
                <b className="font-medium text-slate-100">
                  {table.length} / {parDonne}
                </b>
              </div>
            )}
            <Cta disabled={!complete} onClick={() => onValider(donne)}>
              Inscrire la donne
            </Cta>
          </div>
        </div>
      </div>
      {cartesOuvert && entame !== null && (
        <div onClick={(e) => e.stopPropagation()}>
          <EcranCartes
            joueurs={joueurs}
            table={table}
            numero={numero}
            entame={entame}
            cartes={cartes}
            chien={chien}
            onCartes={setCartes}
            onChien={setChien}
            onFermer={() => setCartesOuvert(false)}
          />
        </div>
      )}
    </div>
  );
}
