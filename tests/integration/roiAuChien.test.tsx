import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Saisie from "@/components/saisie/Saisie";
import type { Donne } from "@/domain/score/regles";

const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];

function rendre(extra: Partial<React.ComponentProps<typeof Saisie>> = {}) {
  const onValider = vi.fn<(d: Donne) => void>();
  render(
    <Saisie joueurs={noms} parDonne={5} tableProposee={[0, 1, 2, 3, 4]} total={5} numero={1} onFermer={() => {}} onValider={onValider} {...extra} />
  );
  return onValider;
}

describe("Roi au chien (saisie)", () => {
  it("enregistre la marque quand on coche « Le roi était dans le chien »", async () => {
    const u = userEvent.setup();
    const onValider = rendre();
    expect(screen.queryByTestId("roi-au-chien")).not.toBeInTheDocument(); // pas de roi choisi : pas de case
    await u.click(screen.getByRole("button", { name: /^Cœur$/ }));
    await u.click(screen.getByTestId("roi-au-chien"));
    await u.click(screen.getByRole("button", { name: /inscrire la donne/i }));
    expect(onValider.mock.calls[0][0]).toMatchObject({ roiAppele: "coeur", roiAuChien: true });
  });

  it("ne marque rien par défaut", async () => {
    const u = userEvent.setup();
    const onValider = rendre();
    await u.click(screen.getByRole("button", { name: /^Cœur$/ }));
    await u.click(screen.getByRole("button", { name: /inscrire la donne/i }));
    expect(onValider.mock.calls[0][0].roiAuChien).toBeUndefined();
  });

  it("coche d'office quand le chien noté contient le roi appelé, et reste décochable", async () => {
    const u = userEvent.setup();
    const onValider = rendre({ brouillon: { cartes: [], chien: ["coeur-14", "atout-3", "pique-2"], onCartes: () => {}, onChien: () => {} } });
    await u.click(screen.getByRole("button", { name: /^Cœur$/ }));
    expect(screen.getByTestId("roi-au-chien")).toBeChecked();
    await u.click(screen.getByTestId("roi-au-chien"));
    await u.click(screen.getByRole("button", { name: /inscrire la donne/i }));
    expect(onValider.mock.calls[0][0].roiAuChien).toBeUndefined();
  });
});
