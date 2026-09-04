import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import type { Fiche } from "../src/utils/identite";

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
}

describe("Réordonnancement des sièges par glisser-déposer", () => {
  it("échange deux joueurs quand on dépose l'un sur l'autre", async () => {
    const u = userEvent.setup();
    renderApp();
    await screen.findByText("Feuille de marque");

    await u.type(screen.getByPlaceholderText("Joueur 2"), "Fara");
    await u.type(screen.getByPlaceholderText("Joueur 3"), "Lian");

    const siegeAndry = screen.getByDisplayValue("Andry").closest('[data-testid="champ-nom"]') as HTMLElement;
    const siegeLian = screen.getByDisplayValue("Lian").closest('[data-testid="champ-nom"]') as HTMLElement;

    fireEvent.dragStart(siegeAndry);
    fireEvent.dragOver(siegeLian);
    fireEvent.drop(siegeLian);
    fireEvent.dragEnd(siegeAndry);

    // Andry et Lian ont permuté de siège ; Fara (au milieu) n'a pas bougé.
    expect(screen.getByPlaceholderText("Joueur 2")).toHaveValue("Fara");
    expect(screen.getByDisplayValue("Andry").closest('[data-testid="champ-nom"]')).toBe(siegeLian);
    expect(screen.getByDisplayValue("Lian").closest('[data-testid="champ-nom"]')).toBe(siegeAndry);
  });
});

/** Pré-remplit le registre et l'historique directement dans le faux storage. */
function preseeder({ roster = [], historique = [] }: { roster?: Fiche[]; historique?: unknown[] } = {}) {
  window.storage.__seed!("tarot:joueurs:v2", roster);
  window.storage.__seed!("tarot:historique", historique);
}

const fiche = (id: string, nom: string, extra: Partial<Fiche> = {}): Fiche => ({
  id,
  nom,
  creee: "2026-01-01T00:00:00.000Z",
  actif: true,
  redirigeVers: null,
  ...extra,
});

describe("Écran de configuration du trombinoscope", () => {
  it("liste les joueurs actifs par ordre alphabétique (locale FR)", async () => {
    preseeder({
      roster: [
        fiche("z", "Zoé"),
        fiche("a", "Andry"),
        fiche("m", "Marc"),
        fiche("f", "Fara"),
        fiche("b", "Bob"),
      ],
    });
    const u = userEvent.setup();
    renderApp();
    await screen.findByText("Feuille de marque");

    await u.click(screen.getByRole("link", { name: /Joueurs \(5\)/ }));
    await screen.findByRole("heading", { name: "Joueurs" });

    const noms = screen.getAllByTestId("roster-nom").map((el) => el.textContent);
    expect(noms).toEqual(["Andry", "Bob", "Fara", "Marc", "Zoé"]);
  });

  it("renomme une fiche et conserve le tri", async () => {
    preseeder({
      roster: [fiche("a", "Andry"), fiche("b", "Bob"), fiche("m", "Marc")],
    });
    const u = userEvent.setup();
    renderApp();
    await screen.findByText("Feuille de marque");
    await u.click(screen.getByRole("link", { name: /Joueurs \(3\)/ }));
    await screen.findByRole("heading", { name: "Joueurs" });

    const ligneBob = screen.getByText("Bob").closest('[data-testid="roster-row"]') as HTMLElement;
    await u.click(within(ligneBob).getByText("Renommer"));
    const champ = screen.getByDisplayValue("Bob");
    await u.clear(champ);
    await u.type(champ, "Bobby");
    await u.click(screen.getByRole("button", { name: "Valider" }));

    const noms = screen.getAllByTestId("roster-nom").map((el) => el.textContent);
    expect(noms).toEqual(["Andry", "Bobby", "Marc"]);
  });

  it("refuse de fusionner deux joueurs qui ont déjà partagé une table", async () => {
    preseeder({
      roster: [fiche("a", "Andry"), fiche("b", "Bob")],
      historique: [{ id: "p1", joueursId: ["a", "b"], joueurs: ["Andry", "Bob"] }],
    });
    const u = userEvent.setup();
    renderApp();
    await screen.findByText("Feuille de marque");
    await u.click(screen.getByRole("link", { name: /Joueurs \(2\)/ }));
    await screen.findByRole("heading", { name: "Joueurs" });

    const ligneAndry = screen.getByText("Andry").closest('[data-testid="roster-row"]') as HTMLElement;
    await u.click(within(ligneAndry).getByText("Fusionner"));
    await u.click(screen.getByRole("button", { name: "Bob" }));

    await screen.findByText(/fusion refusée/);
    await u.click(screen.getByRole("button", { name: "Annuler" }));
    // Toujours deux fiches actives : rien n'a été fusionné.
    const noms = screen.getAllByTestId("roster-nom").map((el) => el.textContent);
    expect(noms).toEqual(["Andry", "Bob"]);
  });

  it("fusionne deux joueurs qui n'ont jamais joué ensemble et propage le nom", async () => {
    preseeder({
      roster: [fiche("a", "Andry"), fiche("b", "Bob")],
      historique: [], // aucune partie encore : jamais joué ensemble
    });
    const u = userEvent.setup();
    renderApp();
    await screen.findByText("Feuille de marque");
    await u.click(screen.getByRole("link", { name: /Joueurs \(2\)/ }));
    await screen.findByRole("heading", { name: "Joueurs" });

    const ligneBob = screen.getByText("Bob").closest('[data-testid="roster-row"]') as HTMLElement;
    await u.click(within(ligneBob).getByText("Fusionner"));
    await u.click(screen.getByRole("button", { name: "Andry" }));

    // Bob a disparu des actifs...
    const nomsActifs = screen.getAllByTestId("roster-nom").map((el) => el.textContent);
    expect(nomsActifs).toEqual(["Andry"]);

    // ...et réapparaît dans les désactivés, avec la mention de la fusion.
    await u.click(screen.getByText(/Voir les joueurs désactivés/));
    expect(screen.getByText(/fusionnée dans Andry/)).toBeInTheDocument();
  });
});
