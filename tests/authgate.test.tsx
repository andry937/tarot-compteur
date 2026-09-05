import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * On mocke firebase/auth entièrement : lib/firebase.ts appelle getAuth() au
 * chargement du module, et ce test n'a pas de vrai projet Firebase derrière.
 * firebase/app et firebase/firestore restent réels (initializeApp/getFirestore
 * sans config valide ne lèvent pas, voir lib/firebase.ts) puisqu'aucun appel
 * Firestore n'est déclenché ici.
 */
const ecouteurs: Array<(u: { uid: string } | null) => void> = [];
const signIn = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: (_auth: unknown, cb: (u: { uid: string } | null) => void) => {
    ecouteurs.push(cb);
    cb(null); // personne de connecté au démarrage
    return () => {};
  },
  signInWithEmailAndPassword: (...args: unknown[]) => signIn(...args),
}));

// lib/firebase.ts laisse `auth` à null quand VITE_FIREBASE_API_KEY est absent
// (le cas dans ce bac à tests) — on mocke le module entier pour lui donner un
// `auth` non-null, sinon AuthGate/Verrou court-circuitent avant même d'appeler
// les fonctions firebase/auth mockées ci-dessus.
vi.mock("../src/lib/firebase", () => ({ auth: {} }));

import AuthGate from "../src/AuthGate";

beforeEach(() => {
  signIn.mockReset();
  ecouteurs.length = 0;
});

describe("AuthGate / Verrou", () => {
  it("affiche l'écran de verrouillage tant qu'aucun utilisateur n'est connecté", async () => {
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>
    );
    expect(await screen.findByPlaceholderText("Passphrase")).toBeInTheDocument();
    expect(screen.getByText("Passphrase requis")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tirer qui distribue" })).not.toBeInTheDocument();
  });

  it("affiche une erreur si le passphrase est incorrect", async () => {
    signIn.mockRejectedValue({ code: "auth/invalid-credential" });
    const u = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>
    );
    await u.type(await screen.findByPlaceholderText("Passphrase"), "mauvais");
    await u.click(screen.getByRole("button", { name: /Entrer/ }));
    expect(await screen.findByText("Passphrase incorrect.")).toBeInTheDocument();
  });

  it("distingue une erreur réseau d'un passphrase incorrect", async () => {
    signIn.mockRejectedValue({ code: "auth/network-request-failed" });
    const u = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>
    );
    await u.type(await screen.findByPlaceholderText("Passphrase"), "bonpass");
    await u.click(screen.getByRole("button", { name: /Entrer/ }));
    expect(await screen.findByText("Connexion impossible — réessayez.")).toBeInTheDocument();
  });

  it("affiche l'app une fois le passphrase accepté", async () => {
    signIn.mockImplementation(async () => {
      ecouteurs.forEach((cb) => cb({ uid: "1" }));
    });
    const u = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>
    );
    await u.type(await screen.findByPlaceholderText("Passphrase"), "bonpass");
    await u.click(screen.getByRole("button", { name: /Entrer/ }));
    await screen.findByText("Feuille de marque");
  });
});
