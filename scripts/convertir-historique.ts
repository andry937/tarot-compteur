/**
 * Convertit l'export Excel de l'ancien historique (scripts/.source.json, extrait
 * de scores_tarot_historique.xlsx) en enregistrements d'archive au format de
 * l'app, puis vérifie que `calculer()` retombe EXACTEMENT sur les scores lus.
 *
 * Usage : npx vite-node scripts/convertir-historique.ts
 * Sortie : scripts/historique-tarot.json (noms de joueurs, pas d'identifiants —
 * le rapprochement avec le registre se fait à l'import).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { calculer } from "../src/utils/regles";
import type { Donne, PetitAuBout, Roi } from "../src/utils/regles";

interface SrcPartie { n: number; annee: string; date: string; tours: number; joueurs: string[]; scores: number[] }
interface SrcDonne {
  partie: number; num: number; preneurIdx: number | null; preneur: string | null; contrat: string | null;
  bouts: number | null; couleur: string | null; partenaire: string | null;
  joueurs: string[]; scores: (number | null)[]; remarque: string | null;
}

const { parties, donnes } = JSON.parse(readFileSync("scripts/.source.json", "utf8")) as {
  parties: SrcPartie[]; donnes: SrcDonne[];
};

const ID_CONTRAT: Record<string, string> = { G: "garde", GS: "garde_sans", GC: "garde_contre" };
const MOIS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// « Année N » = année de la partie la plus récente (28 août 2026) — l'app
// n'affichait pas l'année, voir feuille Notes de l'Excel.
const ANNEE_N = 2026;
const ANNEE: Record<string, number> = { "Année N (récente)": ANNEE_N, "Année N-1": ANNEE_N - 1, "Année N-2": ANNEE_N - 2 };

const ROI: Record<string, Roi> = { "♥": "coeur", "♦": "carreau" }; // ♠/♣ indiscernables → non renseigné

const POIGNEES = ["aucun", "simple", "double", "triple"];
const VAL_POIGNEE: Record<string, number> = { aucun: 0, simple: 20, double: 30, triple: 40 };
const VAL_CHELEM: Record<string, number> = { aucun: 0, non_annonce: 200, annonce_reussi: 400, annonce_chute: -200 };
const MULT: Record<string, number> = { garde: 2, garde_sans: 4, garde_contre: 6 };
const SEUIL = [56, 51, 41, 36];

/** Retrouve une donne dont `calculer()` redonne exactement `cible` : d'abord sans
 * misère, puis avec 1, 2 misères (±10 par joueur, indépendantes du contrat),
 * en préférant l'explication la plus simple. Résultat re-vérifié par `calculer()`. */
function candidats(base: Donne, nbTotal: number, cible: (number | null)[]): Donne | null {
  const table = base.table;
  const n = table.length;
  const avecAppele = n === 5 && base.appele !== null && base.appele !== base.preneur;
  const mult = MULT[base.contrat];
  const seuil = SEUIL[base.bouts];
  const defenseur = table.find((i) => i !== base.preneur && !(avecAppele && i === base.appele));
  if (defenseur === undefined) return null;

  const affectations: number[][] = [];
  const rec = (i: number, cur: number[]) => {
    if (i === n) return void affectations.push(cur);
    for (const v of [0, 1, -1]) rec(i + 1, [...cur, v]);
  };
  rec(0, []);
  affectations.sort((a, b) => a.filter(Boolean).length - b.filter(Boolean).length);

  for (const misere of affectations) {
    if (misere.filter(Boolean).length > 2) break;
    const delta = table.map((_, k) => {
      let d = 0;
      table.forEach((__, m) => {
        if (misere[m]) d += m === k ? misere[m] * 10 * (n - 1) : -misere[m] * 10;
      });
      return d;
    });
    const B = -(cible[defenseur]! - delta[table.indexOf(defenseur)]);
    for (const pab of ["aucun", "attaque", "defense"] as PetitAuBout[]) {
      for (const pa of POIGNEES) {
        for (const pd of POIGNEES) {
          for (const chelem of Object.keys(VAL_CHELEM)) {
            const poignees: NonNullable<Donne["poignees"]> = [];
            if (pa !== "aucun") poignees.push({ id: "pa", joueur: base.preneur, taille: pa });
            if (pd !== "aucun") poignees.push({ id: "pd", joueur: defenseur, taille: pd });
            const pabV = pab === "attaque" ? 10 * mult : pab === "defense" ? -10 * mult : 0;
            const R = B - pabV - VAL_POIGNEE[pa] + VAL_POIGNEE[pd] - VAL_CHELEM[chelem];
            const e = Math.abs(R) / mult - 25;
            if (!Number.isInteger(e) || e < 0 || R === 0) continue;
            const points = R > 0 ? seuil + e : seuil - e;
            if (points < 0 || points > 91) continue;
            const d: Donne = {
              ...base, points, petitAuBout: pab, poignees, chelem,
              miseres: table.flatMap((j, k) => (misere[k] ? [{ id: `m${j}`, joueur: j, type: "atout" as const, aTort: misere[k] < 0 }] : [])),
            };
            const s = calculer(d, nbTotal).scores;
            if (s.every((v, i) => v === cible[i])) return d;
          }
        }
      }
    }
  }
  return null;
}

