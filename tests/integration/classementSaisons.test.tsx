import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import type { Fiche } from "@/domain/joueurs/identite";
import type { Donne } from "@/domain/score/regles";
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import { cleArchive } from "@/lib/storage/stockage";

const ids = ["a", "b", "c", "d", "e"];
const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];
const roster: Fiche[] = ids.map((id, i) => ({ id, nom: noms[i], creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null }));

const base: Donne = {
  table: [0, 1, 2, 3, 4],
  preneur: 0,
  appele: 2,
  contrat: "garde_contre",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
  points: 70,
};
// 40 donnes : sous le seuil du général (50), au-dessus de ceux du mois (10) et de l'année (30).
const donnes: Donne[] = Array.from({ length: 40 }, () => base);
const maintenant = new Date().toISOString();
const entree: HistoriqueEntree = { id: "p1", date: maintenant, joueurs: noms, joueursId: ids, parDonne: 5, nbDonnes: donnes.length, totaux: [0, 0, 0, 0, 0] };
const archive: ArchiveRecord = { joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes, annulations: [] };

function monter() {
  window.storage.__seed!("tarot:joueurs:v2", roster);
  window.storage.__seed!("tarot:historique", [entree]);
  window.storage.__seed!(cleArchive("p1"), archive);
  render(
    <MemoryRouter initialEntries={["/classement"]}>
      <App />
    </MemoryRouter>
  );
}

describe("Classements mensuel et annuel", () => {
  it("garde le général au seuil de 50 donnes et ajoute les saisons à des seuils plus bas", async () => {
    monter();
    await screen.findByText(/Personne n'a encore atteint le seuil/);
    expect(screen.queryAllByTestId("classement-row")).toHaveLength(0);

    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Mensuel" }));
    expect(await screen.findAllByTestId("classement-row")).toHaveLength(5);
    expect(screen.getByTestId("periode-courante")).toHaveTextContent("en cours");

    await u.click(screen.getByRole("button", { name: "Annuel" }));
    expect(await screen.findAllByTestId("classement-row")).toHaveLength(5);
    expect(screen.getByTestId("periode-courante")).toHaveTextContent(String(new Date().getFullYear()));

    await u.click(screen.getByRole("button", { name: "Général" }));
    expect(await screen.findByText(/Personne n'a encore atteint le seuil/)).toBeInTheDocument();
  });

  it("affiche le palmarès des champions de la saison", async () => {
    monter();
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Mensuel" }));
    const champions = await screen.findAllByTestId("champion-row");
    expect(champions).toHaveLength(1);
    expect(within(champions[0]).getByText(/Andry/)).toBeInTheDocument();
  });
});
