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
npm test              # suite complète (110 tests, doit passer à 100%) — n'a pas besoin de .env
npm run test:watch
npm run build           # tsc -b && vite build
```

## CI

`.github/workflows/ci.yml` : sur chaque push sur `master` et chaque pull
request, exécute `typecheck`, `test` et `build` (dans cet ordre, `npm ci`
d'abord). Aucun secret requis — le build n'a pas besoin de `.env` (voir
`lib/firebase.ts` : `import.meta.env.VITE_FIREBASE_*` reste simplement
`undefined` sans `.env`, `initializeApp` ne s'en plaint pas à
l'initialisation ; seuls de vrais appels Firestore échoueraient, et aucun
test ni le build n'en déclenche).

## Architecture

Projet TypeScript (React + Vite). Structure inspirée d'un squelette Vite
conventionnel, adaptée au contenu réel du projet (pas de dossiers vides
pour des besoins absents — voir Conventions) :

```
.github/workflows/ci.yml    CI : typecheck + test + build sur push master et pull request
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
    stats.ts                  statistiques par joueur, calculées à la volée depuis les archives — pur, sans
                              React ; expose aussi `trajectoire` (axe personnel dense pour le graphique)
    elo.ts                     classement général Elo, recalculé à la volée depuis les archives — pur, sans React
    cartes.ts                   carnet des cartes jouées : identifiants de cartes, gagnant d'un pli,
                                déduction des plis depuis une liste ordonnée — pur, sans React
    statsPartie.ts              statistiques sur les donnes d'une seule partie (roi/joueur appelé,
                                réussites/chutes, mains appelées) — pur, sans React
  lib/
    stockage.ts               clés de persistance centralisées (encapsule window.storage)
    window-storage.d.ts        typage global de l'API window.storage
    firebase.ts                initialisation Firebase (config lue depuis les VITE_FIREBASE_*) ;
                                `auth` reste `null` sans VITE_FIREBASE_API_KEY (config absente)
    firestoreStorage.ts        adaptateur Firestore -> interface WindowStorage ; exporte aussi
                                DELAI_MS, réutilisé par AuthGate.tsx
  router/
    AppRoutes.tsx              arbre de routes, extrait de App.tsx (composant purement présentationnel) ;
                                charge Feuille/FicheJoueur/Historique via React.lazy (voir Conventions)
  pages/                     un écran par route
    Tables.tsx                  liste des tables actuellement ouvertes (route /), point d'entrée de l'app
    CompositionTable.tsx      composition d'une nouvelle table (route /composition)
    Tirage.tsx                 tirage du donneur (route /tirage/:id)
    Feuille.tsx                 feuille de score d'une table ouverte (route /partie/:id)
    Configuration.tsx          gestion du trombinoscope (route /joueurs)
    Historique.tsx              liste des parties closes + ouverture d'une archive (route /historique, /historique/:id)
    FicheJoueur.tsx             statistiques cumulées d'un joueur (route /joueurs/:id)
    Classement.tsx              classement général Elo (route /classement)
    CartesJouees.tsx            aide-mémoire des cartes tombées pendant une main (pas de route : affiché en
                                écran superposé par EcranCartes depuis Saisie)
  components/                pièces rendues à l'intérieur d'un écran, jamais routées
    ui.tsx                     primitives visuelles Tailwind partagées (Page, Header, GhostButton,
                                Chip, Cta, Field, Label, Section, RankRow, ArchiveRow, Lien, …)
    ScoreGrid.tsx               grille de score partagée par Feuille.tsx (partie en cours) et
                                ArchiveFeuille.tsx (archive) — évite de dupliquer le tableau
    StatsPartie.tsx             panneau de stats sur les donnes d'une partie, partagé par les
                                mêmes deux écrans — distinct de la fiche joueur cumulée
    GraphiqueComparatif.tsx     vue comparative (Recharts) : tous les joueurs d'une partie
                                superposés sur l'axe de ses donnes, partagé par les mêmes deux écrans
    GraphiquePersonnel.tsx      fiche joueur : axe personnel dense (Recharts), dans FicheJoueur.tsx
    Saisie.tsx                 formulaire modal de saisie d'une donne, aussi utilisé pour en
                                modifier une existante (prop donneInitiale) — dans Feuille
    ArchiveFeuille.tsx          feuille en lecture seule d'une partie archivée (dans Historique)
    ExplicationElo.tsx           bloc repliable expliquant le fonctionnement du classement Elo,
                                partagé mot pour mot par Classement.tsx et FicheJoueur.tsx
    EcranCartes.tsx             écran superposé à « Inscrire la donne » (Saisie) : habille CartesJouees
    MainsJoueurs.tsx            mains reconstituées de chaque joueur (lecture seule), affichées par EcranMains
    EcranMains.tsx              plein écran « Mains des joueurs », ouvert depuis le détail d'une donne
    JournalPlis.tsx             liste en lecture seule des plis déduits (page Cartes jouées, détail d'une donne)
    Verrou.tsx                  écran de verrouillage (passphrase), affiché par AuthGate.tsx
                                tant qu'aucun utilisateur Firebase Auth n'est connecté
  App.tsx                     composant racine : état partagé, effets de persistance
  AuthGate.tsx                  bascule connecté/non connecté (Firebase Auth) : affiche Verrou.tsx
                                ou <App/> selon onAuthStateChanged — voir Persistance/Firebase
  main.tsx                    monte <AuthGate /> dans <BrowserRouter>, importe index.css

tests/
  setup.ts                   faux window.storage en mémoire + jest-dom
  rules.test.ts               unitaires : utils/regles.ts + utils/identite.ts (35 tests)
  stats.test.ts                unitaires : utils/stats.ts (9 tests)
  elo.test.ts                  unitaires : utils/elo.ts (8 tests)
  statsPartie.test.ts          unitaires : utils/statsPartie.ts (3 tests)
  app.game.test.tsx           intégration : parcours complet d'une partie (9 tests)
  app.config.test.tsx         intégration : drag&drop + écran Joueurs (5 tests)
  authgate.test.tsx            intégration : Verrou/AuthGate, firebase/auth mocké (4 tests)
  eloAffichage.test.tsx        intégration : bloc d'explication Elo + Elo affiché sur la fiche joueur (2 tests)
  tables.test.tsx              intégration : plusieurs tables ouvertes en parallèle, garde-fou joueurs,
                                fermeture isolée, Accueil non destructif, migration de l'ancienne
                                partie unique (5 tests)
  cartes.test.ts               unitaires : utils/cartes.ts (20 tests)
  cartesJouees.test.tsx        intégration : carnet des cartes jouées, persistance, archivage, chien, édition après coup, déduction des points, mains reconstituées (8 tests)
  archiveModification.test.tsx intégration : modification d'une donne d'une partie archivée,
                                persistance et resynchronisation de l'historique (2 tests)
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
4. **Passphrase partagé (Firebase Auth)** : Authentication > Sign-in method
   > activer le fournisseur « Email/Password ». Puis Authentication >
   Users > Add user, avec l'email choisi dans `VITE_TAROT_AUTH_EMAIL`
   (`.env.example` — un simple identifiant, pas un secret) et **le mot de
   passe de ce compte = le passphrase partagé** (jamais dans ce dépôt).
   Toute la table se connecte avec ce même compte (voir `AuthGate.tsx`,
   `components/Verrou.tsx`).
5. Règles Firestore (Firestore Database > Règles) — exiger une connexion
   (n'importe quel compte du projet, donc seulement celui créé ci-dessus) :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /tarotStorage/{document} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   Sans le compte Auth créé à l'étape 4 (ou avec l'ancienne règle
   `allow read, write: if true`), n'importe qui connaissant la config du
   projet peut lire/écrire directement cette collection, hors de l'app —
   ce que ces règles ferment désormais.
6. Sur Vercel : Project Settings > Environment Variables, renseigner les
   mêmes `VITE_FIREBASE_*` et `VITE_TAROT_AUTH_EMAIL` que dans
   `.env.example`.

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

**Tables ouvertes** — plusieurs peuvent coexister (voir « Système de
plusieurs tables » plus bas) : `tarot:tables` (index léger, même forme que
`HistoriqueEntree`) + `tarot:table:{id}` (enregistrement complet d'une
table, chargé à la demande — exactement le même pattern que l'historique
ci-dessous, avec les tables ouvertes au lieu des parties closes) :
```js
{ joueursId, joueursNomFige, parDonne, depart, donnes: [...], annulations: [...] }
```
`joueursId`/`joueursNomFige` sont parallèles à l'ordre des sièges (position
= index dans ces deux tableaux). Tout le reste du code (rotation, calcul,
tirage) raisonne en **index de position**, jamais en identifiant — la
résolution d'identité n'intervient qu'à l'affichage. Une table active
n'accepte aucun siège vide : les 5 (par défaut) noms sont requis avant de
pouvoir tirer le donneur, deux sièges ne peuvent pas porter le même nom, et
un joueur déjà assis à une autre table ouverte ne peut pas être repris ici
(`joueursActuellementAssis`, `utils/identite.ts`). `tarot:partie:v4`
(ancien emplacement unique, une seule partie active possible) n'est plus
écrit : lu une fois au démarrage pour migrer une éventuelle partie en cours
vers ce nouveau système, puis abandonné.

**Historique** — `tarot:historique` (index léger) + `tarot:archive:{id}`
(feuille complète par partie close, chargée à la demande). Le résumé
d'historique inclut `joueursId` (nécessaire au garde-fou de fusion).

## Règles du tarot implémentées

- Contrats : Petite (×1), Garde (×2), Garde sans (×4), Garde contre (×6)
- Seuils par bouts : 0→56, 1→51, 2→41, 3→36 ; score de base =
  `(25 + écart) × contrat`
- Petit au bout (±10×contrat), chelem (200/400/−200)
- **Bouts précis** (`boutsPrecis?: Bout[]` sur la donne, `Bout = "petit" | "21" | "excuse"`,
  `NOM_BOUT` dans `regles.ts`) : en plus du simple compte `bouts` (0-3, qui
  seul détermine le seuil via `SEUILS` et n'est pas remis en cause), un
  champ optionnel indique *lesquels* précisément l'attaque détenait (au
  chien ou capturés en jouant) — saisi via un sélecteur multiple dédié
  dans `Saisie.tsx`, indépendant du compteur `bouts` (pas de validation
  croisée entre les deux : à l'utilisateur de rester cohérent, comme pour
  le reste de la saisie). N'intervient pas dans `calculer()` : purement
  informatif, affiché dans les stats du joueur (voir plus bas). Absent sur
  les donnes archivées avant son introduction.
- **Poignée** (20/30/40, simple/double/triple) : nominative — chaque
  déclaration porte le joueur qui l'a montrée (`poignees: PoigneeDeclaree[]`
  sur la donne, formulaire en liste dans `Saisie.tsx`, même pattern que
  `miseres`). Sa valeur revient au camp de ce joueur (attaque si preneur ou
  appelé, défense sinon), **qu'il y ait réussite ou chute du contrat** —
  contrairement au reste du score de la donne, qui suit le signe du
  contrat. Plusieurs joueurs peuvent chacune en déclarer une dans la même
  donne, y compris de camps différents (elles se cumulent indépendamment).
  Champ `poignee: string` (singulier, sans joueur) conservé en lecture
  seule sur les donnes archivées avant cette évolution : `calculer()`
  reproduit alors l'ancien calcul (approximatif, suivait le signe du
  contrat) plutôt que de mal attribuer le camp faute de savoir qui l'a
  montrée.
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
donne (avec misère et primes), poignée nominative (un ou plusieurs joueurs
par donne), modification d'une donne déjà saisie, Petit sec, rotation avec
repos, tirage du donneur (aléatoire + désignation manuelle), historique +
archives en lecture seule, suppression d'une partie archivée, classement
général Elo, statistiques sur les donnes d'une partie, graphiques de
progression, écran de configuration du trombinoscope, glisser-déposer pour
réordonner les sièges, persistance Firestore, passphrase partagé (Firebase
Auth), menu « Plus d'actions » sur l'écran Joueurs, appels réussis/échoués
sur la fiche joueur (avec bouts précis), refonte visuelle Tailwind
(responsive), CI GitHub Actions, code-splitting des écrans à Recharts,
suite de tests complète. **Toutes les issues initialement listées sont
closes** (#7, #8, #9, #10, #11) — pas de backlog ouvert sur le dépôt pour
l'instant.

**Carnet des cartes jouées** (`utils/cartes.ts`, `pages/CartesJouees.tsx`,
`components/JournalPlis.tsx`) : aide-mémoire pour savoir quelles cartes sont
déjà tombées (atouts et bouts surtout) pendant une main. On note seulement
la suite des cartes **dans l'ordre de jeu** (identifiants `"atout-12"`,
`"excuse"`, `"coeur-14"`…) : l'entame est connue (le joueur après le
donneur) et les joueurs jouent dans l'ordre de la table, donc l'app **déduit**
qui a posé chaque carte et qui remporte chaque pli (plus fort atout, sinon
plus forte carte de la couleur d'entame, l'Excuse ne gagne jamais) ; le
gagnant entame le pli suivant. Seule la liste plate est stockée — plis,
gagnants, compteurs sont recalculés à l'affichage (même philosophie que
`stats.ts`/`elo.ts`) ; annuler = retirer la dernière carte. Brouillon de la
main en cours dans `cartesEnCours` de `tarot:table:{id}` (`ArchiveRecord`),
rattaché à la donne (`Donne.cartesJouees`, optionnel, purement informatif,
n'intervient pas dans `calculer()`) à son inscription puis vidé ; vidé aussi
par un Petit sec (la donne est rejouée). Bouton « Cartes jouées » **dans le formulaire « Inscrire la donne »**
(`Saisie.tsx`), qui ouvre `EcranCartes` par-dessus sans quitter la saisie
(plus de route dédiée) ; journal repliable dans le détail d'une donne
(feuille et archive). `Saisie.tsx` recopie `cartesJouees` de la
donne éditée pour que la modification ne les perde pas. Hors périmètre :
validation « fournir/couper », écart du preneur, Excuse perdue au dernier pli.
**Après coup** : « Modifier cette donne » (feuille et archive) rouvre `Saisie` avec le même bouton « Cartes jouées » ; sur une donne existante, `Saisie` travaille sur une copie locale des cartes/du chien (rien n'est enregistré avant « Inscrire la donne », qui passe par `onModifierDonne` — circuit de modification existant, y compris la persistance de l'archive), alors que sur une nouvelle donne il écrit en direct dans le brouillon d'`App.tsx` (prop `brouillon`) pour survivre à « Fermer » et à un rechargement. Listes vides → champs retirés de la donne.
**Points déduits** (`deduireAttaque`, `utils/cartes.ts`, bloc « Déduit des cartes notées » de `Saisie.tsx`) : quand tous les plis (15/18/24) sont notés, l'app calcule les points de l'attaque — plis remportés par preneur/appelé, l'Excuse restant au camp de celui qui l'a jouée, les cartes jamais jouées formant l'écart du preneur (attaque, sauf Garde contre où le chien va à la défense) — ainsi que les bouts, lesquels, le petit au bout (Petit gagnant du dernier pli) et le chelem. Valeurs 4,5/3,5/2,5/1,5/0,5 (total 91, `valeurCarte`). Le bouton « Utiliser ces valeurs » **propose** (remplit points, bouts, bouts précis, petit au bout) sans rien imposer ni stocker ; `calculer()` inchangé. Main incomplète : message seulement. Limite : l'Excuse vaut 4,5 sans l'échange d'une carte à 0,5 pt (écart possible de 4 pts, signalé dans l'interface) ; une carte mal saisie fausse la déduction.
**Mains reconstituées** (`deduireMains`, `utils/cartes.ts`, `components/MainsJoueurs.tsx`, `EcranMains.tsx`) : bouton « Voir les mains » dans le détail d'une donne qui a des cartes notées (feuille et archive), plein écran en lecture seule. Main d'un joueur = les cartes qu'il a posées dans les plis (l'Excuse reste à celui qui l'a jouée) ; plis complets → les cartes jamais jouées sont l'**écart** du preneur (Petite/Garde) ou le chien non retourné (Garde sans/contre). Si le chien est noté, la **main de départ** du preneur = jouées + écart − chien, affichée en plus de sa main après écart. Rien n'est stocké (recalculé à l'affichage) ; les incohérences (carte en double, chien absent de la main du preneur, nombre de cartes jamais jouées anormal) sont signalées dans `anomalies` sans bloquer, et une main incomplète est annoncée comme partielle. Limite : une carte mal saisie fausse la reconstitution.
**Chien** : un second mode de la même page (« Chien (n/3) », 3 cartes à 5 joueurs, 6 à 3 ou 4 — `tailleChien`) note les cartes retournées au chien (Petite ou Garde) ; brouillon `chienEnCours` puis `Donne.chien`, affiché en tête du journal. Les cartes du chien restent jouables (le preneur peut les garder) et sont repérées en bleu.

**Classement en cours toujours visible + repère « en tête »** (`pages/Feuille.tsx`) :
la section « Classement » de la partie en cours n'était affichée que si
`rotation` était vrai (`nbTotal > parDonne`, joueurs au repos qui tournent)
— or la composition par défaut (5 joueurs à table, 5 par donne) n'a jamais
de rotation, donc le classement en cours ne s'affichait quasiment jamais en
pratique, contrairement à `ArchiveFeuille.tsx` (partie close) qui affiche
toujours un « Classement final ». Condition alignée sur celle de l'archive
(`donnes.length > 0` seul, plus de `rotation &&`), avec `testId="classement-row"`
posé sur les lignes pour cohérence avec l'archive. Ajout d'un repère
« En tête : {nom} {points} » directement dans le bloc d'info en haut de
l'écran (juste après « X distribue · Y entame ») pour une visibilité
immédiate sans avoir à faire défiler jusqu'à la section détaillée —
réutilise le `classement` déjà calculé pour cette section, `fmt()` pour le
préfixe `+`. En cas d'égalité, le premier de `classement` (ordre stable)
est affiché sans mention d'égalité, cohérent avec le traitement des
égalités ailleurs dans l'app (ex. l'aperçu « meneur » d'`Historique.tsx`).

**Modifier une donne d'une partie archivée** (`components/ArchiveFeuille.tsx`,
`pages/Historique.tsx`) : jusqu'ici « Modifier cette donne » n'existait que
sur la partie en cours (`Feuille.tsx`) — une erreur de saisie découverte
après la clôture d'une partie ne pouvait être corrigée nulle part.
`ArchiveFeuille.tsx` gagne le même bouton dans le détail d'une donne
(`ScoreGrid`), qui rouvre `Saisie.tsx` pré-rempli (composant réutilisé tel
quel). Contrairement à la partie en cours, `Historique.tsx` charge et
persiste lui-même l'archive (son propre effet lit déjà `cleArchive(id)`) :
il possède donc aussi l'écriture, plutôt que de la faire remonter en
intégralité à `App.tsx` — seul le résumé en cache dans `historiqueIndex`
(`totaux`, affiché dans les listes) a besoin d'une resynchronisation
explicite (`onModifierDonneArchive(id, totaux)`, nouvelle prop d'`App.tsx`
descendant jusqu'à `Historique.tsx` via `AppRoutes.tsx`, même pattern que
`onSupprimer`). Aucun recalcul supplémentaire à écrire pour les stats, le
classement Elo ou le classement final de l'archive elle-même : ils sont
déjà tous recalculés à la volée depuis `donnes` à chaque affichage (aucun
agrégat stocké), donc une correction se répercute automatiquement partout.
Reste volontairement scopé à la modification seule : ajouter ou effacer
une donne reste réservé à la partie en cours (`Feuille.tsx`).

