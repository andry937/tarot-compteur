/**
 * Écriture fiable dans `window.storage` : nouvelles tentatives espacées, puis signalement de l'échec
 * (au lieu d'une simple ligne dans la console, invisible sur mobile).
 * @module
 */

/** Pause avant chaque nouvelle tentative, en millisecondes (croît à chaque essai). */
const PAUSE_MS = 500;
/** Nombre total d'essais avant de signaler l'échec. */
const ESSAIS = 3;

/** Numéro de la dernière écriture lancée par clé : une tentative périmée ne doit pas écraser une valeur plus récente. */
const derniere = new Map<string, number>();
let compteur = 0;

/**
 * Écrit `valeur` sous `cle`, avec jusqu'à 3 essais. `surEtat(false)` est appelé si tous échouent,
 * `surEtat(true)` dès qu'une écriture aboutit. Ne lève jamais ; renvoie `true` si l'écriture a abouti.
 * Si une écriture plus récente de la même clé a démarré entre-temps, les nouvelles tentatives
 * s'arrêtent (la valeur la plus récente est celle qui compte).
 */
export async function ecrireFiable(
  cle: string,
  valeur: string,
  surEtat?: (ok: boolean) => void
): Promise<boolean> {
  const numero = ++compteur;
  derniere.set(cle, numero);
  for (let essai = 1; essai <= ESSAIS; essai++) {
    try {
      await window.storage.set(cle, valeur);
      surEtat?.(true);
      return true;
    } catch (e) {
      console.error(`Écriture impossible (${cle}), essai ${essai}/${ESSAIS}`, e);
      if (derniere.get(cle) !== numero) return false; // remplacée par une écriture plus récente
      if (essai < ESSAIS) await new Promise((r) => setTimeout(r, PAUSE_MS * essai));
      if (derniere.get(cle) !== numero) return false;
    }
  }
  surEtat?.(false);
  return false;
}
