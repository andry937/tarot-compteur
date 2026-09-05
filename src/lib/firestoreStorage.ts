/**
 * Adaptateur Firestore respectant l'interface WindowStorage (get/set/delete/
 * list, get lève sur une clé absente) — branché sur window.storage au
 * démarrage (main.tsx), donc le reste du code (App.tsx, Historique.tsx, …)
 * continue d'appeler window.storage.get/set/delete sans rien savoir de
 * Firestore.
 *
 * Chaque clé (ex. "tarot:partie:v4", "tarot:archive:1234567890") devient un
 * identifiant de document dans la collection COLLECTION, avec la valeur JSON
 * stockée telle quelle dans un champ `value`.
 *
 * Chaque opération est bornée dans le temps (voir avecDelai) : une config
 * Firebase absente/invalide ou un réseau coupé fait rester une requête
 * Firestore en attente indéfiniment plutôt que de rejeter vite, ce qui
 * bloquerait silencieusement n'importe quelle action de l'app (tirage,
 * saisie d'une donne, clôture de partie, …) au lieu d'échouer proprement
 * dans le try/catch appelant.
 */
import {
  collection,
  doc,
  deleteDoc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { WindowStorage } from "./window-storage";

const COLLECTION = "tarotStorage";
// Exporté : AuthGate.tsx applique le même délai à onAuthStateChanged, pour la
// même raison (réseau coupé/lent ne doit pas bloquer indéfiniment l'app).
export const DELAI_MS = 8000;

function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("délai Firestore dépassé")), ms)),
  ]);
}

export function creerStorageFirestore(): WindowStorage {
  return {
    async get(key) {
      const snap = await avecDelai(getDoc(doc(db, COLLECTION, key)), DELAI_MS);
      if (!snap.exists()) throw new Error(`clé introuvable: ${key}`);
      return { key, value: snap.data().value as string, shared: true };
    },

    async set(key, value) {
      await avecDelai(setDoc(doc(db, COLLECTION, key), { value }), DELAI_MS);
      return { key, value, shared: true };
    },

    async delete(key) {
      const ref = doc(db, COLLECTION, key);
      const existant = await avecDelai(getDoc(ref), DELAI_MS);
      await avecDelai(deleteDoc(ref), DELAI_MS);
      return { key, deleted: existant.exists(), shared: true };
    },

    async list(prefix) {
      const col = collection(db, COLLECTION);
      // Astuce standard Firestore pour une requête "commence par" sur l'ID de
      // document : le caractère de borne haute est un point de code très
      // élevé, supérieur à tout caractère normal.
      const q = prefix
        ? query(col, where(documentId(), ">=", prefix), where(documentId(), "<", prefix + ""))
        : query(col);
      const snap = await avecDelai(getDocs(q), DELAI_MS);
      return { keys: snap.docs.map((d) => d.id), prefix, shared: true };
    },
  };
}