const RENOMMER: Record<string, string> = { Doda: "Andry" };
const nom = (x: string) => RENOMMER[x] ?? x;
const archives: unknown[] = [];
const rapport = { donnes: 0, exactes: 0, avecBonus: 0, echecs: [] as string[], contratDevine: 0, sansDetail: [] as number[] };

parties.forEach((p, idx) => {
  const nb = p.joueurs.length;
  const parDonne = Math.min(5, nb);
  const [mois, jour] = p.date.split(" ");
  // Liste source = plus récente en premier ; l'index sert à départager les parties d'un même jour.
  const date = new Date(Date.UTC(ANNEE[p.annee], MOIS[mois], Number(jour), 20, 0, 0) - idx * 60_000).toISOString();
  const src = donnes.filter((d) => d.partie === p.n).sort((a, b) => a.num - b.num);
  const out: Donne[] = [];
  if (!src.length) rapport.sansDetail.push(p.n);

  src.forEach((s) => {
    rapport.donnes++;
    const table = s.scores.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    const preneur = (s.preneurIdx as number) - 1;
    let appele: number | null = null;
    if (nb >= 5 && table.length === 5) {
      appele = s.partenaire === "Seul" ? preneur : s.joueurs.indexOf(s.partenaire as string);
      if (appele < 0) appele = null;
    }
    const cible = s.scores;
    const contrats = s.contrat ? [ID_CONTRAT[s.contrat]] : ["garde", "garde_sans", "garde_contre"];
    const boutsPossibles = s.bouts === null ? [0, 1, 2, 3] : [s.bouts];
    let trouve: Donne | null = null;
    for (const contrat of contrats) {
      for (const bouts of boutsPossibles) {
        const base: Donne = {
          table, preneur, appele, contrat, bouts: bouts as 0 | 1 | 2 | 3, points: 0,
          petitAuBout: "aucun", poignees: [], chelem: "aucun", miseres: [],
          ...(ROI[s.couleur ?? ""] && table.length === 5 ? { roiAppele: ROI[s.couleur as string] } : {}),
        };
        trouve = candidats(base, nb, cible);
        if (trouve) break;
      }
      if (trouve) break;
    }
    if (!trouve) {
      rapport.echecs.push(`partie ${p.n} donne ${s.num}`);
      return;
    }
    if (!s.contrat || s.bouts === null) rapport.contratDevine++;
    if (trouve.petitAuBout !== "aucun" || trouve.poignees!.length || trouve.miseres.length || trouve.chelem !== "aucun") rapport.avecBonus++;
    else rapport.exactes++;
    out.push(trouve);
  });

  archives.push({
    numero: p.n,
    date,
    joueurs: p.joueurs.map(nom),
    parDonne,
    depart: 0,
    tours: p.tours,
    totauxSource: p.scores,
    donnes: out,
    complete: src.length > 0 && out.length === src.length && out.length === p.tours,
  });
});

writeFileSync("scripts/historique-tarot.json", JSON.stringify(archives, null, 1));
console.log(JSON.stringify({ ...rapport, echecs: rapport.echecs }, null, 1));
