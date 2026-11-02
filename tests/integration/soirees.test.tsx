import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
const donne = (preneur: number): Donne => ({
  table: [0, 1, 2, 3, 4],
  preneur,
  appele: (preneur + 1) % 5,
  contrat: "garde",
  bouts: 2,
  points: 60,
  petitAuBout: "aucun",
  chelem: "aucun",
  miseres: [],
  roiAppele: "coeur",
});
const heure = 60 * 60 * 1000;
const maintenant = Date.now();

/** Trois parties : deux à 3 h d'écart (une soirée), une trois jours plus tôt (une autre soirée). */
function monter(chemin: string) {
  const specs = [
    { id: "p1", date: new Date(maintenant - 3 * heure).toISOString(), donnes: [donne(0), donne(0)] },
    { id: "p2", date: new Date(maintenant).toISOString(), donnes: [donne(0)] },
    { id: "p0", date: new Date(maintenant - 72 * heure).toISOString(), donnes: [donne(1)] },
  ];
  const index: HistoriqueEntree[] = specs.map((s) => ({
    id: s.id,
    date: s.date,
    joueurs: noms,
    joueursId: ids,
    parDonne: 5,
    nbDonnes: s.donnes.length,
    totaux: [0, 0, 0, 0, 0],
  }));
  window.storage.__seed!("tarot:joueurs:v2", roster);
  window.storage.__seed!("tarot:historique", index);
  for (const s of specs) {
    const record: ArchiveRecord = { joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes: s.donnes, annulations: [] };
    window.storage.__seed!(cleArchive(s.id), record);
  }
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
    </MemoryRouter>
  );
}

describe("Classement par soirée", () => {
  it("additionne les parties jouées à moins de 24 h et laisse l'autre soirée à part", async () => {
    monter("/classement");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Soirée" }));

    expect(await screen.findByTestId("soiree-courante")).toHaveTextContent("2 parties");
    const lignes = await screen.findAllByTestId("soiree-row");
    expect(lignes).toHaveLength(5);
    // Andry a pris les trois donnes de la soirée et les a réussies : il est premier.
    expect(lignes[0]).toHaveTextContent("Andry");
    expect(lignes[0]).toHaveTextContent("3 donnes");

    await u.click(screen.getByRole("button", { name: "Soirée précédente" }));
    expect(screen.getByTestId("soiree-courante")).toHaveTextContent("1 partie");
    expect((await screen.findAllByTestId("soiree-row"))[0]).toHaveTextContent("Bob");
  });

  it("l'annonce de fin de partie ajoute la cérémonie de la soirée quand elle compte plusieurs parties", async () => {
    monter("/historique/p2");
    const u = userEvent.setup();
    await screen.findByText("Classement final");
    await u.click(screen.getByRole("button", { name: "Revoir l'annonce" }));

    const soiree = await screen.findByTestId("annonce-soiree");
    expect(soiree).toHaveTextContent("Andry gagne la soirée");
    expect(soiree).toHaveTextContent("2 parties");
    expect(screen.getByTestId("annonce-soiree-podium")).toBeInTheDocument();
  }, 15000);

  it("n'ajoute pas de cérémonie de soirée quand la partie est seule", async () => {
    monter("/historique/p0");
    const u = userEvent.setup();
    await screen.findByText("Classement final");
    await u.click(screen.getByRole("button", { name: "Revoir l'annonce" }));

    await screen.findByTestId("annonce-vainqueur");
    // Laisse l'effet de chargement des archives se terminer avant de constater l'absence.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(screen.queryByTestId("annonce-soiree")).not.toBeInTheDocument();
  }, 15000);

  it("le bouton de l'onglet Soirée lance l'animation de la soirée seule, puis revient sur l'onglet", async () => {
    monter("/classement");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Soirée" }));
    await u.click(await screen.findByRole("button", { name: /Remise des prix de la soirée/ }));

    const soiree = await screen.findByTestId("annonce-soiree");
    expect(soiree).toHaveTextContent("Andry gagne la soirée");
    expect(screen.getByTestId("annonce-soiree-podium")).toBeInTheDocument();
    // Seule la cérémonie de la soirée est jouée : pas celle de la partie.
    expect(screen.queryByTestId("annonce-vainqueur")).not.toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByTestId("soiree-courante")).toBeInTheDocument();
  }, 15000);

  it("ajoute les badges de la soirée à la cérémonie, sans « Recrue »", async () => {
    // Andry prend 40 Garde contre réussies, Bob 20 Petites qui chutent, répartis sur deux parties de la même soirée.
    const gc = (): Donne => ({ ...donne(0), appele: 2, contrat: "garde_contre", points: 70 });
    const pc = (): Donne => ({ ...donne(1), appele: 3, contrat: "petite", points: 30 });
    const moitie = [...Array.from({ length: 20 }, gc), ...Array.from({ length: 10 }, pc)];
    const specs = [
      { id: "b1", date: new Date(maintenant - 3 * heure).toISOString(), donnes: moitie },
      { id: "b2", date: new Date(maintenant).toISOString(), donnes: moitie },
    ];
    const index: HistoriqueEntree[] = specs.map((sp) => ({
      id: sp.id, date: sp.date, joueurs: noms, joueursId: ids, parDonne: 5, nbDonnes: sp.donnes.length, totaux: [0, 0, 0, 0, 0],
    }));
    window.storage.__seed!("tarot:joueurs:v2", roster);
    window.storage.__seed!("tarot:historique", index);
    for (const sp of specs) {
      const record: ArchiveRecord = { joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes: sp.donnes, annulations: [] };
      window.storage.__seed!(cleArchive(sp.id), record);
    }
    render(
      <MemoryRouter initialEntries={["/historique/b2"]}>
        <App />
      </MemoryRouter>
    );
    const u = userEvent.setup();
    await screen.findByText("Classement final");
    await u.click(screen.getByRole("button", { name: "Revoir l'annonce" }));

    const bloc = await screen.findByTestId("annonce-soiree-badges");
    expect(bloc).toHaveTextContent("Badges de la soirée");
    expect(bloc.querySelectorAll('[data-testid="badge"]').length).toBeGreaterThan(0);
    expect(bloc).not.toHaveTextContent("Recrue");
  }, 15000);
});
