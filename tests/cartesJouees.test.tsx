import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import type { ArchiveRecord, HistoriqueEntree } from "../src/types";
import { cleTable } from "../src/lib/stockage";
import { toutesLesCartes } from "../src/utils/cartes";

const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];
const ids = ["a", "b", "c", "d", "e"];

const entree: HistoriqueEntree = {
  id: "tA", date: "2026-02-01T00:00:00.000Z", joueurs: noms, joueursId: ids,
  parDonne: 5, nbDonnes: 0, totaux: [0, 0, 0, 0, 0],
};
const record: ArchiveRecord = {
  joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes: [], annulations: [],
};

function seed(rec: ArchiveRecord = record) {
  window.storage.__seed!("tarot:joueurs:v2", ids.map((id, i) => ({
    id, nom: noms[i], creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null,
  })));
  window.storage.__seed!("tarot:historique", []);
  window.storage.__seed!("tarot:tables", [entree]);
  window.storage.__seed!(cleTable("tA"), rec);
}

const rendre = (route: string) =>
  render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);

const carte = (id: string) => document.querySelector(`[data-carte="${id}"]`) as HTMLElement;
const lire = () => JSON.parse(window.storage.__dump!()[cleTable("tA")]) as ArchiveRecord;

/** Feuille → « Noter la donne N » → bouton « Cartes jouées » du formulaire. */
async function ouvrirCartes(u: ReturnType<typeof userEvent.setup>, n = 1) {
  await u.click(await screen.findByRole("button", { name: new RegExp(`Noter la donne ${n}`) }));
  await u.click(screen.getByTestId("ouvrir-cartes"));
  await screen.findByText("Cartes jouées", { selector: "h1" });
}

