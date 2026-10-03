/**
 * Typage de l'API window.storage (clé-valeur async), fournie par
 * l'environnement d'exécution — absente en dehors de celui-ci, d'où le
 * `try/catch` systématique autour de chaque appel dans le code applicatif.
 */
export interface StorageEntry {
  key: string;
  value: string;
  shared: boolean;
}

export interface WindowStorage {
  get(key: string): Promise<StorageEntry>;
  set(key: string, value: string): Promise<StorageEntry>;
  delete(key: string): Promise<{ key: string; deleted: boolean; shared: boolean }>;
  list(prefix?: string): Promise<{ keys: string[]; prefix?: string; shared: boolean }>;
  // Présents uniquement sur le faux storage de tests/setup.ts.
  __dump?(): Record<string, string>;
  __seed?(key: string, value: string | object): void;
  __clear?(): void;
}

declare global {
  interface Window {
    storage: WindowStorage;
  }
}

export {};
