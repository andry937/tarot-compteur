import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Cta } from "./ui";

const EMAIL = import.meta.env.VITE_TAROT_AUTH_EMAIL;

/**
 * Écran de verrouillage : toute la table se connecte au même compte Firebase
 * Auth (un seul email fixe, VITE_TAROT_AUTH_EMAIL) — le mot de passe de ce
 * compte EST le passphrase partagé. Voir AuthGate.tsx pour la bascule
 * connecté/non connecté, et CLAUDE.md (Persistance/Firebase) pour la mise en
 * place côté console Firebase (règles Firestore + création du compte).
 */
export default function Verrou() {
  const [passphrase, setPassphrase] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    if (!passphrase || enCours) return;
    if (!auth) {
      setErreur("Configuration Firebase manquante — voir .env.example.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      await signInWithEmailAndPassword(auth, EMAIL, passphrase);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setErreur(code.includes("network") ? "Connexion impossible — réessayez." : "Passphrase incorrect.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-xs">
        <p className="mb-1 font-serif text-2xl font-bold tracking-tight text-slate-100">Feuille de marque</p>
        <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Passphrase requis</p>
        <input
          type="password"
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") valider();
          }}
          placeholder="Passphrase"
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-400"
        />
        {erreur && <p className="mb-3 font-mono text-[11px] text-rose-400">{erreur}</p>}
        <Cta disabled={enCours || !passphrase} onClick={valider}>
          {enCours ? "Vérification…" : "Entrer"}
        </Cta>
      </div>
    </div>
  );
}
