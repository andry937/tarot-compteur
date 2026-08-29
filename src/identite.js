/**
 * Registre des joueurs : identifiants stables, résolution des noms,
 * rapprochement/création de fiches, fusion par redirection.
 */

export const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const normaliser = (s) => s.trim().toLowerCase();

/** Suit la chaîne de redirections (fusion) jusqu'à la fiche vivante. */
export function resoudreFiche(id, roster) {
  let f = roster.find((r) => r.id === id);
  let hops = 0;
  while (f && f.redirigeVers && hops < 12) {
    f = roster.find((r) => r.id === f.redirigeVers);
    hops++;
  }
  return f || null;
}

/** Nom à afficher pour un identifiant : fiche résolue, sinon le nom figé transmis en repli. */
export function resoudreNom(id, roster, repli) {
  const f = resoudreFiche(id, roster);
  return f ? f.nom : repli || "?";
}

/** Fiche active portant exactement ce nom (comparaison insensible à la casse/aux espaces). */
export function trouverFicheParNom(nom, roster) {
  const v = normaliser(nom);
  return roster.find((r) => r.actif && normaliser(r.nom) === v) || null;
}

/**
 * Rapproche chaque nom saisi d'une fiche existante, ou en crée une silencieusement.
 * Retourne les identifiants dans l'ordre des noms fournis, et le registre mis à jour.
 */
export function resoudreOuCreerFiches(noms, roster) {
  const suivant = [...roster];
  const ids = noms.map((nom) => {
    const existante = trouverFicheParNom(nom, suivant);
    if (existante) return existante.id;
    const fiche = {
      id: genId(),
      nom: nom.trim(),
      creee: new Date().toISOString(),
      actif: true,
      redirigeVers: null,
    };
    suivant.push(fiche);
    return fiche.id;
  });
  return { ids, roster: suivant };
}

/** Deux fiches ont-elles déjà partagé une table dans l'historique ? */
export function ontDejaJoueEnsemble(idA, idB, historiqueIndex) {
  return historiqueIndex.some(
    (h) => (h.joueursId || []).includes(idA) && (h.joueursId || []).includes(idB)
  );
}
