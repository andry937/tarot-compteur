import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import type { Fiche } from "@/domain/joueurs/identite";
import type { Donne } from "@/domain/score/regles";
import { resumerDonnees } from "@/domain/score/regles";
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import { cleArchive } from "@/lib/storage/stockage";

function renderApp(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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

const joueursId = ["a", "b", "c", "d", "e"];
const archiveId = "p1";

const donneInitiale: Donne = {
  table: [0, 1, 2, 3, 4],
  preneur: 0,
  appele: null,
  roiAppele: "coeur",
  contrat: "garde",
  bouts: 1,
  points: 60, // seuil 51, réussi
  petitAuBout: "aucun",
  chelem: "aucun",
  miseres: [],
};

const { totaux: totauxInitiaux } = resumerDonnees([donneInitiale], 5);

const historique: HistoriqueEntree[] = [
  {
    id: archiveId,
    date: "2026-02-01T00:00:00.000Z",
    joueurs: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
    joueursId,
    parDonne: 5,
    nbDonnes: 1,
    totaux: totauxInitiaux,
  },
];

const archive: ArchiveRecord = {
  joueursId,
  joueursNomFige: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
  parDonne: 5,
  depart: 0,
  donnes: [donneInitiale],
  annulations: [],
};

function preseeder() {
  window.storage.__seed!("tarot:joueurs:v2", roster);
  window.storage.__seed!("tarot:historique", historique);
  window.storage.__seed!("tarot:tables", []);
  window.storage.__seed!(cleArchive(archiveId), archive);
}

describe("Modification d'une donne archivée", () => {
  it("modifie une donne d'une partie close, recalcule les totaux et les persiste", async () => {
    preseeder();
    const u = userEvent.setup();
    const { unmount } = renderApp([`/historique/${archiveId}`]);

    await screen.findByText("Classement final");
    let totaux = screen.getAllByTestId("score-total").map((el) => el.textContent);
    expect(totaux).toEqual(["272", "-68", "-68", "-68", "-68"]);

    // Ouvrir le détail de la donne 1, puis "Modifier cette donne".
    const table = document.querySelector("table") as HTMLElement;
    await u.click(within(table).getByText("1").closest("tr") as HTMLElement);
    await u.click(screen.getByRole("button", { name: "Modifier cette donne" }));

    await screen.findByText("Donne 1");
    // Fait chuter le contrat (points sous le seuil de 51) et valide.
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    // Affichage immédiat : seuil 51, points 30 -> écart 21, base -92 ;
    // preneur seul = 4×-92 = -368, chacun des 4 autres +92.
    totaux = screen.getAllByTestId("score-total").map((el) => el.textContent);
    expect(totaux).toEqual(["-368", "92", "92", "92", "92"]);

    unmount();

    // Un nouveau montage depuis le stockage partagé confirme la persistance.
    renderApp([`/historique/${archiveId}`]);
    await screen.findByText("Classement final");
    totaux = screen.getAllByTestId("score-total").map((el) => el.textContent);
    expect(totaux).toEqual(["-368", "92", "92", "92", "92"]);
  }, 15000);

  it("resynchronise le résumé affiché dans la liste de l'historique", async () => {
    preseeder();
    const u = userEvent.setup();
    renderApp([`/historique/${archiveId}`]);

    await screen.findByText("Classement final");
    const table = document.querySelector("table") as HTMLElement;
    await u.click(within(table).getByText("1").closest("tr") as HTMLElement);
    await u.click(screen.getByRole("button", { name: "Modifier cette donne" }));
    await screen.findByText("Donne 1");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    await u.click(screen.getByRole("button", { name: "Retour" }));
    await screen.findByText("Historique");
    const ligne = screen.getByTestId("archive-row");
    expect(ligne).toHaveTextContent("+92");
  }, 15000);
});

describe("Archive illisible", () => {
  const entree: HistoriqueEntree = {
    id: archiveId,
    date: "2026-03-01T00:00:00.000Z",
    joueurs: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
    joueursId,
    parDonne: 5,
    nbDonnes: 1,
    totaux: [0, 0, 0, 0, 0],
  };

  it("affiche un message au lieu d'une page vide quand l'archive est absente", async () => {
    window.storage.__seed!("tarot:joueurs:v2", roster);
    window.storage.__seed!("tarot:historique", [entree]); // l'index existe, pas le document
    renderApp([`/historique/${archiveId}`]);
    expect(await screen.findByRole("alert")).toHaveTextContent("n'existe pas");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("affiche la cause quand la lecture échoue, et Réessayer recharge l'archive", async () => {
    window.storage.__seed!("tarot:joueurs:v2", roster);
    window.storage.__seed!("tarot:historique", [entree]);
    window.storage.__seed!(cleArchive(archiveId), {
      joueursId,
      joueursNomFige: entree.joueurs,
      parDonne: 5,
      depart: 0,
      donnes: [],
      annulations: [],
    });
    const lire = window.storage.get;
    let echecs = 1;
    window.storage.get = async (key) => {
      if (key === cleArchive(archiveId) && echecs-- > 0) throw new Error("délai Firestore dépassé");
      return lire(key);
    };
    renderApp([`/historique/${archiveId}`]);
    expect(await screen.findByRole("alert")).toHaveTextContent("délai Firestore dépassé");
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Classement final")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
