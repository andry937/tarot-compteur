import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecapSoiree from "@/components/stats/RecapSoiree";
import type { Donne } from "@/domain/score/regles";

const donne: Donne = {
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
const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];

describe("RecapSoiree", () => {
  it("n'affiche rien sans donne", () => {
    const { container } = render(<RecapSoiree donnes={[]} joueurs={noms} joueursId={["a", "b", "c", "d", "e"]} nbTotal={5} />);
    expect(container).toBeEmptyDOMElement();
  });

  const rendre = () =>
    render(
      <RecapSoiree
        donnes={[donne]}
        joueurs={noms}
        joueursId={["a", "b", "c", "d", "e"]}
        nbTotal={5}
        badges={[{ joueurId: "a", badge: "patron", detail: "x" }]}
        date="02/11/2026"
      />
    );

  it("affiche le podium et copie le texte dans le presse-papier", async () => {
    const u = userEvent.setup();
    rendre();
    expect(screen.getAllByTestId("recap-ligne")).toHaveLength(5);
    await u.click(screen.getByRole("button", { name: /partager le récap/i }));
    expect(await screen.findByText("Copié dans le presse-papier.")).toBeInTheDocument();
    const copie = await navigator.clipboard.readText();
    expect(copie).toContain("Récap de la soirée du 02/11/2026");
    expect(copie).toContain("🏆 Le Patron : Andry");
  });

  it("propose le texte à sélectionner quand la copie est refusée", async () => {
    const u = userEvent.setup();
    rendre();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("refusé"));
    await u.click(screen.getByRole("button", { name: /partager le récap/i }));
    const texte = (await screen.findByTestId("recap-texte")) as HTMLTextAreaElement;
    expect(texte.value).toContain("🏆 Le Patron : Andry");
  });
});
