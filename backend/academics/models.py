from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Classe(models.Model):
    nom = models.CharField(max_length=50, unique=True)
    niveau = models.CharField(max_length=50)  # ex: "Collège", "Lycée", "Primaire"
    effectif = models.PositiveIntegerField(default=0)
    professeur_principal = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='classes_titulaire',
        limit_choices_to={'role': 'professeur'},
        help_text="Le titulaire de la classe : voit le bulletin complet, même s'il n'enseigne pas toutes les matières.",
    )
    annee_scolaire = models.CharField(max_length=20, default='2024-2025')

    class Meta:
        ordering = ['nom']

    def __str__(self):
        return self.nom


class Matiere(models.Model):
    nom = models.CharField(max_length=100)
    coefficient = models.PositiveSmallIntegerField(default=1)
    professeur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='matieres_enseignees',
        limit_choices_to={'role': 'professeur'},
    )
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE, related_name='matieres')
    couleur = models.CharField(max_length=7, default='#2563a8')

    class Meta:
        ordering = ['classe', 'nom']
        unique_together = ('nom', 'classe')

    def __str__(self):
        return f'{self.nom} ({self.classe.nom})'


class Eleve(models.Model):
    class Status(models.TextChoices):
        ACTIF = 'actif', 'Actif'
        INACTIF = 'inactif', 'Inactif'

    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    classe = models.ForeignKey(Classe, on_delete=models.PROTECT, related_name='eleves')
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='enfants',
        limit_choices_to={'role': 'parent'},
    )
    photo = models.URLField(blank=True, null=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIF)
    adresse = models.CharField(max_length=255, blank=True)
    telephone = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ['classe', 'nom', 'prenom']

    def __str__(self):
        return f'{self.prenom} {self.nom}'


class Note(models.Model):
    class Type(models.TextChoices):
        DEVOIR = 'devoir', 'Devoir'
        EXAMEN = 'examen', 'Composition'
        INTERROGATION = 'interrogation', 'Interrogation'

    class Trimestre(models.IntegerChoices):
        T1 = 1, 'Trimestre 1'
        T2 = 2, 'Trimestre 2'
        T3 = 3, 'Trimestre 3'

    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name='notes')
    matiere = models.ForeignKey(Matiere, on_delete=models.CASCADE, related_name='notes')
    valeur = models.DecimalField(max_digits=4, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(20)])
    type = models.CharField(max_length=20, choices=Type.choices)
    date = models.DateField()
    commentaire = models.CharField(max_length=255, blank=True)
    trimestre = models.PositiveSmallIntegerField(choices=Trimestre.choices)
    saisi_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='notes_saisies'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.eleve} — {self.matiere.nom}: {self.valeur}/20'


class Paiement(models.Model):
    class TypePaiement(models.TextChoices):
        INSCRIPTION = 'inscription', 'Inscription'
        MENSUALITE = 'mensualite', 'Mensualité'
        TRANSPORT = 'transport', 'Transport'
        CANTINE = 'cantine', 'Cantine'

    class Status(models.TextChoices):
        PAYE = 'payé', 'Payé'
        IMPAYE = 'impayé', 'Impayé'
        PARTIEL = 'partiel', 'Partiel'

    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name='paiements')
    montant = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=20, choices=TypePaiement.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.IMPAYE)
    date = models.DateField()
    reference = models.CharField(max_length=50, unique=True)
    mois = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.reference} — {self.eleve} ({self.montant} FCFA)'


class CreneauEDT(models.Model):
    class Jour(models.TextChoices):
        LUNDI = 'Lundi', 'Lundi'
        MARDI = 'Mardi', 'Mardi'
        MERCREDI = 'Mercredi', 'Mercredi'
        JEUDI = 'Jeudi', 'Jeudi'
        VENDREDI = 'Vendredi', 'Vendredi'

    jour = models.CharField(max_length=10, choices=Jour.choices)
    heure_debut = models.CharField(max_length=5)  # "07:30"
    heure_fin = models.CharField(max_length=5)
    matiere = models.ForeignKey(Matiere, on_delete=models.CASCADE, related_name='creneaux')
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE, related_name='emploi_du_temps')
    salle = models.CharField(max_length=50)

    class Meta:
        ordering = ['jour', 'heure_debut']
        unique_together = ('jour', 'heure_debut', 'classe')

    def __str__(self):
        return f'{self.classe.nom} — {self.jour} {self.heure_debut}'


class Presence(models.Model):
    class Statut(models.TextChoices):
        PRESENT = 'présent', 'Présent'
        ABSENT = 'absent', 'Absent'
        RETARD = 'retard', 'Retard'
        EXCUSE = 'excusé', 'Excusé'

    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name='presences')
    date = models.DateField()
    statut = models.CharField(max_length=10, choices=Statut.choices)
    commentaire = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-date']
        unique_together = ('eleve', 'date')

    def __str__(self):
        return f'{self.eleve} — {self.date}: {self.statut}'


class Notification(models.Model):
    class Type(models.TextChoices):
        INFO = 'info', 'Info'
        SUCCESS = 'success', 'Succès'
        WARNING = 'warning', 'Avertissement'
        DANGER = 'danger', 'Urgent'

    titre = models.CharField(max_length=150)
    message = models.TextField()
    type = models.CharField(max_length=10, choices=Type.choices, default=Type.INFO)
    date = models.DateTimeField(auto_now_add=True)
    lu = models.BooleanField(default=False)
    destinataire = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.titre} → {self.destinataire}'


class Conversation(models.Model):
    """
    Fil de discussion entre UN parent et UN membre du personnel (admin ou
    professeur). Un envoi "à toute une classe" crée une Conversation par
    parent (fan-out côté vue) — chaque parent ne voit que son propre fil,
    jamais celui des autres.
    """
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations_parent',
        limit_choices_to={'role': 'parent'},
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations_staff',
        limit_choices_to={'role__in': ['admin', 'professeur']},
    )
    eleve = models.ForeignKey(
        Eleve, on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations',
        help_text="Élève concerné (contexte informatif, non contraignant).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('parent', 'staff')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.parent} <-> {self.staff}'


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='messages_envoyes')
    contenu = models.TextField()
    date = models.DateTimeField(auto_now_add=True)
    lu = models.BooleanField(default=False, help_text="Lu par le destinataire (l'autre partie de la conversation).")

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f'{self.auteur} — {self.contenu[:30]}'
