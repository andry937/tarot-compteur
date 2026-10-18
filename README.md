# Feuille de marque — Tarot à la française

Application web de comptage de points pour le **tarot à la française** (3 à 5 joueurs, avec appelé à 5), pensée pour les soirées où les joueurs tournent : plusieurs tables peuvent être ouvertes en parallèle, chaque donne est saisie en quelques touches, et tout est enregistré en ligne pour être repris depuis n'importe quel appareil.

## Fonctionnalités

- **Plusieurs tables** ouvertes en même temps, chacune reprise là où on l'a laissée.
- **Saisie complète d'une donne** : contrat, bouts (et lesquels), points, petit au bout, poignées (par joueur), chelem, misères, roi appelé. Une donne se modifie après coup, y compris dans une partie archivée.
- **Rotation avec repos** quand il y a plus de joueurs que de places, désignation manuelle du donneur, **Petit sec**.
- **Carnet des cartes jouées** : on note les cartes dans l'ordre, l'app déduit les plis, leurs gagnants, les points de l'attaque, et reconstitue les mains.
- **Statistiques** : par partie, par joueur (rôles, appels réussis/échoués, rois appelés…) et **classement Elo** général.
- **Graphiques de progression**, historique des parties closes, gestion du trombinoscope (renommer, fusionner, désactiver).
- Protégé par un **passphrase partagé** (Firebase Auth).

## Stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS · React Router · Recharts · Firebase (Firestore + Auth) · Vitest + Testing Library · déployé sur Vercel.

## Démarrage

Prérequis : Node.js 20+.

```bash
cp .env.example .env     # renseigner la config Firebase (voir ci-dessous)
npm install
npm run dev              # http://localhost:3000
```

Les tests et le build n'ont **pas** besoin de `.env`.

### Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run typecheck` | vérification des types |
| `npm run lint` | ESLint (typescript-eslint, règles des hooks React) |
| `npm test` | suite complète (doit passer à 100 %) |
| `npm run test:watch` | tests en continu |
| `npm run build` | typecheck + build de production |
| `npm run preview` | sert le build localement |
| `npm run format` | Prettier (config dans `.prettierrc.json`) |
| `npm run docs` | documentation du code (TypeDoc, générée dans `docs-site/`, config dans `typedoc.json`) |

La CI (`.github/workflows/ci.yml`) exécute typecheck, lint, tests et build sur chaque push sur `master` et chaque pull request.

La documentation du code (une page par fichier, classe et fonction, à partir des commentaires `/** … */`) est générée par TypeDoc et publiée sur GitHub Pages par `.github/workflows/docs.yml` à chaque push sur `master` : https://andry937.github.io/tarot-compteur/. Mise en place unique : Settings > Pages > Source : **GitHub Actions**.

## Configuration Firebase

Les données sont stockées dans Firestore (collection `tarotStorage`, un document par clé). Mise en place, une seule fois, dans la [console Firebase](https://console.firebase.google.com) :

1. Créer un projet (offre gratuite « Spark ») et une base **Firestore** en mode production.
2. Ajouter une **application Web** au projet et reporter sa config dans `.env` (`VITE_FIREBASE_*`, voir `.env.example`).
3. **Authentication** > Sign-in method : activer **Email/Password** (et rien d'autre : Anonyme désactivé).
4. **Authentication** > Settings > User actions : **décocher « Enable create (sign-up) »** et « Enable delete ».
5. **Authentication** > Users : créer **un seul compte** avec l'email de `VITE_TAROT_AUTH_EMAIL`. Son **mot de passe est le passphrase partagé** par toute la table.
6. **Firestore** > Règles : copier [`firestore.rules`](firestore.rules) en remplaçant l'UID par celui du compte de l'étape 5.

## Sécurité

- Seul le compte partagé peut lire ou écrire (règles Firestore restreintes à son UID). Une règle `request.auth != null` seule ne suffirait pas : tant que l'inscription est ouverte, n'importe qui pourrait créer un compte avec la clé API publique.
- La config Firebase (`VITE_FIREBASE_*`) n'a rien de secret : elle est visible dans le bundle. La protection vient des règles Firestore et du passphrase, jamais de la confidentialité de ces valeurs. Le passphrase ne doit jamais figurer dans le dépôt.
- `vercel.json` ajoute des en-têtes de sécurité (CSP, anti-framing, HSTS…). Toute nouvelle ressource externe doit être autorisée dans la CSP.
- Le bouton **Verrouiller** (accueil) déconnecte l'appareil.

## Déploiement (Vercel)

1. Importer le dépôt dans Vercel (preset Vite détecté automatiquement).
2. *Project Settings > Environment Variables* : renseigner les mêmes variables que `.env.example`.
3. `vercel.json` fournit le repli SPA vers `index.html` et les en-têtes de sécurité.

## Structure du code

```
src/
  main.tsx, App.tsx        point d'entrée ; App crée le store et l'expose aux écrans
  app/                     AuthGate, AppRoutes (arbre de routes), ErrorBoundary
  pages/                   un écran par route
  components/              pièces d'écran, rangées par domaine
    ui/ auth/ feuille/ saisie/ cartes/ stats/ graphiques/
  stores/                  état global MobX : RootStore, TableStore, RegistreStore, HistoriqueStore
  hooks/                   useConfirmation
  domain/                  logique métier PURE, sans React (testable seule)
    score/ cartes/ joueurs/ stats/ types.ts
  lib/                     firebase.ts et lib/storage/ (adaptateur Firestore, clés, cache)
tests/
  unit/                    logique pure
  integration/             parcours complets avec un faux window.storage
```

Règle de dépendance : `domain/` n'importe jamais React ni `components/`, `pages/`, `hooks/`, `stores/` ou `lib/`. L'alias `@/` pointe vers `src/`.

Les décisions de conception (règles du tarot implémentées, modèle de données, Elo, pièges connus) sont consignées dans [`CLAUDE.md`](CLAUDE.md).
