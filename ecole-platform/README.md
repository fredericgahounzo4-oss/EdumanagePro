# EduManage Pro — Frontend

Application React (Vite + TypeScript) pour la plateforme de gestion scolaire.
Connectée à l'API Django dans `../backend`.

> Pour déployer sur Render (avec le backend), voir le README à la racine du
> dépôt. Ce fichier couvre l'installation locale.

## Installation

```bash
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:8000/api par défaut
npm run dev
```

L'application tourne sur `http://localhost:5173/`. **Le backend Django doit
être lancé au préalable** (voir `../backend/README.md`) — sans lui, l'écran
de connexion s'affiche mais aucune donnée ne peut être chargée.

## Comptes de démo

Mot de passe unique : **`password123`** (créés par `python manage.py seed_data`
côté backend).

| Rôle | Email |
|---|---|
| Admin | admin@ecole.tg |
| Professeur (titulaire 6ème A) | prof@ecole.tg |
| Professeur (non-titulaire) | sena.adjovi@ecole.tg |
| Parent | parent@ecole.tg |
| Surveillant | surveill@ecole.tg |

## Architecture de la connexion à l'API

- `src/api/client.ts` — client HTTP bas niveau : stockage des tokens JWT
  (`localStorage`), rafraîchissement automatique sur 401, pagination DRF.
- `src/api/mappers.ts` — convertit les réponses Django (snake_case, id
  numériques) vers les types frontend existants (`src/types/index.ts`,
  camelCase, id en string) — ainsi tout le code d'affichage déjà écrit
  fonctionne sans changement.
- `src/api/resources.ts` — fonctions CRUD typées par ressource
  (`fetchClasses`, `createNote`, `updatePaiementStatus`, ...).
- `src/context/AuthContext.tsx` — authentifie contre `/api/auth/login/`,
  restaure la session au chargement via `/api/auth/me/`.

**Important** : le filtrage par rôle (un prof ne voit que ses classes, un
parent que ses enfants, etc.) est appliqué **côté serveur** — les fonctions
de `src/utils/permissions.ts` restent utilisées côté frontend uniquement
pour l'affichage (masquer une colonne, désactiver un champ), pas comme
barrière de sécurité : la vraie barrière est dans l'API Django.

## Build de production

```bash
npm run build
```

Génère `dist/`, à servir par n'importe quel serveur de fichiers statiques
(Nginx, Vercel, Netlify...). Pensez à définir `VITE_API_URL` vers l'URL
réelle de votre API Django en production avant le build.
