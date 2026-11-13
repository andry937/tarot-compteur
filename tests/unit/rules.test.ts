import { describe, it, expect } from "vitest";
import {
  tableDeLaDonne,
  calculer,
  resumerDonnees,
} from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import {
  normaliser,
  resoudreFiche,
  resoudreNom,
  trouverFicheParNom,
  resoudreOuCreerFiches,
  ontDejaJoueEnsemble,
} from "@/domain/joueurs/identite";
import type { Fiche } from "@/domain/joueurs/identite";

/* ------------------------------------------------------------------ */
/*  tableDeLaDonne — rotation                                          */
/* ------------------------------------------------------------------ */

describe("tableDeLaDonne", () => {
  it("à 6 joueurs, celui qui précède le donneur se repose", () => {
    expect(tableDeLaDonne(0, 6, 5, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(tableDeLaDonne(1, 6, 5, 0)).toEqual([1, 2, 3, 4, 5]);
  });

  it("répartit les repos autour de la table (8 joueurs, 3 au repos)", () => {
    expect(tableDeLaDonne(0, 8, 5, 0)).toEqual([0, 2, 3, 5, 7]);
    expect(tableDeLaDonne(1, 8, 5, 0)).toEqual([1, 3, 4, 6, 0]);
    expect(tableDeLaDonne(3, 8, 5, 3)).toEqual([6, 0, 1, 3, 5]);
  });

  it("personne ne se repose deux donnes de suite, et tous se reposent autant", () => {
    for (const total of [7, 8, 9, 10]) {
      const repos = Array.from({ length: total }, () => [] as boolean[]);
      for (let k = 0; k < total; k++) {
        const table = tableDeLaDonne(k, total, 5, 2);
        expect(table[0]).toBe((2 + k) % total);
        for (let i = 0; i < total; i++) repos[i].push(!table.includes(i));
      }
      for (const r of repos) {
        expect(r.filter(Boolean).length).toBe(total - 5);
        r.forEach((v, k) => expect(v && r[(k + 1) % total]).toBe(false));
      }
    }
  });

  it("boucle après un tour complet (8 donnes pour 8 joueurs)", () => {
    expect(tableDeLaDonne(8, 8, 5, 0)).toEqual(tableDeLaDonne(0, 8, 5, 0));
  });

  it("la taille de table est bornée par le total de joueurs", () => {
    expect(tableDeLaDonne(0, 3, 5, 0)).toEqual([0, 1, 2]);
  });

  it("sans repos (parDonne === total), la table tourne quand même le donneur", () => {
    expect(tableDeLaDonne(0, 4, 4, 0)).toEqual([0, 1, 2, 3]);
    expect(tableDeLaDonne(1, 4, 4, 0)).toEqual([1, 2, 3, 0]);
  });
});

/* ------------------------------------------------------------------ */
/*  calculer — moteur de score                                         */
/* ------------------------------------------------------------------ */

const donneBase: Omit<Donne, "points"> = {
  table: [0, 1, 2, 3],
  preneur: 0,
  appele: null,
  contrat: "garde",
  bouts: 1,
  petitAuBout: "aucun",
  poignee: "aucune",
  chelem: "aucun",
  miseres: [],
};

describe("calculer — contrat simple à 4", () => {
  it("preneur réussi : (25+écart)×mult, somme nulle", () => {
    const res = calculer({ ...donneBase, points: 60 }, 4); // seuil 51, écart 9
    expect(res.reussi).toBe(true);
    expect(res.ecart).toBe(9);
    expect(res.base).toBe((25 + 9) * 2); // 68
    expect(res.scores).toEqual([204, -68, -68, -68]);
    expect(res.scores.reduce((a, b) => (a as number) + (b as number), 0)).toBe(0);
    expect(res.defenseurs).toEqual([1, 2, 3]);
  });

  it("preneur chuté : signe inversé", () => {
    const res = calculer({ ...donneBase, points: 40 }, 4); // seuil 51, écart 11
    expect(res.reussi).toBe(false);
    expect(res.ecart).toBe(11);
    expect(res.base).toBe(-(25 + 11) * 2); // -72
    expect(res.scores).toEqual([-216, 72, 72, 72]);
    expect(res.scores.reduce((a, b) => (a as number) + (b as number), 0)).toBe(0);
  });

  it("petit au bout à l'attaque ajoute 10×mult au camp du preneur", () => {
    const res = calculer({ ...donneBase, points: 60, petitAuBout: "attaque" }, 4);
    expect(res.base).toBe(68 + 10 * 2); // 88
  });

  it("petit au bout à la défense retire 10×mult", () => {
    const res = calculer({ ...donneBase, points: 60, petitAuBout: "defense" }, 4);
    expect(res.base).toBe(68 - 10 * 2); // 48
  });

  it("poignée nominative : comptée pour le camp qui l'a montrée, indépendamment du contrat", () => {
    // Le preneur (attaque) montre une poignée simple, contrat réussi : s'ajoute.
    const reussi = calculer(
      { ...donneBase, points: 51, poignees: [{ id: "p1", joueur: 0, taille: "simple" }] },
      4
    ); // écart 0
    expect(reussi.base).toBe(25 * 2 + 20); // 70

    // Le preneur (attaque) montre la même poignée, mais le contrat chute : elle
    // reste acquise à l'attaque malgré la chute (contrairement à l'ancien calcul,
    // qui l'aurait fait basculer du côté de la défense).
    const chute = calculer(
      { ...donneBase, points: 40, poignees: [{ id: "p1", joueur: 0, taille: "simple" }] },
      4
    ); // seuil 51, écart 11
    expect(chute.base).toBe(-(25 + 11) * 2 + 20); // -52 (au lieu de -92)

    // Un défenseur (index 1) montre la poignée alors que le contrat est réussi :
    // elle profite à la défense, donc réduit le score du preneur.
    const defense = calculer(
      { ...donneBase, points: 60, poignees: [{ id: "p1", joueur: 1, taille: "simple" }] },
      4
    ); // écart 9
    expect(defense.base).toBe((25 + 9) * 2 - 20); // 48 (au lieu de 88)
  });

  it("plusieurs poignées dans la même donne, y compris de camps différents, se cumulent", () => {
    const res = calculer(
      {
        ...donneBase,
        points: 51,
        poignees: [
          { id: "p1", joueur: 0, taille: "double" }, // preneur (attaque) : +30
          { id: "p2", joueur: 1, taille: "simple" }, // défenseur : -20
        ],
      },
      4
    ); // écart 0
    expect(res.base).toBe(25 * 2 + 30 - 20); // 60
  });

  it("compatibilité : une archive antérieure (champ 'poignee' isolé, sans joueur) suit encore le signe du contrat", () => {
    const reussi = calculer({ ...donneBase, points: 51, poignee: "simple" }, 4);
    expect(reussi.base).toBe(25 * 2 + 20); // 70, comme avant l'introduction du nominatif

    const chute = calculer({ ...donneBase, points: 40, poignee: "simple" }, 4);
    expect(chute.base).toBe(-(25 + 11) * 2 - 20); // -92, ancien comportement préservé
  });

  it("chelem annoncé et réussi ajoute une prime fixe de 400", () => {
    const res = calculer({ ...donneBase, points: 60, chelem: "annonce_reussi" }, 4);
    expect(res.base).toBe(68 + 400);
  });
});

describe("calculer — table à 5 avec appelé", () => {
  it("le preneur prend 2 parts, l'appelé 1, la défense le reste", () => {
    const d = { ...donneBase, table: [0, 1, 2, 3, 4], preneur: 0, appele: 1, points: 60 };
    const res = calculer(d, 5);
    expect(res.avecAppele).toBe(true);
    expect(res.scores[0]).toBe(2 * res.base);
    expect(res.scores[1]).toBe(res.base);
    expect(res.scores[2]).toBe(-res.base);
    expect(res.scores[3]).toBe(-res.base);
    expect(res.scores[4]).toBe(-res.base);
    expect(res.defenseurs).toEqual([2, 3, 4]);
    expect(res.scores.reduce((a, b) => (a as number) + (b as number), 0)).toBe(0);
  });

  it("sans appelé désigné, le preneur assume seul (pas de split)", () => {
    const d = { ...donneBase, table: [0, 1, 2, 3, 4], preneur: 0, appele: null, points: 60 };
    const res = calculer(d, 5);
    expect(res.avecAppele).toBe(false);
    expect(res.scores[0]).toBe(4 * res.base);
  });

  it("l'appelé ne peut pas être le preneur (avecAppele reste faux)", () => {
    const d = { ...donneBase, table: [0, 1, 2, 3, 4], preneur: 0, appele: 0, points: 60 };
    const res = calculer(d, 5);
    expect(res.avecAppele).toBe(false);
  });
});

describe("calculer — misère (Tarot-Bière)", () => {
  it("misère valide : chaque autre joueur paie 10, quel que soit son camp", () => {
    const d: Donne = {
      ...donneBase,
      points: 60,
      miseres: [{ id: "m1", joueur: 2, type: "atout", aTort: false }],
    };
    const res = calculer(d, 4);
    // base=68 -> sans misère: [204,-68,-68,-68]
    expect(res.scores).toEqual([194, -78, -38, -78]);
    expect(res.scores.reduce((a, b) => (a as number) + (b as number), 0)).toBe(0);
  });

  it("misère annoncée à tort : le paiement s'inverse", () => {
    const d: Donne = {
      ...donneBase,
      points: 60,
      miseres: [{ id: "m1", joueur: 2, type: "atout", aTort: true }],
    };
    const res = calculer(d, 4);
    expect(res.scores).toEqual([214, -58, -98, -58]);
    expect(res.scores.reduce((a, b) => (a as number) + (b as number), 0)).toBe(0);
  });

  it("plusieurs misères se cumulent sans casser la somme nulle", () => {
    const d: Donne = {
      ...donneBase,
      points: 60,
      miseres: [
        { id: "m1", joueur: 1, type: "atout", aTort: false },
        { id: "m2", joueur: 3, type: "tete", aTort: true },
      ],
    };
    const res = calculer(d, 4);
    expect(res.scores.reduce((a, b) => (a as number) + (b as number), 0)).toBe(0);
  });

  it("une misère pour un joueur absent de la table est ignorée", () => {
    const sansMisere = calculer({ ...donneBase, points: 60 }, 4);
    const avecMisereHorsTable = calculer(
      { ...donneBase, points: 60, miseres: [{ id: "m1", joueur: 9, type: "atout", aTort: false }] },
      4
    );
    expect(avecMisereHorsTable.scores).toEqual(sansMisere.scores);
  });
});

describe("resumerDonnees", () => {
  it("cumule les totaux et compte les donnes jouées par joueur, en ignorant les repos", () => {
    const donnes: Donne[] = [
      { ...donneBase, table: [0, 1, 2], preneur: 0, points: 60 },
      { ...donneBase, table: [1, 2, 3], preneur: 1, points: 60 },
    ];
    const { totaux, jouees, cumuls } = resumerDonnees(donnes, 4);
    expect(jouees).toEqual([1, 2, 2, 1]);
    expect(cumuls).toHaveLength(2);
    expect(cumuls[1]).toEqual(totaux);
    // le joueur 0 n'a pas joué la 2e donne : son cumul ne bouge pas
    expect(cumuls[1][0]).toBe(cumuls[0][0]);
  });
});

/* ------------------------------------------------------------------ */
/*  Identité / registre des joueurs                                    */
/* ------------------------------------------------------------------ */

describe("normaliser", () => {
  it("réduit à la casse et aux espaces près", () => {
    expect(normaliser("  Fara  ")).toBe("fara");
    expect(normaliser("FARA")).toBe("fara");
  });
});

describe("résolution de fiche et fusion", () => {
  const roster: Fiche[] = [
    { id: "a", nom: "Andry", creee: "2026-01-01T00:00:00.000Z", actif: true, redirigeVers: null },
    { id: "b", nom: "Bob", creee: "2026-01-01T00:00:00.000Z", actif: false, redirigeVers: "a" },
    {
      id: "c",
      nom: "Chaîne cassée",
      creee: "2026-01-01T00:00:00.000Z",
      actif: false,
      redirigeVers: "zzz-inexistant",
    },
  ];

  it("résout directement une fiche active", () => {
    expect(resoudreNom("a", roster, "repli")).toBe("Andry");
  });

  it("suit une redirection de fusion", () => {
    expect(resoudreNom("b", roster, "repli")).toBe("Andry");
  });

  it("retombe sur le nom figé si l'identifiant est introuvable", () => {
    expect(resoudreNom("inconnu", roster, "Nom Figé")).toBe("Nom Figé");
  });

  it("une redirection cassée ne boucle pas et ne casse pas la résolution", () => {
    expect(resoudreFiche("c", roster)).toBeNull();
    expect(resoudreNom("c", roster, "repli")).toBe("repli");
  });

  it("trouverFicheParNom ignore les fiches désactivées", () => {
    expect(trouverFicheParNom("bob", roster)).toBeNull(); // désactivée (fusionnée)
    expect(trouverFicheParNom("andry", roster)?.id).toBe("a");
  });
});

describe("resoudreOuCreerFiches", () => {
  it("crée une fiche par nom inconnu", () => {
    const { ids, roster } = resoudreOuCreerFiches(["Fara", "Lian"], []);
    expect(ids).toHaveLength(2);
    expect(roster).toHaveLength(2);
    expect(roster[0].actif).toBe(true);
    expect(roster[0].redirigeVers).toBeNull();
  });

  it("réutilise une fiche existante, insensible à la casse et aux espaces", () => {
    const premier = resoudreOuCreerFiches(["Fara"], []);
    const second = resoudreOuCreerFiches(["  fara "], premier.roster);
    expect(second.ids[0]).toBe(premier.ids[0]);
    expect(second.roster).toHaveLength(1); // pas de doublon créé
  });

  it("crée une nouvelle fiche si le nom correspond à une fiche désactivée (fusionnée)", () => {
    const premier = resoudreOuCreerFiches(["Fara"], []);
    const fusionnee = premier.roster.map((r) => ({ ...r, actif: false, redirigeVers: "x" }));
    const second = resoudreOuCreerFiches(["Fara"], fusionnee);
    expect(second.ids[0]).not.toBe(premier.ids[0]);
    expect(second.roster).toHaveLength(2);
  });
});

describe("ontDejaJoueEnsemble", () => {
  const historique = [
    { id: "p1", joueursId: ["a", "b", "c"] },
    { id: "p2", joueursId: ["c", "d"] },
  ];

  it("vrai si les deux identifiants apparaissent dans la même partie", () => {
    expect(ontDejaJoueEnsemble("a", "b", historique)).toBe(true);
  });

  it("faux s'ils n'ont jamais partagé une table", () => {
    expect(ontDejaJoueEnsemble("a", "d", historique)).toBe(false);
  });

  it("tolère une entrée d'historique sans joueursId (anciens formats)", () => {
    const historiqueIncomplet = [{ id: "vieux" }, ...historique];
    expect(() => ontDejaJoueEnsemble("a", "b", historiqueIncomplet)).not.toThrow();
  });
});
