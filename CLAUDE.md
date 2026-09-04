# Feuille de marque — Tarot à la française

Application React de comptage de points pour le tarot à la française, jouée
en soirée avec rotation des joueurs. Pas de backend applicatif : persistance
via Firestore (Firebase), exposée au reste du code à travers l'interface
clé-valeur asynchrone `window.storage` (`get`/`set`/`delete`/`list`, `get`
lève une erreur sur une clé absente plutôt que de renvoyer `null`) —
c'était l'API native de l'environnement Claude artifacts d'origine ;
`lib/firestoreStorage.ts` la réimplémente par-dessus Firestore et la branche
sur `window.storage` au démarrage (`main.tsx`), donc `App.tsx`,
`Historique.tsx`, etc. n'ont pas changé.

Toute la conversation qui a produit ce projet est résumée ci-dessous ; ce
fichier remplace le besoin de la relire.

## Démarrer

```bash
cp .env.example .env    # renseigner la config Firebase (voir Persistance/Firebase)
npm install
npm run dev            # serveur de dev Vite
npm run typecheck       # tsc -b --noEmit
npm test              # suite complète (60 tests, doit passer à 100%) — n'a pas besoin de .env
npm run test:watch
npm run build           # tsc -b && vite build
```

## Architecture

Projet TypeScript (React + Vite). Structure inspirée d'un squelette Vite
conventionnel, adaptée au contenu réel du projet (pas de dossiers vides
pour des besoins absents — voir Conventions) :

```
public/                    vide pour l'instant (pas de favicon/robots.txt/sitemap)
tailwind.config.js          config Tailwind (content scanning sur src/**)
postcss.config.js           tailwindcss + autoprefixer

src/
  vite-env.d.ts             référence des types du client Vite
  index.css                  point d'entrée CSS : @tailwind base/components/utilities + quelques
                              réglages globaux (fond, prefers-reduced-motion) ; importé une seule
                              fois dans main.tsx
  types.ts                  types d'état partagés entre écrans (Partie, TirageEnCours, …)
  utils/
    regles.ts               règles du tarot + moteur de score — pur, sans React
    identite.ts              registre des joueurs (identités stables, fusion) — pur, sans React
    stats.ts                  statistiques par joueur, calculées à la volée depuis les archives — pur, sans React
    elo.ts                     classement général Elo, recalculé à la volée depuis les archives — pur, sans React
  lib/
    stockage.ts               clés de persistance centralisées (encapsule window.storage)
    window-storage.d.ts        typage global de l'API window.storage
    firebase.ts                initialisation Firebase (config lue depuis les VITE_FIREBASE_*)
    firestoreStorage.ts        adaptateur Firestore -> interface WindowStorage
  router/
    AppRoutes.tsx              arbre de routes, extrait de App.tsx (composant purement présentationnel)
  pages/                     un écran par route
    CompositionTable.tsx      composition de la table (route /)
    Tirage.tsx                 tirage du donneur (route /tirage)
    Feuille.tsx                 feuille de score en cours (route /partie)
    Configuration.tsx          gestion du trombinoscope (route /joueurs)
    Historique.tsx              liste des parties closes + ouverture d'une archive (route /historique, /historique/:id)
    FicheJoueur.tsx             statistiques cumulées d'un joueur (route /joueurs/:id)
    Classement.tsx              classement général Elo (route /classement)
  components/                pièces rendues à l'intérieur d'un écran, jamais routées
    ui.tsx                     primitives visuelles Tailwind partagées (Page, Header, GhostButton,
                                Chip, Cta, Field, Label, Section, RankRow, ArchiveRow, Lien, …)
    ScoreGrid.tsx               grille de score partagée par Feuille.tsx (partie en cours) et
                                ArchiveFeuille.tsx (archive) — évite de dupliquer le tableau
    Saisie.tsx                 formulaire modal de saisie d'une donne (dans Feuille)
    ArchiveFeuille.tsx          feuille en lecture seule d'une partie archivée (dans Historique)
  App.tsx                     composant racine : état partagé, effets de persistance
  main.tsx                    monte <App /> dans <BrowserRouter>, importe index.css

tests/
  setup.ts                   faux window.storage en mémoire + jest-dom
  rules.test.ts               unitaires : utils/regles.ts + utils/identite.ts (33 tests)
  stats.test.ts                unitaires : utils/stats.ts (7 tests)
  elo.test.ts                  unitaires : utils/elo.ts (7 tests)
  app.game.test.tsx           intégration : parcours complet d'une partie (7 tests)
  app.config.test.tsx         intégration : drag&drop + écran Joueurs (5 tests)
```

