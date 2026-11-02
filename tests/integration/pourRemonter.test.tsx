import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import type { Fiche } from "@/domain/joueurs/identite";
import type { Donne } from "@/domain/score/regles";
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import { cleTable } from "@/lib/storage/stockage";

const ids = ["a", "b", "c", "d", "e"];
const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];
const roster: Fiche[] = ids.map((id, i) => ({ id, nom: noms[i], creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null }));
const donne = (preneur: number, appele: number, contrat: string, points: number): Donne => ({
  table: [0, 1, 2, 3, 4],
  preneur,
  appele,
  contrat,
  bouts: 2,
  points,
  petitAuBout: "aucun",
  chelem: "aucun",
  miseres: [],
  roiAppele: "coeur",
});

function monter(donnes: Donne[]) {
  const entree: HistoriqueEntree = {
    id: "t1",
    date: "2026-02-01T00:00:00.000Z",
    joueurs: noms,
    joueursId: ids,
    parDonne: 5,
    nbDonnes: donnes.length,
    totaux: [0, 0, 0, 0, 0],
  };
  const record: ArchiveRecord = { joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes, annulations: [] };
  window.storage.__seed!("tarot:joueurs:v2", roster);
  window.storage.__seed!("tarot:tables", [entree]);
  window.storage.__seed!(cleTable("t1"), record);
  render(
    <MemoryRouter initialEntries={["/partie/t1"]}>
      <App />
    </MemoryRouter>
  );
}

describe("Section « Pour remonter »", () => {
  it("apparaît quand les joueurs ont 4 donnes, avec écart et contrat proposé", async () => {
    // Bob prend trois fois avec Chloé, puis Andry une fois : tout le monde a joué 4 donnes.
    monter([donne(1, 2, "garde", 60), donne(1, 2, "garde", 60), donne(1, 2, "garde", 60), donne(0, 3, "petite", 45)]);
    const section = await screen.findByTestId("pour-remonter");
    const conseils = within(section).getAllByTestId("conseil-remontee");
    expect(conseils.length).toBe(4); // tous sauf le leader
    expect(section.textContent).toMatch(/points d'écart/);
    expect(section.textContent).toMatch(/Tentez une/);
  });

  it("reste absente avant la 4e donne", async () => {
    monter([donne(1, 2, "garde", 60), donne(1, 2, "garde", 60), donne(1, 2, "garde", 60)]);
    await screen.findByText(/Noter la donne 4/);
    expect(screen.queryByTestId("pour-remonter")).not.toBeInTheDocument();
  });
});
