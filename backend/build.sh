#!/usr/bin/env bash
# Script de build exécuté par Render avant chaque déploiement du backend.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Crée uniquement le compte admin (superutilisateur) — aucune autre donnée
# de démo. Sans danger à relancer à chaque déploiement : ne réinitialise
# jamais un mot de passe déjà changé. Définissez DJANGO_ADMIN_EMAIL et
# DJANGO_ADMIN_PASSWORD dans les variables d'environnement du service pour
# choisir vos propres identifiants (sinon des valeurs par défaut sont
# utilisées — à éviter en production réelle).
python manage.py create_admin
