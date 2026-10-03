import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import ErrorBoundary from "../src/components/ErrorBoundary";
import { cleTable, cleArchive, CLE_TABLES, CLE_HISTORIQUE } from "../src/lib/stockage";
import type { ArchiveRecord, HistoriqueEntree } from "../src/types";

const entree: HistoriqueEntree = {
  id: "tA",
  date: "2026-02-01T00:00:00.000Z",
  joueurs: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
  joueursId: ["a", "b", "c", "d", "e"],
  parDonne: 5,
  nbDonnes: 0,
  totaux: [0, 0, 0, 0, 0],
};
const record: ArchiveRecord = {
  joueursId: entree.joueursId,
  joueursNomFige: entree.joueurs,
  parDonne: 5,
  depart: 0,
  donnes: [],
  annulations: [],
};

function renderApp(entries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <App />
    </MemoryRouter>
  );
}

describe("Robustesse du stockage", () => {
  it("si une lecture échoue au démarrage, n'écrit rien et propose de réessayer", async () => {
    window.storage.__seed!(CLE_TABLES, [entree]);
    window.storage.__seed!(CLE_HISTORIQUE, [entree]);
    const set = vi.spyOn(window.storage, "set");
    vi.spyOn(window.storage, "get").mockRejectedValue(new Error("délai Firestore dépassé"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderApp();

    expect(await screen.findByText("Données inaccessibles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
    expect(JSON.parse(window.storage.__dump!()[CLE_TABLES])).toHaveLength(1);
  });

  it("si l'archivage échoue, la clôture garde la table ouverte et prévient", async () => {
    window.storage.__seed!("tarot:joueurs:v2", []);
    window.storage.__seed!(CLE_HISTORIQUE, []);
    window.storage.__seed!(CLE_TABLES, [entree]);
    window.storage.__seed!(cleTable("tA"), record);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const u = userEvent.setup();
    renderApp(["/partie/tA"]);
    await u.click(await screen.findByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    const set = window.storage.set.bind(window.storage);
    vi.spyOn(window.storage, "set").mockImplementation((k, v) =>
      k === cleArchive("tA") ? Promise.reject(new Error("réseau")) : set(k, v)
    );

    await u.click(screen.getByRole("button", { name: "Clôturer" }));
    await u.click(screen.getByRole("button", { name: "Confirmer ?" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Archivage impossible");
    const dump = window.storage.__dump!();
    expect(dump[cleTable("tA")]).toBeDefined(); // table non supprimée
    expect(dump[cleArchive("tA")]).toBeUndefined();
    expect(screen.getByRole("button", { name: "Clôturer" })).toBeInTheDocument(); // toujours sur la feuille
  }, 15000);
});

describe("ErrorBoundary", () => {
  it("affiche un écran de rechargement au lieu d'une page blanche", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Boom = () => {
      throw new Error("chunk introuvable");
    };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recharger" })).toBeInTheDocument();
  });
});
