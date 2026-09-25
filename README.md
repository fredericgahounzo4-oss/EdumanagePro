# SchoolManager Pro

Plateforme de gestion scolaire **multi-établissements** pour le Togo : élèves, notes, présences, enseignants (avec affectations classe/matière), emplois du temps, examens, classement par classe et série, tableau de bord avec graphiques, et génération de bulletins PDF (format Privé ou Public/Officiel selon l'école).

Une seule application dessert toutes les écoles inscrites : chaque établissement a ses propres comptes et ses propres données, totalement isolés des autres écoles.

**Pour le déploiement et le mode d'emploi complets, voir les documents fournis dans `documentation/` :**
- `Guide-Installation.docx` — déploiement sur Vercel + Neon (hébergement)
- `Manuel-Utilisateur.docx` — mode d'emploi complet de l'application

## Architecture

- **Base de données** : PostgreSQL (hébergée sur [Neon](https://neon.tech)) — schéma dans `db/schema.sql`
- **Backend** : Node.js / Express (`server/`), déployé comme fonction serverless sur Vercel (`api/index.js`)
- **Frontend** : React + Vite (`client/`), servi statiquement par Vercel

## Démarrage rapide (développement local)

Prérequis : Node.js 18+, et un PostgreSQL accessible (local ou Neon).

```bash
# 1. Initialiser la base
psql "postgres://postgres:postgres@localhost:5432/schoolmanager" -f db/schema.sql

# 2. Démarrer le serveur (API)
cd server
npm install
DATABASE_URL="postgres://postgres:postgres@localhost:5432/schoolmanager" JWT_SECRET="dev-secret" npm start

# 3. Dans un autre terminal : builder puis servir le frontend
cd client
npm install
npm run build
```

Ouvrez ensuite **http://localhost:4000** : le serveur sert directement l'interface buildée.

## Déploiement en production

Voir `documentation/Guide-Installation.docx` pour la procédure complète (création de la base sur Neon, déploiement sur Vercel, variables d'environnement `DATABASE_URL` et `JWT_SECRET`).

## Première connexion

Au tout premier accès à l'application (base vide), l'écran demande de créer le compte **Super Administrateur** — le compte qui gère la liste des écoles sur la plateforme (pas rattaché à un établissement en particulier).

Une fois connecté, le Super Administrateur crée les écoles depuis le menu **Écoles**, en renseignant pour chacune : son nom, son type (Privé/Public — détermine le format des bulletins), ses niveaux enseignés (Primaire/Collège/Lycée), et les identifiants de son premier compte Administrateur.

Chaque administrateur d'école se connecte ensuite avec son propre identifiant, à la même adresse, et ne voit que les données de son établissement.

## Rôles

| Rôle | Portée | Droits |
|---|---|---|
| **Super Administrateur** | Toute la plateforme | Créer/supprimer des écoles |
| **Administrateur** | Une école | Élèves, bulletins, export, enseignants, emplois du temps, examens, matières, comptes, paramètres, présences, notes |
| **Enseignant** | Une école, classes assignées uniquement | Saisie des notes (y compris feuille de notes collective), présences, consultation des résultats |

## Modules fonctionnels

- Authentification multi-rôles avec isolation par établissement
- Élèves — CRUD, recherche, tri alphabétique
- Classes, niveaux, séries (y compris Seconde), matières configurables par classe/série
- Notes : saisie individuelle ou **feuille de notes collective** (classe entière en un seul écran)
- Moyennes, mentions, classement automatique par niveau/classe/série
- Présences avec statistiques, limitées aux classes assignées pour les enseignants
- Bulletins PDF (deux formats : Privé / Public-Officiel), avec logo d'établissement
- Tableau de bord avec graphiques (camembert, barres)
- Gestion des enseignants avec affectations multiples (classe + matière)
- Gestion des emplois du temps et des examens
- Export Excel des données d'une école

## Évolutions futures possibles

- Gestion des frais de scolarité et des cartes scolaires
- Sous-domaine personnalisé par école (ex : `baguida.schoolmanager.tg`)
- Application mobile