**Système de plusieurs tables ouvertes en même temps** (`pages/Tables.tsx`,
`App.tsx`, `router/AppRoutes.tsx`) : jusqu'ici une seule partie pouvait être
active à la fois (clé de stockage unique `tarot:partie:v4`), rendant
impossible de suivre deux tables physiques en parallèle (ex. une soirée à
deux tables, chacune sur son propre appareil, partageant le même compte).
L'accueil (`/`) est désormais la liste des tables actuellement ouvertes
(même pattern que l'Historique : index léger `tarot:tables` + enregistrement
complet par id `tarot:table:{id}`), avec un bouton « Nouvelle table » qui
mène à l'écran de composition, déplacé sur sa propre route
(`/composition`) ; `/tirage` et `/partie` gagnent chacune un `:id`. Un
joueur déjà assis à une table ouverte est bloqué s'il est saisi sur une
autre table en cours de composition (`joueursActuellementAssis`,
`utils/identite.ts`, résolu via `resoudreNom` puis comparé aux noms
saisis — même pattern que le blocage « Deux sièges ont le même nom » déjà
existant). `Historique.tsx`, `FicheJoueur.tsx`, `Classement.tsx` et le
garde-fou de fusion (`ontDejaJoueEnsemble`) n'ont eu besoin d'aucune
modification : entièrement découplés de la partie en cours dès l'origine.
`Feuille.tsx`/`Tirage.tsx` non plus : ils recevaient déjà leurs props à
plat (jamais l'objet `partie`/`tirage` entier), seul leur point d'entrée
dans les routes a changé. `App.tsx` ne charge plus la table en détail au
démarrage — seul l'index léger (`tablesIndex`) est chargé eagerly, une
table précise n'est chargée que lorsque sa route `/partie/:id` est visitée
(`chargerTable`), redirigeant vers `/` si l'id est inconnu. Migration
unique au démarrage : si `tarot:partie:v4` (ancien emplacement) existe
encore, il est converti en une table ouverte puis supprimé — pour ne pas
perdre une partie en cours d'un déploiement existant.

**Le preneur gagne/perd plus d'Elo que l'appelé** (`utils/elo.ts`) : jusqu'ici
le delta d'une donne était appliqué identique au preneur et à l'appelé, alors
que le preneur porte plus de responsabilité (c'est lui qui annonce le
contrat) et touche déjà 2 fois plus de points réels que l'appelé
(`calculer()`). Le delta du camp attaque (inchangé dans son calcul) est
maintenant réparti 2 parts pour le preneur, 1 part pour l'appelé — même
ratio que les points réels — normalisée pour que la moyenne des deux deltas
individuels reste égale au delta du camp (facteur `4/3` pour le preneur,
`2/3` pour l'appelé) : la magnitude globale du gain/perte de l'attaque ne
change pas, seule sa répartition interne. L'espérance de gain reste
volontairement une moyenne simple (non pondérée) des Elo du camp — seul le
résultat a posteriori distingue les deux rôles, pas la prédiction avant la
donne. `components/ExplicationElo.tsx` documente ce ratio en langage
courant.

**Explication du classement Elo + Elo affiché sur la fiche joueur**
(`components/ExplicationElo.tsx`, `pages/Classement.tsx`,
`pages/FicheJoueur.tsx`) : le classement Elo (`utils/elo.ts`) n'avait
jusqu'ici aucune explication en app de son fonctionnement — seul
`CLAUDE.md` (lu par les développeurs, pas par les joueurs) documentait la
logique. Nouveau composant partagé `ExplicationElo.tsx` (même pattern de
bloc repliable `<details>` que « Comment les points sont comptés » dans
`Feuille.tsx`), texte vulgarisé sans noms de fonctions, affiché tel quel
en bas de `Classement.tsx` et de `FicheJoueur.tsx`. La fiche joueur affiche
en plus une nouvelle section « Classement Elo » avec l'Elo actuel du
joueur consulté (absent jusqu'ici de cet écran) : son effet de chargement
des archives, qui ne récupérait auparavant que les parties de ce joueur,
charge désormais tout `historiqueIndex` (l'Elo étant global, son calcul a
besoin de toutes les donnes archivées, pas seulement celles de ce joueur)
— même fetch non filtré que fait déjà `Classement.tsx`.

**Bouts précis sur les appels de la fiche joueur** (`utils/regles.ts`,
`Saisie.tsx`, `utils/stats.ts`, `FicheJoueur.tsx`) : le compte `bouts`
(0-3) ne dit pas *lesquels* l'attaque détenait (Le Petit ? Le 21 ?
L'Excuse ?) — ces bouts auraient pu être obtenus dans le chien ou
capturés en jouant, sans que le simple compte le distingue. Nouveau champ
optionnel `boutsPrecis?: Bout[]` sur la donne (`Bout = "petit" | "21" |
"excuse"`), saisi via un sélecteur multiple dédié dans `Saisie.tsx`
(« Bouts précis du preneur », juste après le compteur existant) —
volontairement indépendant du compteur `bouts` : pas de validation
croisée entre les deux champs, cohérent avec le reste de la saisie qui
fait confiance à l'utilisateur plutôt que de recouper les données
(`calculer()` n'est pas modifié, ce champ est purement informatif). Ajouté
à `AppelPreneur` dans `utils/stats.ts` (`d.boutsPrecis ?? []` pour les
donnes archivées avant son introduction) et affiché entre parenthèses sur
chaque ligne des listes « Appels réussis »/« Appels échoués » de la fiche
joueur (ex. « Garde · 1 bout (Le Petit) »).

**Aucun joueur par défaut sur l'écran de composition** (`pages/
CompositionTable.tsx`) : le 1er siège pré-remplissait systématiquement
« Andry » (`nomsParDefaut`) — un reliquat des tout premiers tests manuels
du projet, sans raison de rester en production : les 5 sièges démarrent
maintenant vides comme les autres, et le bouton reste bloqué (« Encore 5
joueurs à nommer ») tant qu'aucun n'est nommé, cohérent avec le reste de
l'écran. `tests/app.game.test.tsx::remplirSieges` et le test de
glisser-déposer dans `tests/app.config.test.tsx` nomment désormais
explicitement le 1er siège (« Andry », par convention conservée dans ces
deux fichiers) plutôt que de compter sur le défaut disparu.

**Appels réussis/échoués sur la fiche joueur** (`utils/stats.ts`,
`pages/FicheJoueur.tsx`) : remplace « Contrats de prédilection » (un
classement par type de contrat jugé peu utile) par une vue centrée sur la
performance des appels — combien de donnes prises comme preneur ont
réussi ou chuté, avec pour chacune le contrat annoncé, le nombre de bouts
et les points bruts réalisés (sur 91, pas le score signé de la donne).
Nouveau type `AppelPreneur` (remplace `StatsContrat`), alimenté dans la
même boucle que le reste de `calculerStatsJoueur` (aucune passe
supplémentaire). Affiché en trois blocs : un résumé agrégé (compte +
moyennes de bouts/points par issue, sans distinction de contrat), puis
deux listes détaillées « Appels réussis »/« Appels échoués » (une ligne
par donne — contrat, bouts, points — triée du plus récent au plus ancien
comme « Parties jouées », avec renvoi vers l'archive via `ArchiveRow` —
même pattern que la liste des parties, à la granularité de la donne).

**Menu « Plus d'actions » sur l'écran Joueurs** (`pages/Configuration.tsx`) :
chaque ligne du trombinoscope actif affichait quatre actions toujours
visibles à plat (Stats, Renommer, Fusionner, Désactiver), alors que Stats
est de loin la plus utilisée en pratique. Seul « Stats » reste un lien
visible en permanence ; les trois autres sont désormais regroupées
derrière un bouton pictogramme (« ⋮ », `aria-label="Plus d'actions"`) qui
déploie un petit menu ancré à la ligne. Reste local à `Configuration.tsx`
(nouvel état `menuOuvert: string | null`, même pattern à un seul élément
ouvert que `renommage`/`fusionDepuis`) plutôt qu'extrait dans
`components/ui.tsx` : aucun autre écran n'a besoin d'un menu de ce type
pour l'instant, donc pas de primitive générique prématurée. Fermeture au
clic extérieur ou à Échap via un unique effet document-level, actif
seulement pendant qu'un menu est ouvert. Choisir une action dans le menu
le ferme et déclenche exactement le même comportement qu'avant
(`renommer`, `fusionner`, `basculerActif` inchangés — pure réorganisation
d'UI, y compris le style neutre du bouton « Désactiver », identique aux
deux autres). `tests/app.config.test.tsx` ouvre désormais explicitement
ce menu (clic sur le bouton « Plus d'actions » de la ligne) avant de
cliquer sur « Renommer »/« Fusionner ».

**Passphrase partagé** (`AuthGate.tsx`, `components/Verrou.tsx`,
`lib/firebase.ts`) : jusqu'ici, les règles Firestore restaient ouvertes en
lecture/écriture (`allow read, write: if true`) faute d'authentification
dans l'app — n'importe qui connaissant la config publique du projet
pouvait lire/écrire directement la collection, sans même passer par l'app.
Ajout de Firebase Auth (fournisseur email/mot de passe, un seul compte
partagé par toute la table — voir Persistance/Firebase) : `AuthGate.tsx`
n'affiche `<App/>` que si `onAuthStateChanged` rapporte un utilisateur
connecté, sinon `Verrou.tsx` (écran de saisie du passphrase, qui appelle
`signInWithEmailAndPassword` avec l'email fixe `VITE_TAROT_AUTH_EMAIL` et
le passphrase saisi comme mot de passe). Les règles Firestore passent à
`allow read, write: if request.auth != null` : sans passphrase, plus aucun
accès, dans l'app ou en dehors.

Deux pièges découverts en testant sans `.env` réel (déjà le cas toléré
partout ailleurs dans le code, ex. build/CI) — Firebase Auth est bien plus
« eager » que Firestore à l'initialisation :
- `getAuth()` démarre en interne un traitement asynchrone dès sa
  construction (indépendamment de tout appel à `onAuthStateChanged`) ; une
  clé API absente/vide le fait échouer via une `FirebaseError` non
  interceptable proprement, qui plantait tout le rendu React au lieu
  d'afficher le verrou. `lib/firebase.ts` laisse donc `auth` à `null` sans
  `VITE_FIREBASE_API_KEY`, plutôt que de construire un `Auth` invalide —
  `AuthGate.tsx`/`Verrou.tsx` traitent ce cas comme une config manquante
  (message dédié), pas comme une erreur de passphrase. Une config
  présente-mais-invalide (projet Firebase supprimé, etc.) reste un cas non
  couvert, hors périmètre ici.
- Le tout premier callback d'`onAuthStateChanged` suppose un minimum de
  réseau (détection de l'environnement) ; réseau coupé/lent le laisse en
  attente indéfiniment, ce qui bloquerait l'écran sur le fond vide affiché
  pendant le chargement, pour toujours. `AuthGate.tsx` réutilise le même
  délai que `firestoreStorage.ts` (`DELAI_MS`, exporté pour l'occasion) :
  passé ce délai sans nouvelle du SDK, on retombe sur « non connecté »
  (échec fermé, cohérent avec l'objectif de sécurité) plutôt que de rester
  bloqué ; si le callback finit par arriver plus tard, il met quand même à
  jour l'état normalement.

**Code-splitting des écrans à Recharts** (`router/AppRoutes.tsx`) : le
bundle de prod ne faisait qu'un seul chunk de 943 kB (267 kB gzip),
imposant Recharts (de loin la plus grosse dépendance) à *tous* les écrans,
y compris ceux sans le moindre graphique (`/`, `/tirage`, `/joueurs`,
`/classement`). `Historique`, `Feuille` et `FicheJoueur` (les trois seuls
écrans qui importent, directement ou via `ArchiveFeuille`/
`GraphiqueComparatif`/`GraphiquePersonnel`, un composant Recharts) sont
désormais chargés via `React.lazy(() => import(...))`, l'ensemble des
routes enveloppé dans un unique `<Suspense fallback={...}>` (fallback
minimal, cohérent avec l'écran vide affiché par `App.tsx` pendant le
chargement initial). Résultat : le chunk d'entrée tombe à 534 kB
(148 kB gzip), Recharts isolé dans son propre chunk chargé à la demande.
Les autres écrans (`CompositionTable`, `Tirage`, `Configuration`,
`Classement`) restent importés normalement — inutile de les rendre
paresseux, ils ne tirent pas Recharts. Impact sur les tests : les
transitions vers ces trois écrans doivent maintenant utiliser
`findBy*`/`await` plutôt que `getBy*` synchrone juste après un clic de
navigation (le composant n'est plus disponible au premier rendu, le temps
que l'`import()` se résolve) — déjà le cas pour la plupart des assertions
existantes, corrigé sur les deux qui ne l'étaient pas
(`tests/app.game.test.tsx`, recherche de `archive-row`).

**Poignée nominative** (`utils/regles.ts`, `Saisie.tsx`, `ScoreGrid.tsx`) :
à l'origine, la poignée était une valeur unique par donne (`poignee: string`)
et son signe suivait mécaniquement la réussite ou la chute du contrat — en
pratique, ça l'attribuait toujours au camp gagnant, jamais à un joueur
précis. Or la vraie règle est que la poignée est montrée par un joueur
donné, et revient au camp de ce joueur **indépendamment** du résultat du
contrat (un défenseur peut la montrer alors que l'attaque réussit son
contrat — la poignée profite quand même à la défense ; symétriquement pour
l'attaque en cas de chute). Remplacé par `poignees: PoigneeDeclaree[]`
(`{ id, joueur, taille }`), saisi comme une liste dans `Saisie.tsx` — même
pattern d'ajout/retrait que `miseres`, puisque plusieurs joueurs peuvent
chacun en déclarer une dans la même donne (y compris de camps différents,
auquel cas elles se cumulent indépendamment). `calculer()` détermine le
camp de chaque déclaration (attaque si `joueur` est le preneur ou l'appelé,
défense sinon) et ajoute sa valeur signée en conséquence, sans lien avec le
signe du contrat. L'ancien champ `poignee` (singulier) reste lu pour les
donnes déjà archivées : faute de savoir quel joueur l'a montrée sur ces
archives-là, `calculer()` retombe sur l'ancien calcul (approximatif,
suivait le signe du contrat) plutôt que de deviner un camp.

**Modification d'une donne déjà saisie** (`Feuille.tsx`, `Saisie.tsx`) :
dans le détail d'une donne (clic sur sa ligne dans `ScoreGrid`), bouton
« Modifier cette donne » à côté de « Effacer cette donne ». Rouvre
`Saisie.tsx` pré-rempli avec les valeurs de cette donne (nouvelle prop
`donneInitiale?: Donne`, utilisée pour initialiser chaque `useState` —
fonctionne sans `useEffect`/`key` car la modale est démontée/remontée à
chaque ouverture, donc l'initialiseur relit toujours la prop à jour).
`Feuille.tsx` distingue les deux usages de la modale (nouvelle donne vs.
modification) via un seul état `{ index: number | null }` plutôt que deux
booléens séparés : `index === null` → ajoute via `onAjouterDonne`,
`index === k` → remplace `donnes[k]` en place via `onModifierDonne(k, d)`
(`App.tsx`) sans changer sa position dans le tableau ni son "numéro" de
donne. `Effacer cette donne` reste scopé à la partie **en cours**
uniquement (`ArchiveFeuille.tsx` ne reçoit pas ce bouton) ; « Modifier
cette donne », lui, est aussi disponible sur une partie **archivée**
(voir plus bas).

**Graphiques de progression** (issue #11, `components/GraphiqueComparatif.tsx`
et `components/GraphiquePersonnel.tsx`, librairie **Recharts** — choix
explicite de l'utilisateur plutôt que du SVG à la main prévu à l'origine,
seule exception à la convention « pas de librairie de composants ») : deux
vues distinctes, comme demandé —
- **Vue comparative** (`GraphiqueComparatif.tsx`, affichée dans `Feuille.tsx`
  et `ArchiveFeuille.tsx`, juste après `StatsPartie`) : tous les joueurs
  d'une partie superposés sur l'axe de ses donnes globales. Les plateaux
  pour un joueur au repos pendant une rotation ne demandent aucun
  traitement particulier : la source (`resumerDonnees(donnes, nbTotal).cumuls`,
  déjà utilisée par `ScoreGrid`) porte déjà le cumul inchangé d'une donne à
  l'autre quand le joueur ne joue pas, donc la ligne dessine un plateau
  naturellement.
- **Fiche joueur** (`GraphiquePersonnel.tsx`, dans `FicheJoueur.tsx`) : axe
  personnel dense — uniquement les donnes réellement jouées par ce joueur,
  toutes parties confondues, dans l'ordre chronologique. Nécessite un champ
  `trajectoire` supplémentaire sur `StatsJoueur` (`utils/stats.ts`),
  calculé par une passe **séparée** du reste de `calculerStatsJoueur` : les
  parties y sont triées par date (`new Date(a.date) - new Date(b.date)`)
  avant d'être parcourues, alors que la boucle principale (qui alimente
  `stats.parties`, affiché le plus récent en premier) garde volontairement
  l'ordre reçu en entrée — les deux ordres sont testés explicitement dans
  `stats.test.ts` pour que cette distinction ne régresse pas silencieusement.
  `detailPourJoueur(d, idx, nbTotal)` (rôle + points + réussite pour un
  joueur sur une donne, ou `null` s'il est au repos) factorise ce que les
  deux passes ont en commun.

**Statistiques sur les donnes d'une partie** (issue #8, `utils/statsPartie.ts`,
écran `StatsPartie.tsx`, affiché dans `Feuille.tsx` et `ArchiveFeuille.tsx`)
: distinct de la fiche joueur cumulée (`stats.ts`/`FicheJoueur.tsx`, qui
résout les fusions et agrège sur tout l'historique) — ici on travaille sur
la seule liste `donnes` d'**une** partie, avec les noms de sièges de cette
partie, sans identité ni historique à résoudre. Affiche : contrats
réussis/chutés, mains avec appelé vs. preneur seul (uniquement comptées
pour les donnes jouées à 5 — `res.table.length === 5`, comme dans
`calculer()`), fréquence par roi appelé et par joueur appelé. Les deux
questions ouvertes de l'issue étaient déjà tranchées par des décisions
antérieures : le modèle `Donne` a déjà `roiAppele` précis (issue #9), et le
calcul est à la volée depuis `donnes`, sans agrégat stocké (même
philosophie que `stats.ts`/`elo.ts`). `NOM_ROI` (libellés des couleurs)
centralisé dans `utils/regles.ts`, réutilisé par `Saisie.tsx`,
`FicheJoueur.tsx` et `StatsPartie.tsx` plutôt que dupliqué trois fois.

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

**Boutons « Accueil » / « Clôturer » dans l'écran Partie** (`Feuille.tsx`,
`App.tsx`) : à l'introduction du système de plusieurs tables, les deux
boutons de sortie de l'écran Partie appelaient tous deux le même
`fermerTable(archiver)`, qui supprimait *toujours* `tarot:table:{id}` —
que `archiver` soit vrai ou faux. Autrement dit, « Accueil » (qui devait
être un simple retour sans conséquence) supprimait en réalité
définitivement la table et ses donnes non archivées, un reliquat de
l'ancien système à une seule table (où quitter signifiait forcément
archiver ou tout perdre) resté incohérent avec le nouveau système où une
table peut rester ouverte indéfiniment. Corrigé en deux fonctions
distinctes dans `App.tsx` :
- `quitterPartie` (« Accueil ») : ne touche à rien, remet juste l'état
  local à zéro et retourne à `/` — la table reste ouverte en base,
  reprenable plus tard depuis la liste. Un seul clic, sans confirmation
  (rien n'est perdu).
- `cloturerPartie` (« Clôturer », renommé depuis « Nouvelle » — le
  bouton ne démarre d'ailleurs pas une nouvelle table directement, il
  retourne à la liste comme « Accueil » ; seule la clôture/archivage
  change) : archive la table si des donnes ont été jouées, puis supprime
  `tarot:table:{id}` et retire l'entrée de `tarot:tables`. Garde le
  pattern de confirmation en deux clics (« Confirmer ? »), cohérent avec
  `Supprimer` dans `Historique.tsx`.

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
appels réussis/échoués (contrat, bouts, bouts précis si connus, points réalisés), rois appelés, nombre de
fois appelé, meilleure/pire donne, liste des parties avec renvoi vers
l'archive.

**Classement général Elo** (issue #10, `utils/elo.ts`, écran `Classement.tsx`,
route `/classement`, lien depuis `CompositionTable.tsx`) : décisions prises
en discussion avant développement (le tarot n'étant pas un jeu 1v1, l'Elo
classique ne s'applique pas directement) —
- un match par **donne** archivée, pas par partie complète (plus de
  données, cohérent avec le calcul par-donne déjà fait dans `stats.ts`) ;
- un seul Elo **global** par joueur (pas d'Elo séparé par rôle), mais le
  gain/perte d'une donne distingue quand même preneur et appelé (voir plus
  bas) ;
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
  standard) ; côté défense, le même delta est ensuite appliqué à chaque
  défenseur, sans le diviser entre eux ;
- côté attaque en revanche, le preneur et l'appelé ne reçoivent pas le même
  delta : répartition pondérée 2 parts (preneur) / 1 part (appelé) — même
  ratio que la répartition des points réels de la donne (`calculer()` :
  `2×base`/`1×base`) — normalisée pour que la moyenne des deux deltas
  individuels reste égale au delta du camp (donc `4/3` pour le preneur,
  `2/3` pour l'appelé). L'espérance de gain, elle, reste basée sur la
  moyenne simple des Elo du camp attaque, non pondérée — seule la
  répartition du résultat après coup distingue les deux rôles, pas la
  prédiction avant la donne ;
- 1500 de départ, K-facteur 24 (valeurs Elo conventionnelles) ; pas de
  traitement spécial pour les joueurs à faible historique ;
- recalcul complet à chaque affichage en rejouant toutes les donnes
  archivées par ordre chronologique (même philosophie que `stats.ts` : pas
  d'agrégat stocké, donc pas de désynchronisation possible après une fusion
  de fiches — `calculerClassementElo` résout chaque identifiant de siège
  via `resoudreFiche` avant d'appliquer les deltas).

`Classement.tsx` et `FicheJoueur.tsx` affichent chacun, en bas d'écran, un
bloc repliable expliquant ce fonctionnement en langage courant (texte
partagé, `components/ExplicationElo.tsx`, vulgarisé à partir du rationale
ci-dessus). La fiche joueur affiche en plus l'Elo actuel de ce joueur
précis (section « Classement Elo », absente jusqu'ici de cet écran) : son
effet de chargement charge désormais **tout** `historiqueIndex` (pas
seulement les parties de ce joueur, comme avant) puisque l'Elo est global
et dépend de toutes les donnes archivées — même fetch non filtré que fait
déjà `Classement.tsx`, pas un nouveau souci de perf à l'échelle actuelle.

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
  bruts. Exception délibérée : **Recharts** pour les graphiques de
  progression (issue #11, choix explicite de l'utilisateur plutôt que du
  SVG dessiné à la main) — `GraphiqueComparatif.tsx`/`GraphiquePersonnel.tsx`
  restylent ses composants (`stroke`/`contentStyle`/…) pour coller au thème
  sombre plutôt que d'utiliser un thème Recharts par défaut. Fonctionne
  sans polyfill sous jsdom (les tests d'intégration qui montent `Feuille`
  passent tel quel, `ResponsiveContainer` ne plante pas).
  La navigation entre écrans passe par `react-router-dom`
  (`BrowserRouter` monté dans `main.tsx`), une route par écran, définies
  dans `router/AppRoutes.tsx` :
  `/` (liste des tables ouvertes), `/composition` (composition d'une
  nouvelle table), `/tirage/:id` (tirage du donneur pour cette table),
  `/partie/:id` (feuille de score de cette table), `/joueurs` (configuration
  du trombinoscope), `/joueurs/:id` (fiche statistique d'un joueur),
  `/historique` et `/historique/:id` (liste et détail d'une archive),
  `/classement` (classement général Elo).
  `/tirage/:id` et `/partie/:id` vérifient que l'id de la route correspond
  à une table connue de cet onglet (`tirage.id` en mémoire pour la
  première, `tarot:table:{id}` chargé à la demande pour la seconde) : si
  l'état attendu est absent (ex. rechargement direct sur un tirage en
  cours, ou id d'une table inconnue/supprimée), la route redirige vers `/`
  plutôt que planter — `tirage` n'est d'ailleurs jamais persisté, seules
  les tables ouvertes le sont. Le déploiement statique (Vercel) nécessite
  un fallback SPA vers `index.html` (`vercel.json`).
- `window.storage` ne doit jamais être appelé en dehors d'un `try/catch` —
  `get()` lève sur une clé absente, c'est le cas normal au premier lancement
  (et Firestore peut aussi lever sur une erreur réseau). Typé dans
  `lib/window-storage.d.ts`, implémenté par `lib/firestoreStorage.ts`,
  branché dans `main.tsx` avant le premier rendu.