describe("Carnet des cartes jouées (dans « Inscrire la donne »)", () => {
  it("déduit le joueur à jouer et le gagnant du pli, grise les cartes tombées", async () => {
    seed();
    const u = userEvent.setup();
    rendre("/partie/tA");
    await ouvrirCartes(u);

    // Donneur Andry → Bob entame.
    expect(screen.getByTestId("a-qui-de-jouer")).toHaveTextContent("C'est à Bob de jouer");
    for (const c of ["atout-5", "coeur-14", "atout-12", "excuse", "atout-3"]) await u.click(carte(c));

    expect(carte("atout-12")).toBeDisabled();
    expect(screen.getByTestId("atouts-restants")).toHaveTextContent("18"); // 22 − 3 atouts − Excuse
    expect(screen.getByTestId("a-qui-de-jouer")).toHaveTextContent("C'est à Denis de jouer");
    expect(within(screen.getByTestId("journal-plis")).getByTestId("pli")).toHaveTextContent("→ Denis");

    await u.click(screen.getByRole("button", { name: "Annuler la dernière carte" }));
    expect(carte("atout-3")).not.toBeDisabled();
    expect(screen.getByTestId("a-qui-de-jouer")).toHaveTextContent("C'est à Andry de jouer");
  });

  it("garde le brouillon à la fermeture, puis l'archive avec la donne inscrite", async () => {
    seed();
    const u = userEvent.setup();
    const { unmount } = rendre("/partie/tA");
    await ouvrirCartes(u);
    await u.click(carte("atout-21"));
    await u.click(carte("excuse"));
    await u.click(screen.getByRole("button", { name: "Retour à la donne" }));
    expect(screen.getByTestId("ouvrir-cartes")).toHaveTextContent("Cartes jouées (2)");
    await u.click(screen.getByRole("button", { name: "Fermer" }));
    await vi.waitFor(() => expect(lire().cartesEnCours).toEqual(["atout-21", "excuse"]));
    unmount();

    // Rechargement : les cartes reviennent depuis le stockage.
    rendre("/partie/tA");
    await ouvrirCartes(u);
    expect(carte("atout-21")).toBeDisabled();
    await u.click(screen.getByRole("button", { name: "Retour à la donne" }));

    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    const sauve = lire();
    expect(sauve.cartesEnCours).toEqual([]);
    expect(sauve.donnes[0].cartesJouees).toEqual(["atout-21", "excuse"]);

    // Visible dans le détail de la donne.
    const grille = document.querySelector("table") as HTMLElement;
    await u.click(within(grille).getByText("1").closest("tr") as HTMLElement);
    await u.click(screen.getByText(/^Cartes jouées \(2\)$/));
    expect(screen.getAllByTestId("pli")[0]).toHaveTextContent("Bob XXI");
    expect(screen.getAllByTestId("pli")[0]).toHaveTextContent("Chloé Exc.");
  });

  it("note le chien (3 cartes à 5 joueurs) puis le rattache à la donne", async () => {
    seed();
    const u = userEvent.setup();
    rendre("/partie/tA");
    await ouvrirCartes(u);

    await u.click(screen.getByRole("button", { name: /Chien \(0\/3\)/ }));
    expect(screen.getByTestId("aide-chien")).toHaveTextContent("3 cartes");
    for (const c of ["atout-1", "coeur-14", "pique-3"]) await u.click(carte(c));
    expect(carte("trefle-2")).toBeDisabled(); // plafonné à la taille du chien
    await u.click(carte("pique-3")); // retouchée : retirée
    expect(screen.getByRole("button", { name: /Chien \(2\/3\)/ })).toBeInTheDocument();
    await u.click(carte("trefle-2"));
    expect(screen.getByTestId("chien-vu")).toHaveTextContent(/I · Roi de cœur · 2 de trèfle/);

    await u.click(screen.getByRole("button", { name: "Retour à la donne" }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);
    const sauve = lire();
    expect(sauve.donnes[0].chien).toEqual(["atout-1", "coeur-14", "trefle-2"]);
    expect(sauve.chienEnCours).toEqual([]);
  });

  it("corrige les cartes d'une donne déjà inscrite via « Modifier cette donne », sans toucher au score", async () => {
    seed();
    const u = userEvent.setup();
    rendre("/partie/tA");
    await u.click(await screen.findByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);
    const totauxAvant = screen.getAllByTestId("score-total").map((el) => el.textContent);

    const ouvrirModification = async () => {
      if (!screen.queryByRole("button", { name: "Modifier cette donne" })) {
        const grille = document.querySelector("table") as HTMLElement;
        await u.click(within(grille).getByText("1").closest("tr") as HTMLElement);
      }
      await u.click(screen.getByRole("button", { name: "Modifier cette donne" }));
      await u.click(screen.getByTestId("ouvrir-cartes"));
    };

    await ouvrirModification();
    await u.click(carte("atout-9"));
    await u.click(carte("pique-4"));
    await u.click(screen.getByRole("button", { name: "Retour à la donne" }));
    await u.click(screen.getByRole("button", { name: "Fermer" })); // abandon : rien d'enregistré
    expect(lire().donnes[0].cartesJouees).toBeUndefined();

    await ouvrirModification();
    await u.click(carte("atout-9"));
    await u.click(carte("pique-4"));
    await u.click(screen.getByRole("button", { name: "Retour à la donne" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText(/Noter la donne 2/);

    expect(lire().donnes[0].cartesJouees).toEqual(["atout-9", "pique-4"]);
    expect(screen.getAllByTestId("score-total").map((el) => el.textContent)).toEqual(totauxAvant);
  });

  it("modifie les cartes d'une donne d'une partie archivée et les persiste", async () => {
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
    await u.click(screen.getByRole("button", { name: "Modifier cette donne" }));
    await u.click(screen.getByTestId("ouvrir-cartes"));
    await u.click(carte("atout-21"));
    await u.click(screen.getByRole("button", { name: "Retour à la donne" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));
    await screen.findByText("Classement final");
    await vi.waitFor(() => {
      const a = JSON.parse(window.storage.__dump!()["tarot:archive:p1"]) as ArchiveRecord;
      expect(a.donnes[0].cartesJouees).toEqual(["atout-21"]);
    });
  });

  it("propose les points de l'attaque déduits d'une main complète et les applique", async () => {
    // Écart du preneur (Andry) = 3 cartes à 0,5 pt jamais jouées ; 15 plis complets.
    const ecart = ["pique-2", "pique-3", "trefle-2"];
    const cartes = toutesLesCartes().filter((c) => !ecart.includes(c));
    seed({ ...record, cartesEnCours: cartes });
    const u = userEvent.setup();
    rendre("/partie/tA");
    await u.click(await screen.findByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));

    const bloc = screen.getByTestId("deduction");
    expect(bloc).toHaveTextContent("Déduit des cartes notées");
    expect(bloc).toHaveTextContent(/L'attaque a [\d.]+ pts/);
    await u.click(within(bloc).getByRole("button", { name: "Utiliser ces valeurs" }));
    // Le curseur reflète désormais les points déduits (et « défense » = 91 − points).
    const pts = Number(/L'attaque a ([\d.]+) pts/.exec(bloc.textContent!)![1]);
    expect(screen.getByText(`sur 91 · défense ${91 - pts}`)).toBeInTheDocument();
  });

  it("n'affiche aucune déduction tant qu'aucune carte n'est notée, et signale une main incomplète", async () => {
    seed();
    const u = userEvent.setup();
    rendre("/partie/tA");
    await u.click(await screen.findByRole("button", { name: /Noter la donne 1/ }));
    expect(screen.queryByTestId("deduction")).not.toBeInTheDocument();
    await u.click(screen.getByTestId("ouvrir-cartes"));
    await u.click(carte("atout-9"));
    await u.click(screen.getByRole("button", { name: "Retour à la donne" }));
    expect(screen.getByTestId("deduction")).toHaveTextContent(/Main incomplète/);
    expect(screen.queryByRole("button", { name: "Utiliser ces valeurs" })).not.toBeInTheDocument();
  });
});
