from django.contrib import admin
from .models import Classe, Matiere, Eleve, Note, Paiement, CreneauEDT, Presence, Notification, Conversation, Message


@admin.register(Classe)
class ClasseAdmin(admin.ModelAdmin):
    list_display = ('nom', 'niveau', 'effectif', 'professeur_principal', 'annee_scolaire')
    list_filter = ('niveau', 'annee_scolaire')
    search_fields = ('nom',)


@admin.register(Matiere)
class MatiereAdmin(admin.ModelAdmin):
    list_display = ('nom', 'classe', 'professeur', 'coefficient')
    list_filter = ('classe',)
    search_fields = ('nom',)


@admin.register(Eleve)
class EleveAdmin(admin.ModelAdmin):
    list_display = ('nom', 'prenom', 'classe', 'parent', 'status')
    list_filter = ('classe', 'status')
    search_fields = ('nom', 'prenom')


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('eleve', 'matiere', 'valeur', 'type', 'trimestre', 'date')
    list_filter = ('matiere__classe', 'type', 'trimestre')
    search_fields = ('eleve__nom', 'eleve__prenom')


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ('reference', 'eleve', 'montant', 'type', 'status', 'date')
    list_filter = ('type', 'status')
    search_fields = ('reference', 'eleve__nom', 'eleve__prenom')


@admin.register(CreneauEDT)
class CreneauEDTAdmin(admin.ModelAdmin):
    list_display = ('classe', 'jour', 'heure_debut', 'heure_fin', 'matiere', 'salle')
    list_filter = ('classe', 'jour')


@admin.register(Presence)
class PresenceAdmin(admin.ModelAdmin):
    list_display = ('eleve', 'date', 'statut')
    list_filter = ('statut', 'date')
    search_fields = ('eleve__nom', 'eleve__prenom')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('titre', 'destinataire', 'type', 'date', 'lu')
    list_filter = ('type', 'lu')


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('auteur', 'contenu', 'date', 'lu')
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('parent', 'staff', 'eleve', 'created_at')
    list_filter = ('staff',)
    search_fields = ('parent__nom', 'parent__prenom', 'staff__nom', 'staff__prenom')
    inlines = [MessageInline]
