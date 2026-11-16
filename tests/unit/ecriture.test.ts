import { describe, it, expect, vi, afterEach } from "vitest";
import { ecrireFiable } from "@/lib/storage/ecriture";
import { TableStore } from "@/stores/TableStore";
import { RegistreStore } from "@/stores/RegistreStore";
import { RootStore } from "@/stores/RootStore";

afterEach(() => vi.useRealTimers());

describe("ecrireFiable", () => {
  it("réessaie puis réussit, sans signaler d'échec", async () => {
    vi.useFakeTimers();
    const set = vi.fn().mockRejectedValueOnce(new Error("réseau")).mockResolvedValue({});
    window.storage = { ...window.storage, set } as typeof window.storage;
    const etat = vi.fn();
    const p = ecrireFiable("k1", "v", etat);
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
    expect(set).toHaveBeenCalledTimes(2);
    expect(etat).toHaveBeenCalledWith(true, "k1");
    expect(etat).not.toHaveBeenCalledWith(false, "k1");
  });

  it("signale l'échec après trois essais", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const set = vi.fn().mockRejectedValue(new Error("réseau"));
    window.storage = { ...window.storage, set } as typeof window.storage;
    const etat = vi.fn();
    const p = ecrireFiable("k2", "v", etat);
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
    expect(set).toHaveBeenCalledTimes(3);
    expect(etat).toHaveBeenCalledWith(false, "k2");
  });

  it("n'écrase pas une valeur plus récente avec une tentative périmée", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const set = vi.fn().mockRejectedValueOnce(new Error("réseau")).mockResolvedValue({});
    window.storage = { ...window.storage, set } as typeof window.storage;
    const ancienne = ecrireFiable("k3", "ancienne");
    const recente = ecrireFiable("k3", "récente");
    await vi.runAllTimersAsync();
    expect(await ancienne).toBe(false);
    expect(await recente).toBe(true);
    expect(set.mock.calls.map((c) => c[1])).toEqual(["ancienne", "récente"]);
  });
});

describe("TableStore.charger", () => {
  it("renvoie false pour une table absente, mais lève sur une panne de stockage", async () => {
    const t = new TableStore(new RegistreStore());
    expect(await t.charger("inconnue")).toBe(false);
    window.storage = {
      ...window.storage,
      get: () => Promise.reject(new Error("délai Firestore dépassé")),
    } as typeof window.storage;
    await expect(t.charger("x")).rejects.toThrow("délai");
  });
});

describe("RootStore.signalerSauvegarde", () => {
  it("garde le bandeau tant qu'une clé reste en échec, même si une autre écriture réussit", () => {
    const store = new RootStore();
    store.signalerSauvegarde(false, "tarot:table:t1");
    expect(store.avertissement).toMatch(/Sauvegarde impossible/);
    store.signalerSauvegarde(true, "tarot:tables");
    expect(store.avertissement).toMatch(/Sauvegarde impossible/);
    store.signalerSauvegarde(true, "tarot:table:t1");
    expect(store.avertissement).toBeNull();
  });
});
