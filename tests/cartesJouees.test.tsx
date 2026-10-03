import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import type { ArchiveRecord, HistoriqueEntree } from "../src/types";
import { cleTable } from "../src/lib/stockage";

const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];
const ids = ["a", "b", "c", "d", "e"];

const entree: HistoriqueEntree = {
  id: "tA", date: "2026-02-01T00:00:00.000Z", joueurs: noms, joueursId: ids,
  parDonne: 5, nbDonnes: 0, totaux: [0, 0, 0, 0, 0],
};
const record: ArchiveRecord = {
  joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes: [], annulations: [],
};

function seed() {
  window.storage.__seed!("tarot:joueurs:v2", ids.map((id, i) => ({
    id, nom: noms[i], creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null,
  })));
  window.storage.__seed!("tarot:historique", []);
  window.storage.__seed!("tarot:tables", [entree]);
  window.storage.__seed!(cleTable("tA"), record);
}

const rendre = (route: string) =>
  render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);

const carte = (id: string) => document.querySelector(`[data-carte="${id}"]`) as HTMLElement;

describe("Carnet des cartes jouées", () => {
  it("déduit le joueur à jouer et le gagnant du pli, grise les cartes tombées", async () => {
    seed();
    const u = userEvent.setup();
    rendre("/partie/tA/cartes");
    await screen.findByText("Cartes jouées");

    // Donneur Andry → Bob entame.
    expect(screen.getByTestId("a-qui-de-jouer")).toHaveTextContent("C'est à Bob de jouer");
    for (const c of ["atout-5", "coeur-14", "atout-12", "excuse", "atout-3"]) await u.click(carte(c));

    expect(carte("atout-12")).toBeDisabled();
    expect(screen.getByTestId("atouts-restants")).toHaveTextContent("18"); // 22 − 3 atouts − Excuse
    // Denis (atout XII) remporte le pli et entame le suivant.
    expect(screen.getByTestId("a-qui-de-jouer")).toHaveTextContent("C'est à Denis de jouer");
    const pli = within(screen.getByTestId("journal-plis")).getByTestId("pli");
    expect(pli).toHaveTextContent("→ Denis");

    // Annuler la dernière carte redonne la main à Andry.
    await u.click(screen.getByRole("button", { name: "Annuler la dernière carte" }));
    expect(carte("atout-3")).not.toBeDisabled();
    expect(screen.getByTestId("a-qui-de-jouer")).toHaveTextContent("C'est à Andry de jouer");
  });

  it("persiste le brouillon, puis l'archive avec la donne inscrite", async () => {
    seed();
    const u = userEvent.setup();
    const { unmount } = rendre("/partie/tA/cartes");
    await screen.findByText("Cartes jouées");
    await u.click(carte("atout-21"));
    await u.click(carte("excuse"));
    await screen.findByText(/2 cartes notées/);

    unmount();

    // Rechargement : les cartes reviennent depuis le stockage.
    rendre("/partie/tA/cartes");
    await screen.findByText(/2 cartes notées/);
    expect(carte("atout-21")).toBeDisabled();

    // Retour sur la feuille puis inscription d'une donne : les cartes y sont rattachées.
    await u.click(screen.getByRole("link", { name: "Feuille" }));
    await screen.findByText(/Noter la donne 1/);
    expect(screen.getByTestId("lien-cartes")).toHaveTextContent("Cartes jouées (2)");
    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    // Brouillon vidé, cartes conservées sur la donne.
    expect(screen.getByTestId("lien-cartes")).toHaveTextContent(/^Cartes jouées$/);
    const sauve = JSON.parse(window.storage.__dump!()[cleTable("tA")]) as ArchiveRecord;
    expect(sauve.cartesEnCours).toEqual([]);
    expect(sauve.donnes[0].cartesJouees).toEqual(["atout-21", "excuse"]);

    // Visible dans le détail de la donne.
    const grille = document.querySelector("table") as HTMLElement;
    await u.click(within(grille).getByText("1").closest("tr") as HTMLElement);
    await u.click(screen.getByText(/^Cartes jouées \(2\)$/));
    expect(screen.getAllByTestId("pli")[0]).toHaveTextContent("Bob XXI");
    expect(screen.getAllByTestId("pli")[0]).toHaveTextContent("Chloé Exc.");
  });

  it("note le chien (3 cartes à 5 joueurs), le garde dans le brouillon et l'archive avec la donne", async () => {
    seed();
    const u = userEvent.setup();
    rendre("/partie/tA/cartes");
    await screen.findByText("Cartes jouées");

    await u.click(screen.getByRole("button", { name: /Chien \(0\/3\)/ }));
    expect(screen.getByTestId("aide-chien")).toHaveTextContent("3 cartes");
    for (const c of ["atout-1", "coeur-14", "pique-3"]) await u.click(carte(c));
    // Plafonné à la taille du chien.
    expect(carte("trefle-2")).toBeDisabled();
    // Retirer une carte du chien en la retouchant.
    await u.click(carte("pique-3"));
    expect(screen.getByRole("button", { name: /Chien \(2\/3\)/ })).toBeInTheDocument();
    await u.click(carte("trefle-2"));
    expect(screen.getByTestId("chien-vu")).toHaveTextContent(/I · Roi de cœur · 2 de trèfle/);

    // Inscription de la donne : le chien est rattaché à la donne et le brouillon vidé.
    await u.click(screen.getByRole("link", { name: "Feuille" }));
    await u.click(await screen.findByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);
    const sauve = JSON.parse(window.storage.__dump!()[cleTable("tA")]) as ArchiveRecord;
    expect(sauve.donnes[0].chien).toEqual(["atout-1", "coeur-14", "trefle-2"]);
    expect(sauve.chienEnCours).toEqual([]);
  });

  it("note les cartes d'une donne déjà inscrite (feuille), sans toucher au score", async () => {
    seed();
    const u = userEvent.setup();
    rendre("/partie/tA");
    await u.click(await screen.findByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    const grille = document.querySelector("table") as HTMLElement;
    await u.click(within(grille).getByText("1").closest("tr") as HTMLElement);
    await u.click(screen.getByRole("button", { name: "Noter les cartes" }));
    // Donneur Andry → Bob entame.
    expect(screen.getByTestId("a-qui-de-jouer")).toHaveTextContent("C'est à Bob de jouer");
    await u.click(carte("atout-9"));
    await u.click(carte("pique-4"));
    await u.click(screen.getByRole("button", { name: /Chien \(0\/3\)/ }));
    await u.click(carte("excuse"));

    // Annuler ne change rien.
    await u.click(screen.getByRole("button", { name: "Annuler" }));
    expect((JSON.parse(window.storage.__dump!()[cleTable("tA")]) as ArchiveRecord).donnes[0].cartesJouees).toBeUndefined();

    await u.click(screen.getByRole("button", { name: "Noter les cartes" }));
    await u.click(carte("atout-9"));
    await u.click(carte("pique-4"));
    await u.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText(/Noter la donne 2/);

    const sauve = JSON.parse(window.storage.__dump!()[cleTable("tA")]) as ArchiveRecord;
    expect(sauve.donnes[0].cartesJouees).toEqual(["atout-9", "pique-4"]);
    expect(screen.getByRole("button", { name: "Modifier les cartes" })).toBeInTheDocument();
  });

  it("note les cartes d'une donne d'une partie archivée et les persiste", async () => {
    seed();
    const donne = {
      table: [0, 1, 2, 3, 4], donneur: 0, preneur: 0, appele: null, roiAppele: "coeur", contrat: "garde",
      bouts: 1, points: 60, petitAuBout: "aucun", chelem: "aucun", miseres: [],
    };
    window.storage.__seed!("tarot:tables", []);
    window.storage.__seed!("tarot:historique", [{ ...entree, id: "p1", nbDonnes: 1, totaux: [0, 0, 0, 0, 0] }]);
    window.storage.__seed!("tarot:archive:p1", { ...record, donnes: [donne] });
    const u = userEvent.setup();
    rendre("/historique/p1");
    await screen.findByText("Classement final");
    const grille = document.querySelector("table") as HTMLElement;
    await u.click(within(grille).getByText("1").closest("tr") as HTMLElement);
    await u.click(screen.getByRole("button", { name: "Noter les cartes" }));
    await u.click(carte("atout-21"));
    await u.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Classement final");
    await vi.waitFor(() => {
      const a = JSON.parse(window.storage.__dump!()["tarot:archive:p1"]) as ArchiveRecord;
      expect(a.donnes[0].cartesJouees).toEqual(["atout-21"]);
    });
  });
});
