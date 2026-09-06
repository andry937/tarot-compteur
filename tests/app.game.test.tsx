import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

/** Amène l'app jusqu'à l'écran de composition de la table, prêt à saisir les noms. */
async function ouvrirSetup(): Promise<UserEvent> {
  const utilisateur = userEvent.setup();
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  await screen.findByText("Feuille de marque");
  await utilisateur.click(screen.getByRole("button", { name: "Nouvelle table" }));
  await screen.findByText("Composer la table");
  return utilisateur;
}

/** Remplit les 5 sièges (le 1er avec "Andry", les suivants avec les noms donnés). */
async function remplirSieges(utilisateur: UserEvent, noms: string[]) {
  await utilisateur.type(screen.getByPlaceholderText("Joueur 1"), "Andry");
  for (let i = 0; i < noms.length; i++) {
    const champ = screen.getByPlaceholderText(`Joueur ${i + 2}`);
    await utilisateur.type(champ, noms[i]);
  }
}

/** Valide le setup, passe le tirage en désignation manuelle sur le 1er joueur, ouvre la feuille. */
async function lancerPartieJusquaLaFeuille(utilisateur: UserEvent) {
  await utilisateur.click(screen.getByRole("button", { name: "Tirer qui distribue" }));
  await screen.findByText(/Désigner à la main/);
  await utilisateur.click(screen.getByText("Désigner à la main"));
  const chips = screen.getAllByRole("button", { name: "Andry" });
  await utilisateur.click(chips[chips.length - 1]); // le chip de sélection, pas un doublon éventuel
  await utilisateur.click(screen.getByRole("button", { name: "Ouvrir la feuille" }));
  await screen.findByText(/Noter la donne 1/);
}

