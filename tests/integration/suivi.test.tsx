import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import type { ArchiveRecord, HistoriqueEntree } from "@/domain/types";
import { cleTable } from "@/lib/storage/stockage";
import { DetecteurFactice } from "@/vision/lib/detecteur";
import { horloge } from "@/vision/lib/horloge";
import type { Detection } from "@/vision/domain/types";

const noms = ["Andry", "Bob", "Chloé", "Denis", "Eva"];
const ids = ["a", "b", "c", "d", "e"];
const PLI = ["coeur-3", "coeur-9", "coeur-5", "coeur-12", "coeur-2"];

const entree: HistoriqueEntree = {
  id: "tA", date: "2026-02-01T00:00:00.000Z", joueurs: noms, joueursId: ids,
  parDonne: 5, nbDonnes: 0, totaux: [0, 0, 0, 0, 0],
};
const record: ArchiveRecord = {
  joueursId: ids, joueursNomFige: noms, parDonne: 5, depart: 0, donnes: [], annulations: [],
};

/** Deux coins d'une carte posée autour de (cx, cy), comme le ferait le modèle. */
const coins = (carte: string, cx: number): Detection[] => [
  { carte, confiance: 0.93, x: cx - 0.04, y: 0.45, l: 0.02, h: 0.03 },
  { carte, confiance: 0.93, x: cx + 0.02, y: 0.52, l: 0.02, h: 0.03 },
];

/** Un pli : les cartes arrivent toutes les 700 ms, restent 900 ms sur la table, puis elle se vide. */
function film(t: number): Detection[] {
  if (t < 0 || t >= PLI.length * 700 + 900) return [];
  const visibles = Math.min(PLI.length, Math.floor(t / 700) + 1);
  return PLI.slice(0, visibles).flatMap((c, i) => coins(c, 0.3 + i * 0.1));
}

vi.mock("@/vision/lib/demarrage", () => ({
  preparerSource: async () => ({ nom: "Fausse caméra", image: () => ({}) as CanvasImageSource, taille: () => ({ largeur: 1280, hauteur: 720 }), arreter: () => undefined }),
  preparerDetecteur: async () => {
    const t0 = horloge();
    return new DetecteurFactice((t) => film(t - t0));
  },
}));

beforeEach(() => {
  window.storage.__seed!("tarot:joueurs:v2", ids.map((id, i) => ({
    id, nom: noms[i], creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null,
  })));
  window.storage.__seed!("tarot:historique", []);
  window.storage.__seed!("tarot:tables", [entree]);
  window.storage.__seed!(cleTable("tA"), record);
  localStorage.clear();
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const avancer = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("Suivi caméra", () => {
  it("suit un pli, le reporte dans le brouillon de la table et revient à la feuille", async () => {
    render(<MemoryRouter initialEntries={["/partie/tA/suivi"]}><App /></MemoryRouter>);
    await screen.findByText("Suivi caméra", { selector: "h1" });
    expect(screen.getByText(/Andry distribue · Bob entame/)).toBeInTheDocument();
    expect(screen.getByTestId("reporter")).toBeDisabled(); // rien n'est suivi tant que la caméra n'est pas lancée

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    fireEvent.click(screen.getByTestId("demarrer"));
    await avancer(50);
    await avancer(6000);

    expect(screen.getAllByTestId("pli-historique")).toHaveLength(1);
    expect(screen.getByTestId("reporter")).toHaveTextContent("Reporter dans la donne (5 cartes)");
    expect(screen.getByTestId("reporter")).toBeEnabled();

    fireEvent.click(screen.getByTestId("reporter"));
    vi.useRealTimers();
    await screen.findByText("Feuille de marque", { selector: "h1" });
    await vi.waitFor(() => {
      const enregistre = JSON.parse(window.storage.__dump!()[cleTable("tA")]) as ArchiveRecord;
      expect(enregistre.cartesEnCours).toEqual(PLI);
    });
  });
});
