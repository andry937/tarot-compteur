/** Mémoire locale des réglages (zones, seuils) : tout est facultatif, la page marche sans. */

const PREFIXE = "tarot-suivi:";

export function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    return brut === null ? defaut : (JSON.parse(brut) as T);
  } catch {
    return defaut;
  }
}

export function ecrire(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* stockage plein ou refusé : on continue sans mémoire */
  }
}