describe("Parcours d'une partie de bout en bout", () => {
  it("setup : le bouton reste bloqué tant qu'un siège est vide ou en doublon", async () => {
    const u = await ouvrirSetup();
    const bouton = screen.getByRole("button", { name: /joueur.*à nommer/i });
    expect(bouton).toBeDisabled();

    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    expect(screen.getByRole("button", { name: "Tirer qui distribue" })).toBeEnabled();

    // un doublon (même nom qu'un siège existant) rebloque le bouton
    const dernierChamp = screen.getByPlaceholderText("Joueur 5");
    await u.clear(dernierChamp);
    await u.type(dernierChamp, "Fara");
    expect(screen.getByRole("button", { name: /même nom/i })).toBeDisabled();
  });

  it("saisit une donne simple et met à jour les totaux", async () => {
    const u = await ouvrirSetup();
    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    await lancerPartieJusquaLaFeuille(u);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    // Valeurs par défaut de la saisie : garde, seuil 51, points 51 -> réussi, écart 0, base 50
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    const totaux = screen.getAllByTestId("score-total").map((el) => el.textContent);
    // Andry (preneur, 4 défenseurs) : (5-1)*50 = 200, chacun des 4 autres -50
    expect(totaux).toEqual(["200", "-50", "-50", "-50", "-50"]);
  });

  it("une misère fait payer 10 points par les autres joueurs, y compris les coéquipiers", async () => {
    const u = await ouvrirSetup();
    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    await lancerPartieJusquaLaFeuille(u);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByText("+ Ajouter une misère"));

    // Le joueur par défaut de la nouvelle entrée est le 1er de la table (Andry) ;
    // on cible Fara à la place pour tester un défenseur en misère.
    const chipsFara = screen.getAllByRole("button", { name: "Fara" });
    await u.click(chipsFara[chipsFara.length - 1]);
    await u.click(screen.getByRole("button", { name: "Pas d'atout" }));

    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    const totaux = screen.getAllByTestId("score-total").map((el) => el.textContent);
    // Sans misère : [200,-50,-50,-50,-50]. À 5 joueurs, Fara (index 1) reçoit
    // 10×(n-1)=40 au total, chacun des 4 autres paie 10.
    expect(totaux).toEqual(["190", "-10", "-60", "-60", "-60"]);
    expect(totaux.reduce((a, b) => a + Number(b), 0)).toBe(0);
  });

  it("le Petit sec annule la donne sans toucher au score ni à la rotation", async () => {
    const u = await ouvrirSetup();
    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    await lancerPartieJusquaLaFeuille(u);

    await u.click(screen.getByText("Petit sec ? Annuler la donne"));
    const chipsLian = screen.getAllByRole("button", { name: "Lian" });
    await u.click(chipsLian[chipsLian.length - 1]);
    await u.click(screen.getByRole("button", { name: "Confirmer la redistribution" }));

    // Toujours "Donne 1" à saisir : aucune ligne n'a été ajoutée
    expect(screen.getByText(/Noter la donne 1/)).toBeInTheDocument();
    expect(screen.getByText(/Avant la donne 1 — Petit sec de Lian, redonne\./)).toBeInTheDocument();
  });

  it("archive une partie close et la retrouve dans l'historique avec le bon classement", async () => {
    const u = await ouvrirSetup();
    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    await lancerPartieJusquaLaFeuille(u);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    // "Nouvelle" -> confirmation -> clôture
    await u.click(screen.getByRole("button", { name: "Nouvelle" }));
    await u.click(screen.getByRole("button", { name: "Confirmer ?" }));

    // De retour à la liste des tables, l'historique affiche 1 partie
    await screen.findByRole("link", { name: /Historique \(1\)/ });
    await u.click(screen.getByRole("link", { name: /Historique \(1\)/ }));

    await u.click(await screen.findByTestId("archive-row"));

    await screen.findByText("Classement final");
    const lignesClassement = screen.getAllByTestId("classement-row");
    expect(lignesClassement).toHaveLength(5);
    const premiere = within(lignesClassement[0]);
    expect(premiere.getByText("Andry")).toBeInTheDocument();
    expect(premiere.getByText("200")).toBeInTheDocument();
  }, 15000);

  it("Accueil quitte la partie en cours sans l'archiver dans l'historique", async () => {
    const u = await ouvrirSetup();
    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    await lancerPartieJusquaLaFeuille(u);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    // "Accueil" -> confirmation -> abandon sans archivage
    await u.click(screen.getByRole("button", { name: "Accueil" }));
    await u.click(screen.getByRole("button", { name: "Confirmer ?" }));

    await screen.findByText("Feuille de marque");
    expect(screen.getByText("Aucune table ouverte pour l'instant.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Historique" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Historique \(/ })).not.toBeInTheDocument();
  });

  it("modifie une donne déjà saisie et recalcule les totaux sans en ajouter une nouvelle", async () => {
    const u = await ouvrirSetup();
    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    await lancerPartieJusquaLaFeuille(u);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    let totaux = screen.getAllByTestId("score-total").map((el) => el.textContent);
    expect(totaux).toEqual(["200", "-50", "-50", "-50", "-50"]);

    // Ouvrir le détail de la donne 1, puis "Modifier cette donne"
    const table = document.querySelector("table") as HTMLElement;
    await u.click(within(table).getByText("1").closest("tr") as HTMLElement);
    await u.click(screen.getByRole("button", { name: "Modifier cette donne" }));

    // Le roi déjà choisi (Cœur) doit rester sélectionné dans la saisie rouverte
    await screen.findByText("Donne 1");
    expect(screen.getByRole("button", { name: "Cœur", pressed: true })).toBeInTheDocument();

    // Fait chuter le contrat (points sous le seuil de 51) et valide à nouveau
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    // Une seule donne toujours en jeu (pas une deuxième ligne ajoutée), mais recalculée en chute :
    // seuil 51, points 30 -> écart 21, base -92 ; Andry seul preneur = 4×-92 = -368, chacun des 4 autres +92
    expect(screen.getByText(/Noter la donne 2/)).toBeInTheDocument();
    totaux = screen.getAllByTestId("score-total").map((el) => el.textContent);
    expect(totaux).toEqual(["-368", "92", "92", "92", "92"]);
  });

  it("supprime une partie archivée depuis l'écran détail", async () => {
    const u = await ouvrirSetup();
    await remplirSieges(u, ["Fara", "Lian", "Marc", "Nina"]);
    await lancerPartieJusquaLaFeuille(u);

    await u.click(screen.getByRole("button", { name: /Noter la donne 1/ }));
    await u.click(screen.getByRole("button", { name: "Cœur" }));
    await u.click(screen.getByRole("button", { name: "Inscrire la donne" }));

    await u.click(screen.getByRole("button", { name: "Nouvelle" }));
    await u.click(screen.getByRole("button", { name: "Confirmer ?" }));

    await u.click(await screen.findByRole("link", { name: /Historique \(1\)/ }));
    await u.click(await screen.findByTestId("archive-row"));

    await screen.findByText("Classement final");
    await u.click(screen.getByRole("button", { name: "Supprimer" }));
    await u.click(screen.getByRole("button", { name: "Confirmer ?" }));

    await screen.findByText("Aucune partie archivée.");
  }, 15000);
});
