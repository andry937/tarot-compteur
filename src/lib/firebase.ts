/**
 * Initialisation Firebase. La config est lue depuis les variables
 * d'environnement Vite (VITE_FIREBASE_*, voir .env.example) — elle n'a rien
 * de secret (c'est la config publique standard d'une app Firebase cliente,
 * la sécurité réelle vient des règles Firestore, pas de la confidentialité
 * de ces valeurs), mais passe par .env pour permettre des projets Firebase
 * différents entre le poste de dev et le déploiement Vercel sans toucher au code.
 */
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
