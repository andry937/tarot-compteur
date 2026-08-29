# Structure du projet

L'application n'est plus un fichier unique : elle est découpée par
responsabilité pour rester lisible à mesure qu'elle grossit.

```
src/
  regles.js               règles du tarot + moteur de score (calculer,
                           tableDeLaDonne, melangerAtouts, resumerDonnees…)
                           — pur, sans React, testable isolément
  identite.js              registre des joueurs : identifiants stables,
                           résolution des noms, fusion par redirection
                           — pur, sans React
  stockage.js               clés de persistance (window.storage) centralisées
  styles.js                 feuille de style partagée (CSS-in-JS)
  App.jsx                   composant racine (état, écrans, orchestration)
  composants/
    Saisie.jsx               formulaire de saisie d'une donne
    Tirage.jsx                tirage du donneur
    Historique.jsx            liste des parties closes + lecture d'une archive
    ArchiveFeuille.jsx        feuille en lecture seule d'une partie archivée
    Configuration.jsx         gestion du trombinoscope (renommage, fusion)

tests/
  setup.js                   faux window.storage en mémoire + matchers jest-dom
  rules.test.js               unitaires : regles.js + identite.js
  app.game.test.jsx           intégration : parcours complet d'une partie
  app.config.test.jsx         intégration : glisser-déposer + écran Joueurs
```

## Pourquoi ce découpage

- **`regles.js` / `identite.js`** sont volontairement sans dépendance React :
  ce sont les fonctions qui portent la logique métier (calcul des scores,
  résolution d'identité), et les tests unitaires les importent directement
  sans avoir besoin de monter de composant.
- **`stockage.js`** évite les clés `"tarot:..."` en dur dispersées dans le
  code : un changement de schéma de stockage (ex. `tarot:partie:v4` → `v5`)
  se fait à un seul endroit.
- **`styles.js`** est importé par chaque écran qui a besoin d'injecter
  `<style>{CSS}</style>` — `Saisie.jsx` et `ArchiveFeuille.jsx` n'en ont pas
  besoin puisqu'ils s'affichent toujours à l'intérieur d'un écran qui l'a
  déjà injecté.
- **`composants/`** regroupe les écrans, chacun n'importe que ce dont il a
  réellement besoin.

## Tests

```bash
npm install
npm test          # une seule passe
npm run test:watch # mode surveillance
```

`tests/rules.test.js` importe directement `src/regles.js` et
`src/identite.js` (imports relatifs, pas d'alias). Les tests d'intégration
importent `src/App.jsx`. Aucun test n'importe plus depuis un fichier unique :
la suite s'exécute contre l'arborescence livrée telle quelle.
