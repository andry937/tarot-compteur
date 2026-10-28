import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import type { Fiche } from "@/domain/joueurs/identite";
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import { cleTable, CLE_PARTIE } from "@/lib/storage/stockage";

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

const rosterComplet: Fiche[] = [
  fiche("a", "Andry"),
  fiche("b", "Bob"),
  fiche("c", "Chloé"),
  fiche("d", "Denis"),
  fiche("e", "Eva"),
  fiche("f", "Fara"),
  fiche("g", "Gina"),
  fiche("h", "Hugo"),
];

const tableA: { entree: HistoriqueEntree; record: ArchiveRecord } = {
  entree: {
    id: "tA",
    date: "2026-02-01T00:00:00.000Z",
    joueurs: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
    joueursId: ["a", "b", "c", "d", "e"],
    parDonne: 5,
    nbDonnes: 0,
    totaux: [0, 0, 0, 0, 0],
  },
  record: {
    joueursId: ["a", "b", "c", "d", "e"],
    joueursNomFige: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
    parDonne: 5,
    depart: 0,
    donnes: [],
    annulations: [],
  },
};

const tableB: { entree: HistoriqueEntree; record: ArchiveRecord } = {
  entree: {
    id: "tB",
    date: "2026-02-02T00:00:00.000Z",
    joueurs: ["Fara", "Gina", "Hugo"],
    joueursId: ["f", "g", "h"],
    parDonne: 3,
    nbDonnes: 0,
    totaux: [0, 0, 0],
  },
  record: {
    joueursId: ["f", "g", "h"],
    joueursNomFige: ["Fara", "Gina", "Hugo"],
    parDonne: 3,
    depart: 0,
    donnes: [],
    annulations: [],
  },
};

function preseeder(tables: Array<{ entree: HistoriqueEntree; record: ArchiveRecord }>) {
  window.storage.__seed!("tarot:joueurs:v2", rosterComplet);
  window.storage.__seed!("tarot:historique", []);
  window.storage.__seed!("tarot:tables", tables.map((t) => t.entree));
  tables.forEach((t) => window.storage.__seed!(cleTable(t.entree.id), t.record));
}

