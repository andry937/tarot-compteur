/**
 * Verrou d'accès : n'affiche l'application qu'à un utilisateur connecté.
 * @module
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { DELAI_MS } from "@/lib/storage/firestoreStorage";
import App from "@/App";
import Verrou from "@/components/auth/Verrou";

/**
 * Passphrase partagée : tant qu'aucun utilisateur Firebase Auth n'est
 * connecté (voir Verrou.tsx), l'app elle-même ne se monte pas — les règles
 * Firestore exigent request.auth != null (voir CLAUDE.md, Persistance/
 * Firebase), donc rien n'est lisible/écrivable ni dans l'app ni en dehors
 * sans passer par ce verrou. onAuthStateChanged persiste la session d'un
 * rechargement à l'autre (comportement par défaut du SDK Firebase Auth).
 *
 * L'initialisation de Firebase Auth fait un appel réseau (détection de
 * l'environnement) avant son tout premier callback : un réseau coupé/lent le
 * laisse en attente indéfiniment (même risque que documenté dans
 * firestoreStorage.ts) — sans garde-fou, l'écran resterait vierge pour
 * toujours au lieu d'afficher le verrou. Le délai retombe donc sur "non
 * connecté" (échec fermé, cohérent avec l'objectif de sécurité) plutôt que de
 * bloquer ; si le callback finit par arriver plus tard, il met quand même à
 * jour l'état normalement.
 *
 * Sans `.env` (config Firebase absente — le seul cas testé/toléré ailleurs
 * dans le code, ex. build/tests qui n'en ont pas besoin), `lib/firebase.ts`
 * laisse `auth` à `null` plutôt que de construire un Auth invalide (une clé
 * API absente/vide fait planter Firebase Auth en interne, via une
 * FirebaseError non interceptable proprement). Ce cas se traite alors comme
 * "non connecté" — même logique d'échec fermé que le délai ci-dessus.
 */
export default function AuthGate() {
  const [utilisateur, setUtilisateur] = useState<User | null>(null);
  const [pret, setPret] = useState(!auth);

  useEffect(() => {
    if (!auth) return;
    const delai = setTimeout(() => setPret(true), DELAI_MS);
    const desabonner = onAuthStateChanged(auth, (u) => {
      clearTimeout(delai);
      setUtilisateur(u);
      setPret(true);
    });
    return () => {
      clearTimeout(delai);
      desabonner();
    };
  }, []);

  if (!pret) return <div className="min-h-screen bg-slate-950" />;
  if (!utilisateur) return <Verrou />;
  return <App />;
}
