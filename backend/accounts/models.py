from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Utilisateur de la plateforme. On garde `username` (requis par AbstractUser)
    mais la connexion se fait par email, et on ajoute nom/prenom/role pour
    coller au modele utilise cote frontend (React).
    """

    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrateur'
        PROFESSEUR = 'professeur', 'Professeur'
        PARENT = 'parent', 'Parent'
        SURVEILLANT = 'surveillant', 'Surveillant'

    email = models.EmailField(unique=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=Role.choices)
    avatar = models.URLField(blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'nom', 'prenom', 'role']

    def __str__(self):
        return f'{self.prenom} {self.nom} ({self.get_role_display()})'

    @property
    def full_name(self):
        return f'{self.prenom} {self.nom}'
