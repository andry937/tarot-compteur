# Feuille de marque — Tarot à la française

Application React de comptage de points pour le tarot à la française, jouée
en soirée avec rotation des joueurs. Pas de backend : persistance via
`window.storage` (API clé-valeur async fournie par l'environnement Claude
artifacts — `get`/`set`/`delete`/`list`, `get` lève une erreur sur une clé
absente plutôt que de renvoyer `null`).

Toute la conversation qui a produit ce projet est résumée ci-dessous ; ce
fichier remplace le besoin de la relire.

## Démarrer

```bash
npm install
npm test              # suite complète (43 tests, doit passer à 100%)
npm run test:watch
```

Pas de serveur de dev configuré (le projet n'a jamais tourné hors de
l'environnement artifacts + de la suite de tests). Si l'objectif devient de
le faire tourner en vrai dans un navigateur, il manque un point d'entrée
Vite classique (`index.html` + `main.jsx` qui monte `<App />`) — c'est la
première chose à ajouter.

## Architecture

```
src/
  regles.js               règles du tarot + moteur de score — pur, sans React
  identite.js              registre des joueurs (identités stables, fusion) — pur, sans React
  stockage.js               clés de persistance centralisées
  styles.js                 CSS partagé (template string, injecté via <style>{CSS}</style>)
  App.jsx                   composant racine : état, routing entre écrans, effets de persistance
  composants/
    Saisie.jsx               formulaire modal de saisie d'une donne
    Tirage.jsx                tirage du donneur (aléatoire ou désignation manuelle)
    Historique.jsx            liste des parties closes + ouverture d'une archive
    ArchiveFeuille.jsx        feuille en lecture seule d'une partie archivée
    Configuration.jsx         écran de gestion du trombinoscope

tests/
  setup.js                   faux window.storage en mémoire + jest-dom
  rules.test.js               unitaires : regles.js + identite.js (33 tests)
  app.game.test.jsx           intégration : parcours complet d'une partie (5 tests)
  app.config.test.jsx         intégration : drag&drop + écran Joueurs (5 tests)
```

**Règle de dépendance** : `regles.js` et `identite.js` n'importent jamais
React ni les autres modules — c'est ce qui les rend testables sans monter de
composant. Un écran importe `CSS` depuis `styles.js` seulement s'il injecte
lui-même une balise `<style>` (voir « Piège connu » plus bas) ; `Saisie.jsx`
et `ArchiveFeuille.jsx` n'en ont pas besoin car ils s'affichent toujours à
l'intérieur d'un écran qui l'a déjà fait.

## Piège connu (déjà corrigé une fois, peut se reproduire)

Le split en fichiers séparés a introduit deux régressions silencieuses,
trouvées uniquement grâce aux tests :

1. `ROMAINS` et `nomAtout` n'étaient pas exportés dans le fichier
   monolithique d'origine (inutile puisque tout était dans la même portée).
   En extrayant `Tirage.jsx`, l'import manquant a cassé le tirage.
2. `Tirage.jsx` faisait `<style>{CSS}</style>` sans importer `CSS`. Comme
   c'est un module ES en environnement navigateur/jsdom, l'identifiant libre
   `CSS` s'est résolu vers l'objet global `window.CSS` (API CSSOM, qui a une
   méthode `.escape`) au lieu de lever une `ReferenceError` — React a alors
   tenté de rendre cet objet comme enfant et a planté avec un message
   trompeur (« object with keys {escape} »).

**Leçon pour toute future extraction/refactor** : après avoir déplacé du
JSX dans un nouveau fichier, vérifier systématiquement que chaque
identifiant libre utilisé est soit importé, soit déclaré localement — ne
pas se fier à la compilation seule (esbuild ne signale pas un identifiant
qui se résout par accident vers un global du navigateur/jsdom). Un script
de vérification croisée (usage vs import, par symbole exporté connu) a été
utilisé pour ce diagnostic ; le refaire après tout nouveau découpage de
fichier est plus fiable qu'une relecture manuelle.

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
  reste
- **Petit sec** (le seul atout d'un joueur est Le Petit, sans l'Excuse) :
  annoncé *avant* les enchères, annule la donne et la redonne (même
  donneur), aucun effet sur le score. Panneau dédié dans l'écran de la
  feuille en cours (« Petit sec ? Annuler la donne »).
- **Misère** (règle Tarot-Bière, pas FFT officielle) : un joueur sans aucun
  atout ou sans aucun honneur peut l'annoncer après la prise du chien,
  avant la première carte. Chaque *autre* joueur à table lui paie 10
  points, y compris ses propres coéquipiers — indépendant du multiplicateur
  de contrat. Annoncée à tort, le paiement s'inverse. Saisi comme un
  tableau `miseres` sur la donne, dans le formulaire `Saisie.jsx`.

## Où en est le projet

**Fait** : registre à identités stables avec fusion, saisie complète d'une
donne (avec misère et primes), Petit sec, rotation avec repos, tirage du
donneur (aléatoire + désignation manuelle), historique + archives en
lecture seule, écran de configuration du trombinoscope, glisser-déposer
pour réordonner les sièges, suite de tests complète.

**Pas commencé (« Lot 2 » dans la conversation d'origine)** — statistiques
cumulées à travers toutes les parties :
1. `roleDe(donne, resultatCalculer, i)` → `"preneur" | "appele" | "defense" | "repos"`,
   helper manquant pour toute stat par rôle
2. Agrégat `tarot:stats:v1` : compteurs additifs par joueur (parties, donnes,
   points, meilleure/pire donne, décomposition par rôle, contrats pris,
   primes), liste des parties déjà intégrées (idempotence), reconstructible
   entièrement depuis les archives
3. Mise à jour incrémentale à l'archivage + rattrapage à l'ouverture de
   l'écran stats + recalcul complet après toute fusion
4. Écran palmarès : classement par **moyenne par donne jouée** (pas le
   total brut, trompeur avec la rotation), total en secondaire, seuil
   minimum de donnes avant classement (valeur non tranchée)
5. Fiche joueur : stats de rôle, contrats de prédilection, meilleures/pires
   donnes, liste des parties avec renvoi vers la feuille archivée
6. Graphique de progression en SVG à la main (pas de librairie de charts
   disponible dans l'environnement d'origine) : vue comparative sur l'axe
   des donnes globales (plateaux visibles pour les joueurs au repos, assumé)
   + fiche joueur sur son axe personnel dense

Points explicitement laissés ouverts dans la conception : le seuil de
donnes minimum avant classement, et le traitement des formats mixtes
(tables à 4 et à 5 mélangées) dans les moyennes cumulées.

## Conventions

- Tout est en français : noms de variables, commentaires, texte affiché.
- CSS-in-JS via template string unique (`styles.js`), pas de fichier
  `.css` séparé — cohérent avec le fonctionnement en artifact d'origine.
- Pas de librairie de composants ni de state manager : `useState`/`useEffect`
  bruts. La navigation entre écrans passe par `react-router-dom`
  (`BrowserRouter` monté dans `main.jsx`) : `/` pour la partie en cours
  (composition de la table, tirage, feuille — ces étapes séquentielles
  restent gérées par l'état local, pas par des routes), `/joueurs` pour la
  configuration du trombinoscope, `/historique` et `/historique/:id` pour
  la liste et le détail d'une archive. Le déploiement statique (Vercel)
  nécessite un fallback SPA vers `index.html` (`vercel.json`).
- `window.storage` ne doit jamais être appelé en dehors d'un `try/catch` —
  `get()` lève sur une clé absente, c'est le cas normal au premier lancement.