**Règle de dépendance** : `utils/regles.ts` et `utils/identite.ts`
n'importent jamais React ni les autres modules — c'est ce qui les rend
testables sans monter de composant.

## Piège connu (historique — le CSS-in-JS qu'il concernait a depuis été
remplacé par Tailwind, voir Conventions, mais la leçon générale reste valable)

Le split en fichiers séparés a introduit deux régressions silencieuses,
trouvées uniquement grâce aux tests :

1. `ROMAINS` et `nomAtout` n'étaient pas exportés dans le fichier
   monolithique d'origine (inutile puisque tout était dans la même portée).
   En extrayant `Tirage.jsx`, l'import manquant a cassé le tirage.
2. `Tirage.jsx` faisait `<style>{CSS}</style>` sans importer `CSS` (à
   l'époque du CSS-in-JS par template string, avant la migration vers
   Tailwind). Comme c'est un module ES en environnement navigateur/jsdom,
   l'identifiant libre `CSS` s'est résolu vers l'objet global `window.CSS`
   (API CSSOM, qui a une méthode `.escape`) au lieu de lever une
   `ReferenceError` — React a alors tenté de rendre cet objet comme enfant
   et a planté avec un message trompeur (« object with keys {escape} »).

**Leçon pour toute future extraction/refactor** : après avoir déplacé du
JSX dans un nouveau fichier, vérifier systématiquement que chaque
identifiant libre utilisé est soit importé, soit déclaré localement — ne
pas se fier à la compilation seule (esbuild ne signale pas un identifiant
qui se résout par accident vers un global du navigateur/jsdom). Un script
de vérification croisée (usage vs import, par symbole exporté connu) a été
utilisé pour ce diagnostic ; le refaire après tout nouveau découpage de
fichier est plus fiable qu'une relecture manuelle.

## Persistance (Firebase)

Firestore stocke chaque clé `window.storage` comme un document de la
collection `tarotStorage` (l'ID de document = la clé, ex.
`tarot:partie:v4`), avec la valeur JSON dans un champ `value`. Mise en
place unique (console Firebase, ne peut pas être automatisée depuis ce
dépôt) :

1. Créer un projet sur https://console.firebase.google.com (offre
   gratuite « Spark »).
2. Build > Firestore Database > Créer une base (mode production, choisir
   une région).
3. Paramètres du projet > Vos applications > ajouter une app Web (icône
   `</>`) pour obtenir l'objet de config (`apiKey`, `authDomain`,
   `projectId`, …) — ces valeurs ne sont pas secrètes, mais vont dans
   `.env` (jamais commité) pour changer de projet entre le poste de dev
   et Vercel sans toucher au code. Voir `.env.example`.
