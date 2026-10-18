import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import type { Fiche } from "@/domain/joueurs/identite";
import type { Donne } from "@/domain/score/regles";
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import type { PartieAnalysee } from "@/domain/stats/stats";
import { calculerClassementElo } from "@/domain/stats/elo";
import { cleArchive } from "@/lib/storage/stockage";

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
}

const fiche = (id: string, nom: string, extra: Partial<Fiche> = {}): Fiche => ({
  id,
  nom,
  creee: "2026-01-01T00:00:00.000Z",
  actif: true,
  redirigeVers: null,
  ...extra,
});

const roster: Fiche[] = [
  fiche("a", "Andry"),
  fiche("b", "Bob"),
  fiche("c", "Chloé"),
  fiche("d", "Denis"),
  fiche("e", "Eva"),
];

const donne: Donne = {
  table: [0, 1, 2, 3, 4],
  preneur: 0,
  appele: null,
  contrat: "garde",
  bouts: 0,
  points: 51,
  petitAuBout: "aucun",
  chelem: "aucun",
  miseres: [],
};

const archiveId = "p1";
const joueursId = ["a", "b", "c", "d", "e"];

const historique: HistoriqueEntree[] = [
  {
    id: archiveId,
    date: "2026-02-01T00:00:00.000Z",
    joueurs: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
    joueursId,
    parDonne: 5,
    nbDonnes: 1,
    totaux: [200, -50, -50, -50, -50],
  },
];

const archive: ArchiveRecord = {
  joueursId,
  joueursNomFige: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
  parDonne: 5,
  depart: 0,
  donnes: [donne],
  annulations: [],
};

function preseeder() {
  window.storage.__seed!("tarot:joueurs:v2", roster);
  window.storage.__seed!("tarot:historique", historique);
  window.storage.__seed!(cleArchive(archiveId), archive);
}

const parties: PartieAnalysee[] = [
  { archiveId, date: historique[0].date, joueursId, donnes: [donne] },
];
const eloAttendu = calculerClassementElo(parties, roster).find((c) => c.id === "a")!;

describe("Explication et affichage du classement", () => {
  it("affiche le bloc d'explication sur /classement", async () => {
    preseeder();
    const u = userEvent.setup();
    renderApp();
    await screen.findByText("Feuille de marque");

    await u.click(screen.getByRole("link", { name: "Classement" }));
    await screen.findByText("Comment fonctionne le classement");
  });

  it("affiche la note du joueur et le bloc d'explication sur sa fiche", async () => {
    preseeder();
    const u = userEvent.setup();
    renderApp();
    await screen.findByText("Feuille de marque");

    await u.click(screen.getByRole("link", { name: /Joueurs \(5\)/ }));
    await screen.findByRole("heading", { name: "Joueurs" });
    const ligneAndry = screen.getByText("Andry").closest('[data-testid="roster-row"]') as HTMLElement;
    await u.click(within(ligneAndry).getByRole("link", { name: "Stats" }));

    await screen.findByRole("heading", { name: "Andry" });
    const ligne = (await screen.findByText("Note actuelle")).parentElement as HTMLElement;
    expect(within(ligne).getByText(String(eloAttendu.note))).toBeInTheDocument();
    expect(screen.getByText("Comment fonctionne le classement")).toBeInTheDocument();
  });
});
