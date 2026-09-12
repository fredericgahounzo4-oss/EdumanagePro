# EduManage Pro

Plateforme de gestion scolaire — backend Django (`backend/`) + frontend React (`ecole-platform/`).

Ce dépôt est structuré comme un **monorepo** : les deux projets vivent
côte à côte, chacun déployé comme un service Render séparé à partir du
même dépôt GitHub. La base de données Postgres est hébergée sur
**[Neon](https://neon.tech)** plutôt que sur Render (plan gratuit plus
généreux, et évite la limite "une seule base Postgres gratuite par compte
Render").

## 1. Pousser le code sur GitHub

Depuis la racine de ce dossier (celle où se trouve ce README) :

```bash
git init
git add .
git commit -m "Initial commit — EduManage Pro"
```

Puis créez un nouveau dépôt **vide** sur [github.com/new](https://github.com/new)
(ne cochez ni README ni .gitignore ni licence — le dépôt doit être vide),
et connectez-le :

```bash
git remote add origin https://github.com/<votre-compte>/<nom-du-depot>.git
git branch -M main
git push -u origin main
```

## 2. Créer la base de données sur Neon

1. Créez un compte sur [neon.tech](https://neon.tech) (gratuit, pas de carte requise).
2. **New Project** → donnez-lui un nom (ex. `edumanage`) → pour la région,
   choisissez **AWS Europe centrale 1 (Francfort)** (pas de région Afrique
   chez Neon — Francfort est le point le plus proche et le mieux connecté
   au Togo/Afrique de l'Ouest parmi les options). Le `render.yaml` de ce
   dépôt place déjà le backend Render dans la même région (`frankfurt`) —
   important pour que Django et la base ne fassent pas d'aller-retour
   intercontinental à chaque requête.
3. Sur la page du projet, section **Connection string** : choisissez le mode
   **Pooled connection** (important — Django + gunicorn ouvrent plusieurs
   connexions simultanées, la version "pooled" passe par PgBouncer et évite
   d'épuiser la limite de connexions du plan gratuit).
4. Copiez cette chaîne — elle ressemble à :
   `postgresql://<user>:<password>@ep-xxxx-pooler.<region>.aws.neon.tech/<db>?sslmode=require`
   Gardez-la de côté, elle sert de `DATABASE_URL` à l'étape suivante.

## 3. Déployer sur Render

### Option A — Déploiement en un clic (Blueprint, recommandé)

Ce dépôt contient un fichier `render.yaml` à la racine qui décrit les deux
services nécessaires : le backend et le site statique frontend (pas de
base de données Render — on utilise Neon).

1. Sur [render.com](https://dashboard.render.com), cliquez sur **New +** → **Blueprint**.
2. Connectez votre dépôt GitHub.
3. Render détecte `render.yaml` et demande deux valeurs avant de déployer :
   - `DATABASE_URL` → collez la chaîne de connexion Neon copiée à l'étape 2
   - `CORS_ALLOWED_ORIGINS` → laissez vide pour l'instant, à corriger à l'étape 4
     (ou pré-remplissez `https://edumanage-frontend.onrender.com` si ce nom
     de service n'est pas déjà pris)
4. **Deploy Blueprint**.

### Option B — Configuration manuelle (si vous préférez, ou sans Blueprint)

**Backend** : New + → Web Service → connectez le dépôt →
- Root Directory : `backend`
- Runtime : Python 3
- Build Command : `./build.sh`
- Start Command : `gunicorn edumanage.wsgi:application`
- Variables d'environnement :
  - `DJANGO_SECRET_KEY` → générez une valeur aléatoire longue
  - `DJANGO_DEBUG` → `False`
  - `DJANGO_ALLOWED_HOSTS` → `.onrender.com`
  - `DATABASE_URL` → la chaîne de connexion Neon (mode "Pooled connection", étape 2)
  - `CORS_ALLOWED_ORIGINS` → à renseigner à l'étape 4

**Frontend** : New + → Static Site → connectez le dépôt →
- Root Directory : `ecole-platform`
- Build Command : `npm install && npm run build`
- Publish Directory : `dist`
- Variable d'environnement `VITE_API_URL` → à renseigner à l'étape 4

## 4. Relier les deux services (obligatoire, quelle que soit l'option ci-dessus)

Une fois les deux services déployés une première fois, vous avez deux URLs
du type :
- Backend : `https://edumanage-backend-xxxx.onrender.com`
- Frontend : `https://edumanage-frontend-xxxx.onrender.com`

Allez dans les paramètres (**Environment**) de chaque service et définissez :

| Service | Variable | Valeur |
|---|---|---|
| **edumanage-backend** | `CORS_ALLOWED_ORIGINS` | `https://edumanage-frontend-xxxx.onrender.com` (l'URL exacte du frontend, sans `/` final) |
| **edumanage-frontend** | `VITE_API_URL` | `https://edumanage-backend-xxxx.onrender.com/api` (l'URL du backend **+ `/api`**) |

Sauvegardez — Render relance automatiquement un déploiement pour chaque
service modifié. Le frontend doit être **rebuild** après avoir changé
`VITE_API_URL` (une variable Vite est figée au moment du build, pas lue à
l'exécution) — c'est automatique via "Save, rebuild and deploy".

## 5. Seul le compte admin est créé automatiquement

Le `build.sh` exécute `python manage.py create_admin` à chaque déploiement
du backend — **un seul compte est créé, l'admin, promu superutilisateur
Django** (accès à `/admin/`). Aucune fausse donnée de démo (pas de classes,
élèves, profs ou paiements fictifs) : c'est un vrai départ propre.

**Avant le premier déploiement**, définissez vos propres identifiants admin
dans les variables d'environnement du service backend sur Render (au lieu
des valeurs par défaut peu sûres) :

| Variable | Valeur |
|---|---|
| `DJANGO_ADMIN_EMAIL` | votre vrai email admin |
| `DJANGO_ADMIN_PASSWORD` | un mot de passe fort de votre choix |

Une fois connecté avec ce compte, c'est à l'admin de créer les comptes
Professeur et Surveillant depuis la page **"Comptes"** de l'interface, et
les élèves depuis la page **"Élèves"** (les parents créent eux-mêmes leur
compte via "Créer un compte" sur l'écran de connexion).

Relancer `create_admin` à un déploiement suivant ne réinitialise jamais un
mot de passe déjà changé — sans danger.

*Pour tester rapidement avec des données factices (démo/développement
uniquement), la commande `python manage.py seed_data` existe toujours
localement — voir `backend/README.md`. Ne l'utilisez pas en production.*

## 6. Vérifier

- Backend : `https://edumanage-backend-xxxx.onrender.com/api/auth/login/`
  doit répondre (405 Method Not Allowed sur un GET est normal — c'est un
  endpoint POST uniquement, ça prouve juste que le serveur répond).
- Frontend : ouvrez l'URL du site statique, l'écran de connexion doit
  s'afficher, et la connexion avec le compte admin (celui défini via
  `DJANGO_ADMIN_EMAIL`/`DJANGO_ADMIN_PASSWORD`) doit fonctionner.

## Limites des plans gratuits à connaître

- Le service backend Render gratuit s'endort après 15 minutes d'inactivité —
  le premier chargement après une pause peut prendre 30-60 secondes.
- Neon (plan gratuit) met en pause le calcul après ~5 minutes d'inactivité —
  la première requête après une pause peut être un peu plus lente le temps
  qu'il se réactive, mais les données ne sont jamais perdues (contrairement
  à l'expiration à 90 jours du plan Postgres gratuit de Render).
- Neon gratuit limite le stockage (0.5 Go) et le temps de calcul mensuel —
  largement suffisant pour une démo ou un petit établissement, à surveiller
  si l'usage grandit.

## Structure du dépôt

```
.
├── render.yaml          <- Blueprint Render (les 3 services)
├── backend/             <- API Django (voir backend/README.md)
└── ecole-platform/      <- Frontend React/Vite (voir ecole-platform/README.md)
```
