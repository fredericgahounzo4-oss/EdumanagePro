from rest_framework import serializers
from accounts.serializers import UserSerializer
from .models import Classe, Matiere, Eleve, Note, Paiement, CreneauEDT, Presence, Notification
from .permissions import is_titulaire_de_classe


class ClasseSerializer(serializers.ModelSerializer):
    professeur_principal_detail = UserSerializer(source='professeur_principal', read_only=True)

    class Meta:
        model = Classe
        fields = ['id', 'nom', 'niveau', 'effectif', 'professeur_principal', 'professeur_principal_detail', 'annee_scolaire']


class MatiereSerializer(serializers.ModelSerializer):
    professeur_detail = UserSerializer(source='professeur', read_only=True)

    class Meta:
        model = Matiere
        fields = ['id', 'nom', 'coefficient', 'professeur', 'professeur_detail', 'classe', 'couleur']


class EleveSerializer(serializers.ModelSerializer):
    classe_nom = serializers.CharField(source='classe.nom', read_only=True)
    parent_detail = UserSerializer(source='parent', read_only=True)

    class Meta:
        model = Eleve
        fields = [
            'id', 'nom', 'prenom', 'date_naissance', 'classe', 'classe_nom',
            'parent', 'parent_detail', 'photo', 'status', 'adresse', 'telephone',
        ]


class NoteSerializer(serializers.ModelSerializer):
    matiere_nom = serializers.CharField(source='matiere.nom', read_only=True)

    class Meta:
        model = Note
        fields = ['id', 'eleve', 'matiere', 'matiere_nom', 'valeur', 'type', 'date', 'commentaire', 'trimestre', 'saisi_par']
        read_only_fields = ['saisi_par']

    def validate(self, attrs):
        request = self.context['request']
        user = request.user
        eleve = attrs.get('eleve') or getattr(self.instance, 'eleve', None)
        matiere = attrs.get('matiere') or getattr(self.instance, 'matiere', None)

        if user.role == 'admin':
            return attrs

        if user.role != 'professeur':
            raise serializers.ValidationError("Seuls les professeurs et l'administration peuvent saisir des notes.")

        if matiere.classe_id != eleve.classe_id:
            raise serializers.ValidationError("Cette matière n'appartient pas à la classe de l'élève.")

        # Un professeur ne peut noter que la matière qu'il enseigne réellement,
        # même s'il est titulaire de la classe (le statut de titulaire donne un droit
        # de consultation du bulletin complet, pas de notation pour les autres matières).
        if matiere.professeur_id != user.id:
            raise serializers.ValidationError("Vous ne pouvez saisir des notes que dans les matières que vous enseignez.")

        return attrs

    def create(self, validated_data):
        validated_data['saisi_par'] = self.context['request'].user
        return super().create(validated_data)


class PaiementSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source='eleve.nom', read_only=True)
    eleve_prenom = serializers.CharField(source='eleve.prenom', read_only=True)
    eleve_classe = serializers.CharField(source='eleve.classe.nom', read_only=True)

    class Meta:
        model = Paiement
        fields = ['id', 'eleve', 'eleve_nom', 'eleve_prenom', 'eleve_classe', 'montant', 'type', 'status', 'date', 'reference', 'mois']


class CreneauEDTSerializer(serializers.ModelSerializer):
    matiere_nom = serializers.CharField(source='matiere.nom', read_only=True)
    matiere_couleur = serializers.CharField(source='matiere.couleur', read_only=True)

    class Meta:
        model = CreneauEDT
        fields = ['id', 'jour', 'heure_debut', 'heure_fin', 'matiere', 'matiere_nom', 'matiere_couleur', 'classe', 'salle']

    def validate(self, attrs):
        matiere = attrs.get('matiere') or getattr(self.instance, 'matiere', None)
        classe = attrs.get('classe') or getattr(self.instance, 'classe', None)
        if matiere and classe and matiere.classe_id != classe.id:
            raise serializers.ValidationError("Cette matière n'appartient pas à la classe sélectionnée.")
        return attrs


class PresenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Presence
        fields = ['id', 'eleve', 'date', 'statut', 'commentaire']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'titre', 'message', 'type', 'date', 'lu', 'destinataire']
        read_only_fields = ['destinataire']
