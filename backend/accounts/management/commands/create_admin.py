"""
Crée (ou met à jour) UNIQUEMENT le compte administrateur, promu
superutilisateur Django. Aucune autre donnée n'est créée — c'est ensuite
à cet admin de créer les comptes Professeur/Surveillant (page "Comptes")
et les élèves/parents (page "Élèves") depuis l'interface.

Identifiants lus depuis des variables d'environnement (avec des valeurs
par défaut pour le développement local) :
  DJANGO_ADMIN_EMAIL    (défaut : admin@ecole.tg)
  DJANGO_ADMIN_PASSWORD (défaut : changeme123 — À CHANGER en production)
  DJANGO_ADMIN_NOM      (défaut : Admin)
  DJANGO_ADMIN_PRENOM   (défaut : Principal)

Idempotent : peut être relancée à chaque déploiement sans danger — si le
compte existe déjà, son mot de passe n'est PAS réinitialisé (pour ne pas
écraser un mot de passe déjà changé par l'admin lui-même).

Usage : python manage.py create_admin
"""
import os
from django.core.management.base import BaseCommand
from accounts.models import User
from accounts.serializers import unique_username


class Command(BaseCommand):
    help = "Crée uniquement le compte administrateur (superutilisateur)."

    def handle(self, *args, **options):
        email = os.environ.get('DJANGO_ADMIN_EMAIL', 'admin@ecole.tg')
        password = os.environ.get('DJANGO_ADMIN_PASSWORD', 'changeme123')
        nom = os.environ.get('DJANGO_ADMIN_NOM', 'Admin')
        prenom = os.environ.get('DJANGO_ADMIN_PRENOM', 'Principal')

        user, created = User.objects.get_or_create(
            email=email,
            defaults=dict(username=unique_username(email), nom=nom, prenom=prenom, role=User.Role.ADMIN),
        )

        if created:
            user.set_password(password)
            self.stdout.write(self.style.SUCCESS(f'Compte admin créé : {email}'))
            if password == 'changeme123':
                self.stdout.write(self.style.WARNING(
                    "Mot de passe par défaut utilisé — définissez DJANGO_ADMIN_PASSWORD "
                    "dans les variables d'environnement pour un vrai déploiement."
                ))
        else:
            self.stdout.write(f'Compte admin déjà existant : {email} (mot de passe inchangé)')

        # Toujours s'assurer que ce compte a bien les droits admin/superutilisateur,
        # même s'il existait déjà avec un rôle ou des droits différents.
        changed_fields = []
        if user.role != User.Role.ADMIN:
            user.role = User.Role.ADMIN
            changed_fields.append('role')
        if not user.is_superuser:
            user.is_superuser = True
            changed_fields.append('is_superuser')
        if not user.is_staff:
            user.is_staff = True
            changed_fields.append('is_staff')
        if created or changed_fields:
            user.save()

        self.stdout.write(self.style.SUCCESS(f'{email} est superutilisateur Django (accès /admin/ et à la page "Comptes").'))
