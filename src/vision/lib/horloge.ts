/**
 * Horloge des images : millisecondes depuis 1970, alors que `performance.now()` repart de zéro à chaque
 * chargement de la page. Une manche reprise après un rechargement mélange des horodatages d'avant et
 * d'après : avec une horloge qui repart de zéro, les cartes posées après la reprise sembleraient jouées
 * AVANT celles déjà enregistrées, et l'ordre de jeu serait faux. L'origine est figée au chargement du module,
 * donc l'horloge reste monotone même si l'heure du système est corrigée pendant la manche.
 */
const ORIGINE = typeof performance.timeOrigin === "number" ? performance.timeOrigin : Date.now() - performance.now();

export const horloge = (): number => ORIGINE + performance.now();
