#!/usr/bin/env bash
# Script de build exécuté par Render avant chaque déploiement du backend.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Charge/actualise les données de démo à chaque déploiement — sans danger
# à relancer (update_or_create / get_or_create partout), et ne réinitialise
# jamais un mot de passe déjà changé. Nécessaire car le Shell Render n'est
# pas disponible sur le plan gratuit. Retirez cette ligne une fois en
# production avec de vraies données d'établissement.
python manage.py seed_data
