/**
 * Importe l'ancien historique (scripts/historique-tarot.json, produit par
 * convertir-historique.ts) dans Firestore, aux mêmes clés que l'app :
 * tarot:joueurs:v2, tarot:historique, tarot:archive:{id}.
 *
 * Idempotent : ids déterministes `import-<n°>`, relancer écrase les mêmes
 * documents sans doublon. Les fiches joueurs existantes sont réutilisées par nom.
 *
 *   npx vite-node scripts/importer-historique.ts            # simulation (rien n'est écrit)
 *   TAROT_PASSPHRASE=… npx vite-node scripts/importer-historique.ts --ecrire
 *
 * Lit la config Firebase et VITE_TAROT_AUTH_EMAIL dans .env (comme l'app).
 */
import { readFileSync } from "node:fs";
import { loadEnv } from "vite";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { resumerDonnees } from "../src/utils/regles";
import type { Donne } from "../src/utils/regles";
import { genId, trouverFicheParNom } from "../src/utils/identite";
import type { Fiche } from "../src/utils/identite";
import type { HistoriqueEntree } from "../src/types";

const ecrire = process.argv.includes("--ecrire");
const env = loadEnv("development", process.cwd(), "VITE_");
const COLLECTION = "tarotStorage";

interface Src { numero: number; date: string; joueurs: string[]; parDonne: number; depart: number; tours: number; totauxSource: number[]; donnes: Donne[]; complete: boolean }
// Seules les parties dont TOUTES les donnes ont été reconstituées (et retombent
// exactement sur les totaux) sont importées : pas de partie sans détail.
const toutes: Src[] = JSON.parse(readFileSync("scripts/historique-tarot.json", "utf8"));
const sources = toutes.filter((s) => s.complete);
const ignorees = toutes.length - sources.length;

let db: ReturnType<typeof getFirestore> | null = null;
if (ecrire) {
  const pass = process.env.TAROT_PASSPHRASE;
  if (!pass || !env.VITE_FIREBASE_API_KEY) throw new Error("TAROT_PASSPHRASE et .env (VITE_FIREBASE_*) requis avec --ecrire");
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
  });
  await signInWithEmailAndPassword(getAuth(app), env.VITE_TAROT_AUTH_EMAIL ?? "table@tarot-compteur.local", pass);
  db = getFirestore(app);
}

async function lire<T>(cle: string, defaut: T): Promise<T> {
  if (!db) return defaut;
  const s = await getDoc(doc(db, COLLECTION, cle));
  return s.exists() ? (JSON.parse(s.data().value) as T) : defaut;
}
async function ecr(cle: string, valeur: unknown) {
  if (db) await setDoc(doc(db, COLLECTION, cle), { value: JSON.stringify(valeur) });
}

let roster = await lire<Fiche[]>("tarot:joueurs:v2", []);
const nbAvant = roster.length;
const ficheId = (nom: string): string => {
  if (nom === "∅") {
    // Joueur sans nom dans l'ancienne appli : chaque occurrence est un joueur distinct → fiche inactive dédiée.
    const f: Fiche = { id: genId(), nom: "∅", creee: new Date().toISOString(), actif: false, redirigeVers: null };
    roster.push(f);
    return f.id;
  }
  const ex = trouverFicheParNom(nom, roster);
  if (ex) return ex.id;
  const f: Fiche = { id: genId(), nom, creee: new Date().toISOString(), actif: true, redirigeVers: null };
  roster.push(f);
  return f.id;
};

const entrees: HistoriqueEntree[] = [];
let sansDetail = 0;
for (const s of sources) {
  const id = `import-${String(s.numero).padStart(3, "0")}`;
  const joueursId = s.joueurs.map(ficheId);
  const donnes = s.complete ? s.donnes : [];
  if (!s.complete) sansDetail++;
  const totaux = s.complete ? resumerDonnees(donnes, joueursId.length).totaux : s.totauxSource;
  if (s.complete && totaux.some((t, i) => t !== s.totauxSource[i])) throw new Error(`Totaux incohérents, partie ${s.numero}`);
  await ecr(`tarot:archive:${id}`, { joueursId, joueursNomFige: s.joueurs, parDonne: s.parDonne, depart: s.depart, donnes, annulations: [] });
  entrees.push({ id, date: s.date, joueurs: s.joueurs, joueursId, parDonne: s.parDonne, nbDonnes: s.complete ? donnes.length : s.tours, totaux });
}

const existant = await lire<HistoriqueEntree[]>("tarot:historique", []);
const ids = new Set(entrees.map((e) => e.id));
const fusion = [...entrees, ...existant.filter((e) => !ids.has(e.id))].sort((a, b) => b.date.localeCompare(a.date));
await ecr("tarot:joueurs:v2", roster);
await ecr("tarot:historique", fusion);

console.log(`${ecrire ? "ÉCRIT" : "SIMULATION"} : ${entrees.length} parties (${ignorees} parties sans détail complet ignorées),` +
  `${roster.length - nbAvant} nouvelles fiches joueurs, index final ${fusion.length} entrées.`);
process.exit(0);
