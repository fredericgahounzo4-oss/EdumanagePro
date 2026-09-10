# EduManage Pro

Plateforme de gestion scolaire — backend Django (`backend/`) + frontend React (`ecole-platform/`).

Ce dépôt est structuré comme un **monorepo** : les deux projets vivent
côte à côte, chacun déployé comme un service Render séparé à partir du
même dépôt GitHub.

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

## 2. Déployer sur Render

### Option A — Déploiement en un clic (Blueprint, recommandé)

Ce dépôt contient un fichier `render.yaml` à la racine qui décrit les trois
briques nécessaires : la base Postgres, le service backend, et le site
statique frontend.

1. Sur [render.com](https://dashboard.render.com), cliquez sur **New +** → **Blueprint**.
2. Connectez votre dépôt GitHub.
3. Render détecte `render.yaml` et propose de créer les 3 services d'un coup.
   Validez.
4. Le premier déploiement va échouer côté CORS/API (c'est normal — voir
   l'étape 3 ci-dessous, les deux services ne se connaissent pas encore).

### Option B — Configuration manuelle (si vous préférez, ou sans Blueprint)

**Base de données** : New + → PostgreSQL → nommez-la `edumanage-db`, plan Free.

**Backend** : New + → Web Service → connectez le dépôt →
- Root Directory : `backend`
- Runtime : Python 3
- Build Command : `./build.sh`
- Start Command : `gunicorn edumanage.wsgi:application`
- Variables d'environnement :
  - `DJANGO_SECRET_KEY` → générez une valeur aléatoire longue
  - `DJANGO_DEBUG` → `False`
  - `DJANGO_ALLOWED_HOSTS` → `.onrender.com`
  - `DATABASE_URL` → copiez la "Internal Connection String" de `edumanage-db`
  - `CORS_ALLOWED_ORIGINS` → à renseigner à l'étape 3

**Frontend** : New + → Static Site → connectez le dépôt →
- Root Directory : `ecole-platform`
- Build Command : `npm install && npm run build`
- Publish Directory : `dist`
- Variable d'environnement `VITE_API_URL` → à renseigner à l'étape 3

## 3. Relier les deux services (obligatoire, quelle que soit l'option ci-dessus)

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

## 4. Charger les données de démo

Une fois le backend déployé, ouvrez son **Shell** depuis le dashboard Render
(onglet "Shell" du service backend) et lancez :

```bash
python manage.py seed_data
```

Puis, pour pouvoir utiliser `/admin/` avec le compte admin de démo :

```bash
python manage.py shell -c "
from accounts.models import User
u = User.objects.get(email='admin@ecole.tg')
u.is_superuser = True
u.is_staff = True
u.save()
"
```

Comptes de démo (mot de passe `password123`) : voir `backend/README.md`.

**Important pour un vrai déploiement en production** : changez ce mot de
passe (ou supprimez les comptes de démo) avant de partager l'URL
publiquement — `seed_data` est prévu pour la démonstration, pas pour de
vraies données d'établissement.

## 5. Vérifier

- Backend : `https://edumanage-backend-xxxx.onrender.com/api/auth/login/`
  doit répondre (405 Method Not Allowed sur un GET est normal — c'est un
  endpoint POST uniquement, ça prouve juste que le serveur répond).
- Frontend : ouvrez l'URL du site statique, l'écran de connexion doit
  s'afficher, et la connexion avec un compte de démo doit fonctionner.

## Limites du plan gratuit Render à connaître

- Le service backend gratuit s'endort après 15 minutes d'inactivité — le
  premier chargement après une pause peut prendre 30-60 secondes.
- La base Postgres gratuite expire après 90 jours (Render vous préviendra
  par email) — pensez à passer sur un plan payant avant l'échéance pour un
  usage réel.

## Structure du dépôt

```
.
├── render.yaml          <- Blueprint Render (les 3 services)
├── backend/             <- API Django (voir backend/README.md)
└── ecole-platform/      <- Frontend React/Vite (voir ecole-platform/README.md)
```
