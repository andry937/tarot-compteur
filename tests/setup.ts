import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { viderCacheArchives } from "@/lib/storage/archives";
import { CleIntrouvable } from "@/lib/storage/stockage";
import type { WindowStorage } from "@/lib/storage/window-storage";

/**
 * Reproduit l'API window.storage (get/set/delete/list) utilisée par l'app,
 * y compris le comportement documenté : get() lève sur une clé absente.
 */
function creerFauxStorage(): WindowStorage {
  const magasin = new Map<string, string>();
  return {
    async get(key) {
      if (!magasin.has(key)) throw new CleIntrouvable(key);
      return { key, value: magasin.get(key)!, shared: false };
    },
    async set(key, value) {
      magasin.set(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      const existait = magasin.has(key);
      magasin.delete(key);
      return { key, deleted: existait, shared: false };
    },
    async list(prefix) {
      const keys = [...magasin.keys()].filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
    __dump: () => Object.fromEntries(magasin),
    __seed: (key, value) => magasin.set(key, typeof value === "string" ? value : JSON.stringify(value)),
    __clear: () => magasin.clear(),
  };
}

beforeEach(() => {
  window.storage = creerFauxStorage();
  viderCacheArchives();
});