4. Règles Firestore (Firestore Database > Règles) — l'app n'a pas de
   compte utilisateur, donc pas d'auth possible côté règles ; à défaut,
   limiter l'accès à la seule collection utilisée :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /tarotStorage/{document} {
         allow read, write: if true;
       }
     }
   }
   ```
   Ces règles restent ouvertes en lecture/écriture (pas d'authentification
   dans l'app) : acceptable pour un outil de comptage entre amis sans
   donnée sensible, mais à savoir — n'importe qui connaissant la config du
   projet peut lire/écrire cette collection.
5. Sur Vercel : Project Settings > Environment Variables, renseigner les
   mêmes `VITE_FIREBASE_*` que dans `.env.example`.

## Modèle de données

**Identité des joueurs (registre)** — `tarot:joueurs:v2` :
```js
{ id, nom, creee, actif, redirigeVers }
```
`id` est stable et opaque (`crypto.randomUUID()`). Une fusion ne réécrit
jamais les archives : elle désactive la fiche absorbée et pose
`redirigeVers` vers la fiche cible. `resoudreNom(id, roster, repli)` suit
la chaîne de redirections (plafonnée à 12 sauts) et retombe sur `repli` si
la fiche est introuvable. Deux fiches ne peuvent pas fusionner si elles ont
déjà partagé une table (`ontDejaJoueEnsemble`, garde-fou testé).

**Partie en cours** — `tarot:partie:v4` :
```js
{ joueursId, joueursNomFige, parDonne, depart, donnes: [...], annulations: [...] }
```
`joueursId`/`joueursNomFige` sont parallèles à l'ordre des sièges (position
= index dans ces deux tableaux). Tout le reste du code (rotation, calcul,
tirage) raisonne en **index de position**, jamais en identifiant — la
résolution d'identité n'intervient qu'à l'affichage. Une partie active
n'accepte aucun siège vide : les 5 (par défaut) noms sont requis avant de
pouvoir tirer le donneur, et deux sièges ne peuvent pas porter le même nom.

**Historique** — `tarot:historique` (index léger) + `tarot:archive:{id}`
(feuille complète par partie close, chargée à la demande). Le résumé
d'historique inclut `joueursId` (nécessaire au garde-fou de fusion).

## Règles du tarot implémentées

- Contrats : Petite (×1), Garde (×2), Garde sans (×4), Garde contre (×6)
- Seuils par bouts : 0→56, 1→51, 2→41, 3→36 ; score de base =
  `(25 + écart) × contrat`
- Petit au bout (±10×contrat), poignée (20/30/40), chelem
  (200/400/−200)
- À 5 joueurs avec appelé : preneur = 2 parts, appelé = 1 part, défense = le
  reste. Le roi précis appelé (Cœur/Carreau/Trèfle/Pique) est enregistré
  (`roiAppele` sur la donne, saisi dans `Saisie.tsx`) pour les statistiques
  par roi appelé — absent sur les donnes déjà archivées avant son
  introduction. Obligatoire à 5 joueurs, y compris quand le preneur s'appelle
  lui-même (joue seul) : en tarot le roi est annoncé aux enchères avant de
  savoir qui le détient, donc le sélecteur « Roi appelé » est affiché et saisi
  *avant* le sélecteur « Chez qui ? », et bloque « Inscrire la donne » tant
  qu'il n'est pas choisi.
- **Petit sec** (le seul atout d'un joueur est Le Petit, sans l'Excuse) :
  annoncé *avant* les enchères, annule la donne et la redonne (même
  donneur), aucun effet sur le score. Panneau dédié dans l'écran de la
  feuille en cours (« Petit sec ? Annuler la donne »).
- **Misère** (règle Tarot-Bière, pas FFT officielle) : un joueur sans aucun
  atout ou sans aucun honneur peut l'annoncer après la prise du chien,
  avant la première carte. Chaque *autre* joueur à table lui paie 10
  points, y compris ses propres coéquipiers — indépendant du multiplicateur
  de contrat. Annoncée à tort, le paiement s'inverse. Saisi comme un
  tableau `miseres` sur la donne, dans le formulaire `Saisie.tsx`.

## Où en est le projet

**Fait** : registre à identités stables avec fusion, saisie complète d'une
donne (avec misère et primes), Petit sec, rotation avec repos, tirage du
donneur (aléatoire + désignation manuelle), historique + archives en
lecture seule, suppression d'une partie archivée, classement général Elo,
écran de configuration du trombinoscope, glisser-déposer pour réordonner
les sièges, persistance Firestore, refonte visuelle Tailwind (responsive),
suite de tests complète.

**Refonte visuelle Tailwind** : remplacement complet de l'ancien CSS-in-JS
(un unique gros template string, non responsive — la grille de score
notamment débordait sur petit écran) par Tailwind, à la demande explicite
de l'utilisateur, avec refonte du design (thème sombre épuré, plutôt qu'une
reconduction à l'identique de l'ancien thème « feutre/papier »). Voir
Conventions pour le détail de l'organisation (`components/ui.tsx`,
`ScoreGrid.tsx`) et le piège d'override de classes à éviter. Les tests
d'intégration qui s'appuyaient sur les anciennes classes CSS globales
(`.t-total`, `.t-cl-row`, `.t-archive-row`, `.t-roster-nom`, `.t-roster-row`,
`.t-champ-nom`) ont été réécrits pour utiliser `data-testid` (posés sur les
primitives concernées) plutôt que des sélecteurs de présentation.

**Suppression d'une partie archivée** (issue #7) : bouton « Supprimer »
dans l'écran détail d'archive (`Historique.tsx`), pattern de confirmation
en deux clics identique à « Nouvelle » dans `Feuille.tsx` (« Supprimer » →
« Confirmer ? » pendant 4s). Supprime le document `tarot:archive:{id}` et
retire l'entrée de l'index `tarot:historique` (`App.tsx::supprimerPartie`).
Pas de corbeille : suppression définitive, assumé (issue explicitement hors
périmètre sur ce point). Effet de bord accepté et non traité : le
garde-fou de fusion des joueurs (`ontDejaJoueEnsemble`, dans
`identite.ts`) s'appuie sur `historiqueIndex` pour savoir si deux joueurs
ont déjà partagé une table — supprimer la dernière partie commune entre
deux joueurs peut donc réautoriser une fusion qui aurait dû rester
bloquée.

**Bouton « Accueil » dans l'écran Partie** (`Feuille.tsx`) : permet de
quitter la partie en cours sans l'archiver dans l'historique (contrairement
à « Nouvelle », qui archive avant de réinitialiser). Même pattern de
confirmation en deux clics. `App.tsx::quitterPartie` réutilise
`reinitialiserPartie()` (vidage de l'état + suppression de `tarot:partie:v4`
+ retour à `/`), la seule différence avec `nouvellePartie()` étant l'absence
de l'étape d'archivage.

**Statistiques par joueur** (`utils/stats.ts`, écran `FicheJoueur.tsx`,
route `/joueurs/:id`, lien « Stats » depuis `Configuration.tsx`) : décision
prise de calculer à la volée depuis les archives à chaque ouverture de
l'écran plutôt que maintenir un agrégat stocké (`tarot:stats:v1` envisagé
initialement, abandonné — plus simple, pas de risque de désynchronisation
après une fusion de joueurs, l'échelle actuelle du groupe le permet).
`roleDe(donne, resultat, i)` → `"preneur" | "appele" | "defense" | "repos"`
réutilise directement le `ResultatDonne` déjà calculé. Gère la résolution
de fusion (cluster de tous les identifiants qui redirigent vers la même
fiche, sinon les donnes jouées sous l'ancienne identité disparaîtraient).
Affiche : points totaux, décomposition par rôle (nb + taux de victoire),
contrats de prédilection, rois appelés, nombre de fois appelé,
meilleure/pire donne, liste des parties avec renvoi vers l'archive.

**Classement général Elo** (issue #10, `utils/elo.ts`, écran `Classement.tsx`,
route `/classement`, lien depuis `CompositionTable.tsx`) : décisions prises
en discussion avant développement (le tarot n'étant pas un jeu 1v1, l'Elo
classique ne s'applique pas directement) —
- un match par **donne** archivée, pas par partie complète (plus de
  données, cohérent avec le calcul par-donne déjà fait dans `stats.ts`) ;
- un seul Elo **global** par joueur, pas de distinction par rôle ;
- match = attaque (preneur + appelé le cas échéant) contre défense ;
  résultat **continu**, pas binaire (affiné après un premier retour
  utilisateur sur la PR #10) : dérivé du score brut signé de la donne
  (`calculer().base`, qui intègre déjà le multiplicateur de contrat,
  l'écart au seuil, la poignée, le petit au bout et le chelem) via une
  fonction logistique (`resultatContinu` dans `elo.ts`, échelle 400 —
  cohérente avec le dénominateur standard de la formule Elo). Une victoire
  ric-rac ne vaut donc qu'un peu plus que 0.5, un contrat risqué (Garde
  sans/contre) réussi largement — ou chuté lourdement — se rapproche de 1
  (ou 0) : ça valorise l'audace des annonces et l'ampleur du résultat, pas
  seulement le fait de réussir ou chuter ;
- plusieurs contre un (ex. 3 défenseurs contre 1 preneur) : espérance de
  gain calculée sur la **moyenne** des Elo de chaque camp (formule Elo
  standard), puis le même delta est appliqué à chaque membre du camp, sans
  le diviser entre les membres ;
- 1500 de départ, K-facteur 24 (valeurs Elo conventionnelles) ; pas de
  traitement spécial pour les joueurs à faible historique ;
- recalcul complet à chaque affichage en rejouant toutes les donnes
  archivées par ordre chronologique (même philosophie que `stats.ts` : pas
  d'agrégat stocké, donc pas de désynchronisation possible après une fusion
  de fiches — `calculerClassementElo` résout chaque identifiant de siège
  via `resoudreFiche` avant d'appliquer les deltas).

**Pas encore fait** (issues GitHub ouvertes sur le dépôt) :
- Statistiques sur les donnes d'une partie en cours (roi appelé, taux de
  victoire/défaite, mains appelées) — panneau dans `Feuille.tsx`/`ArchiveFeuille.tsx`,
  distinct de la fiche joueur cumulée
- Graphique de progression en SVG à la main (pas de librairie de charts
  disponible dans l'environnement d'origine) : vue comparative sur l'axe
  des donnes globales (plateaux visibles pour les joueurs au repos, assumé)
  + fiche joueur sur son axe personnel dense

## Conventions

- Les noms de dossiers structurels (`pages`, `components`, `utils`, `lib`,
  `styles`, `router`, `types`) sont du vocabulaire technique anglais
  standard d'un projet Vite — la règle « tout est en français » ci-dessous
  porte sur les identifiants métier, les commentaires et le texte affiché,
  pas sur cette arborescence.
- Tout est en français : noms de variables, commentaires, texte affiché.
- TypeScript partout (`.ts`/`.tsx`), `strict` activé. Types partagés entre
  écrans dans `src/types.ts` ; types propres au moteur de score ou au
  registre des joueurs co-localisés dans `utils/regles.ts`/`utils/identite.ts`.
- **Tailwind CSS** pour tout le style (remplace l'ancien CSS-in-JS par
  template string, retiré) : classes utilitaires directement dans le JSX,
  `tailwind.config.js` + `postcss.config.js` à la racine, `src/index.css`
  (`@tailwind base/components/utilities`) importé une seule fois dans
  `main.tsx`. Vocabulaire visuel répété (bouton fantôme, chip, CTA,
  carte/section, ligne de classement…) extrait en primitives dans
  `components/ui.tsx` plutôt que dupliqué dans chaque écran — équivalent
  Tailwind des anciennes classes globales `t-*`. Thème sombre (fond
  `slate-950`, accent `amber-400`, négatif `rose-400`) sauf la grille de
  score (`ScoreGrid.tsx`) qui garde une carte « papier » claire pour
  rester dense et lisible, en contraste volontaire avec le reste de
  l'écran. **Piège à éviter** : ne jamais faire dépendre le style d'un
  composant partagé d'un override de classe sur la même propriété CSS que
  sa classe de base (ex. passer `py-2.5` en `className` à un composant qui
  a déjà `py-4` en dur) — les classes Tailwind n'ont pas de garantie
  d'ordre de spécificité via la concaténation de chaînes, donc le résultat
  n'est pas fiable ; préférer une prop de variante (voir `Cta({ compact })`)
  ou un `<div>` englobant pour la mise en page (ex. `flex-1`) plutôt qu'un
  override en conflit.
- Pas de librairie de composants ni de state manager : `useState`/`useEffect`
  bruts. La navigation entre écrans passe par `react-router-dom`
  (`BrowserRouter` monté dans `main.tsx`), une route par écran, définies
  dans `router/AppRoutes.tsx` :
  `/` (composition de la table), `/tirage` (tirage du donneur), `/partie`
  (feuille de score), `/joueurs` (configuration du trombinoscope),
  `/joueurs/:id` (fiche statistique d'un joueur), `/historique` et
  `/historique/:id` (liste et détail d'une archive), `/classement`
  (classement général Elo).
  `/tirage` et `/partie` gardent chacune leur état (`tirage`, `partie`) :
  si l'état attendu est absent (ex. rechargement direct sans partie
  persistée), la route redirige vers `/` plutôt que planter — `tirage`
  n'est d'ailleurs jamais persisté, seule `partie` l'est. Le déploiement
  statique (Vercel) nécessite un fallback SPA vers `index.html`
  (`vercel.json`).
- `window.storage` ne doit jamais être appelé en dehors d'un `try/catch` —
  `get()` lève sur une clé absente, c'est le cas normal au premier lancement
  (et Firestore peut aussi lever sur une erreur réseau). Typé dans
  `lib/window-storage.d.ts`, implémenté par `lib/firestoreStorage.ts`,
  branché dans `main.tsx` avant le premier rendu.
