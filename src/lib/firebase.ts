/**
 * Initialisation Firebase. La config est lue depuis les variables
 * d'environnement Vite (VITE_FIREBASE_*, voir .env.example) — elle n'a rien
 * de secret (c'est la config publique standard d'une app Firebase cliente,
 * la sécurité réelle vient des règles Firestore, pas de la confidentialité
 * de ces valeurs), mais passe par .env pour permettre des projets Firebase
 * différents entre le poste de dev et le déploiement Vercel sans toucher au code.
 * @module
 */
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Application Firebase, configurée par les variables `VITE_FIREBASE_*`. */
export const firebaseApp = initializeApp(firebaseConfig);
/** Base Firestore. */
export const db = getFirestore(firebaseApp);
// getAuth() démarre en interne un processus asynchrone (persistance/session)
// dès sa construction, indépendamment de tout appel à onAuthStateChanged —
// sans clé API (config absente, ex. .env manquant), ça plante tout le rendu
// React via une FirebaseError non interceptée. `null` dans ce cas précis ;
// AuthGate.tsx/Verrou.tsx gèrent ce cas comme "config absente" (même famille
// que l'absence de .env déjà tolérée ailleurs).
/** Authentification Firebase, ou `null` sans clé API (configuration absente). */
export const auth = import.meta.env.VITE_FIREBASE_API_KEY ? getAuth(firebaseApp) : null;