describe("Plusieurs tables ouvertes en même temps", () => {
  it("liste les tables ouvertes sur l'accueil et garde chacune isolée des autres", async () => {
    preseeder([tableA, tableB]);

    const u = userEvent.setup();
    const { unmount } = renderApp();
    await screen.findByText("Feuille de marque");

    const lignes = screen.getAllByTestId("table-row");
    expect(lignes).toHaveLength(2);
    expect(screen.getByText("Andry, Bob, Chloé, Denis, Eva")).toBeInTheDocument();
    expect(screen.getByText("Fara, Gina, Hugo")).toBeInTheDocument();

    // Ouvrir la table A et y noter une donne.
    await u.click(screen.getByText("Andry, Bob, Chloé, Denis, Eva"));
    await screen.findByText(/Noter la donne 1/);
    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    unmount();

    // Un nouvel onglet (re-render depuis le stockage partagé) : la table B
    // n'a pas bougé, la table A reflète bien sa nouvelle donne.
    renderApp();
    await screen.findByText("Feuille de marque");
    const lignesApres = screen.getAllByTestId("table-row");
    expect(lignesApres).toHaveLength(2);
    const ligneA = screen.getByText("Andry, Bob, Chloé, Denis, Eva").closest('[data-testid="table-row"]') as HTMLElement;
    const ligneB = screen.getByText("Fara, Gina, Hugo").closest('[data-testid="table-row"]') as HTMLElement;
    expect(within(ligneA).getByText("1 donnes")).toBeInTheDocument();
    expect(within(ligneB).getByText("0 donnes")).toBeInTheDocument();
  }, 15000);

  it("bloque la composition d'une nouvelle table avec un joueur déjà assis ailleurs", async () => {
    preseeder([tableA]);

    const u = userEvent.setup();
    renderApp(["/composition"]);
    await screen.findByText("Composer la table");

    await u.type(screen.getByPlaceholderText("Joueur 1"), "Andry"); // déjà assis à la table A
    await u.type(screen.getByPlaceholderText("Joueur 2"), "Fara");
    await u.type(screen.getByPlaceholderText("Joueur 3"), "Lian");
    await u.type(screen.getByPlaceholderText("Joueur 4"), "Marc");
    await u.type(screen.getByPlaceholderText("Joueur 5"), "Nina");

    expect(screen.getByText("Joue déjà à une autre table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Un joueur est déjà à une autre table" })).toBeDisabled();
  });

  it("fermer une table n'affecte pas les autres tables ouvertes", async () => {
    preseeder([tableA, tableB]);

    const u = userEvent.setup();
    renderApp(["/partie/tA"]);
    await screen.findByText(/Noter la donne 1/);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    await u.click(screen.getByRole("button", { name: "Clôturer" }));
    await u.click(screen.getByRole("button", { name: "Confirmer ?" }));

    // De retour à la liste : table A archivée et disparue, table B toujours ouverte.
    await screen.findByText("Feuille de marque");
    expect(screen.queryByText("Andry, Bob, Chloé, Denis, Eva")).not.toBeInTheDocument();
    expect(screen.getByText("Fara, Gina, Hugo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Historique \(1\)/ })).toBeInTheDocument();
  }, 15000);

  it("Rejouer clôture la table A puis ouvre la composition avec les mêmes joueurs", async () => {
    preseeder([tableA, tableB]);

    const u = userEvent.setup();
    renderApp(["/partie/tA"]);
    await screen.findByText(/Noter la donne 1/);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    await u.click(screen.getByRole("button", { name: "Rejouer" }));
    await u.click(screen.getByRole("button", { name: "Confirmer ?" }));

    await screen.findByText("Composer la table");
    const champs = screen.getAllByTestId("champ-nom").map((c) => c.querySelector("input")!.value);
    expect(champs).toEqual(["Andry", "Bob", "Chloé", "Denis", "Eva"]);
    // La table A est close : ses joueurs ne sont plus « déjà assis ailleurs ».
    expect(screen.getByRole("button", { name: "Désigner le donneur" })).toBeEnabled();
  }, 15000);

  it("Changer l'ordre des joueurs garde le donneur et le classement", async () => {
    preseeder([tableA]);

    const u = userEvent.setup();
    renderApp(["/partie/tA"]);
    await screen.findByText(/Noter la donne 1/);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    const donneur = () => screen.getByText(/distribue/).querySelector("b")!.textContent;
    const avant = donneur();
    const classementAvant = screen.getAllByTestId("classement-row").map((r) => r.textContent);

    await u.click(screen.getByText("Changer l'ordre des joueurs"));
    const panneau = screen.getByTestId("changer-ordre");
    await u.click(within(panneau).getByRole("button", { name: /Descendre Andry/ }));
    await u.click(within(panneau).getByRole("button", { name: "Appliquer l'ordre" }));

    expect(screen.queryByTestId("changer-ordre")).not.toBeInTheDocument();
    expect(donneur()).toBe(avant);
    expect(screen.getAllByTestId("classement-row").map((r) => r.textContent)).toEqual(classementAvant);
  }, 15000);

  it("Accueil laisse la table A ouverte sans toucher la table B", async () => {
    preseeder([tableA, tableB]);

    const u = userEvent.setup();
    renderApp(["/partie/tA"]);
    await screen.findByText(/Noter la donne 1/);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    // "Accueil" : un seul clic, aucune confirmation, rien n'est supprimé.
    await u.click(screen.getByRole("button", { name: "Accueil" }));

    await screen.findByText("Feuille de marque");
    const lignes = screen.getAllByTestId("table-row");
    expect(lignes).toHaveLength(2);
    const ligneA = screen.getByText("Andry, Bob, Chloé, Denis, Eva").closest('[data-testid="table-row"]') as HTMLElement;
    expect(within(ligneA).getByText("1 donnes")).toBeInTheDocument();
    expect(screen.getByText("Fara, Gina, Hugo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Historique \(/ })).not.toBeInTheDocument();
  }, 15000);

  it("migre l'ancienne partie unique (legacy) en table ouverte au démarrage", async () => {
    window.storage.__seed!("tarot:joueurs:v2", rosterComplet);
    window.storage.__seed!("tarot:historique", []);
    window.storage.__seed!(CLE_PARTIE, {
      joueursId: ["a", "b", "c", "d", "e"],
      joueursNomFige: ["Andry", "Bob", "Chloé", "Denis", "Eva"],
      parDonne: 5,
      depart: 0,
      donnes: [],
      annulations: [],
    });

    renderApp();
    await screen.findByText("Feuille de marque");

    const lignes = screen.getAllByTestId("table-row");
    expect(lignes).toHaveLength(1);
    expect(screen.getByText("Andry, Bob, Chloé, Denis, Eva")).toBeInTheDocument();

    const dump = window.storage.__dump!();
    expect(Object.keys(dump)).not.toContain(CLE_PARTIE);
  });
});
