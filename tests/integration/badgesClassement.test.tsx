import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import type { Fiche } from "@/domain/joueurs/identite";
import type { Donne } from "@/domain/score/regles";
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import type { PartieAnalysee } from "@/domain/stats/stats";
import { attribuerBadges, BADGES } from "@/domain/stats/badges";
import { cleArchive } from "@/lib/storage/stockage";

const ids = ["a", "b", "c", "d", "e"];
const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];
const roster: Fiche[] = ids.map((id, i) => ({ id, nom: noms[i], creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null }));

const base: Donne = {
  table: [0, 1, 2, 3, 4],
  preneur: 0,
  appele: 1,
  contrat: "garde",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
  points: 60,
};
// Andry prend 40 Garde contre réussies, Bob prend 20 Petites qui chutent : assez de donnes (60) pour figurer au classement.
const donnes: Donne[] = [
  ...Array.from({ length: 40 }, () => ({ ...base, preneur: 0, appele: 2, contrat: "garde_contre", points: 70 })),
  ...Array.from({ length: 20 }, () => ({ ...base, preneur: 1, appele: 3, contrat: "petite", points: 30 })),
];

const entree: HistoriqueEntree = {
  id: "p1",
  date: "2026-02-01T00:00:00.000Z",
  joueurs: noms,
  joueursId: ids,
  parDonne: 5,
  nbDonnes: donnes.length,
  totaux: [0, 0, 0, 0, 0],
};
const archive: ArchiveRecord = { joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes, annulations: [] };
const parties: PartieAnalysee[] = [{ archiveId: "p1", date: entree.date, joueursId: ids, donnes }];

describe("Badges du classement général", () => {
  it("décerne les badges entre tous les joueurs du classement, avec un repère sur chaque ligne", async () => {
    window.storage.__seed!("tarot:joueurs:v2", roster);
    window.storage.__seed!("tarot:historique", [entree]);
    window.storage.__seed!(cleArchive("p1"), archive);
    const attendus = attribuerBadges(ids, parties, roster);
    expect(attendus.length).toBeGreaterThan(0);

    render(
      <MemoryRouter initialEntries={["/classement"]}>
        <App />
      </MemoryRouter>
    );
    const section = (await screen.findByText("Badges (entre tous les joueurs)")).parentElement as HTMLElement;
    expect(within(section).getAllByTestId("badge")).toHaveLength(attendus.length);

    const premier = attendus[0];
    const ligne = screen.getAllByTestId("classement-row").find((l) => l.textContent?.includes(noms[ids.indexOf(premier.joueurId)]));
    expect(ligne?.textContent).toContain(BADGES[premier.badge].emoji);
  });
});
