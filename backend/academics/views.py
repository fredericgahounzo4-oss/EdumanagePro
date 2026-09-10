from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Classe, Matiere, Eleve, Note, Paiement, CreneauEDT, Presence, Notification
from .serializers import (
    ClasseSerializer, MatiereSerializer, EleveSerializer, NoteSerializer,
    PaiementSerializer, CreneauEDTSerializer, PresenceSerializer, NotificationSerializer,
)
from .permissions import classes_du_professeur, eleves_du_professeur, is_titulaire_de_classe


class IsAdminOrReadOnly(permissions.BasePermission):
    """Lecture pour tout utilisateur authentifié, écriture réservée à l'admin."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class ClasseViewSet(viewsets.ModelViewSet):
    serializer_class = ClasseSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.role == 'surveillant':
            return Classe.objects.all()
        if user.role == 'professeur':
            return classes_du_professeur(user.id)
        if user.role == 'parent':
            return Classe.objects.filter(eleves__parent=user).distinct()
        return Classe.objects.none()


class MatiereViewSet(viewsets.ModelViewSet):
    serializer_class = MatiereSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Matiere.objects.all()
        if user.role in ('admin', 'surveillant'):
            return qs
        if user.role == 'professeur':
            return qs.filter(classe__in=classes_du_professeur(user.id))
        if user.role == 'parent':
            return qs.filter(classe__eleves__parent=user).distinct()
        return Matiere.objects.none()


class EleveViewSet(viewsets.ModelViewSet):
    serializer_class = EleveSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('admin', 'surveillant'):
            return Eleve.objects.all()
        if user.role == 'professeur':
            return eleves_du_professeur(user.id)
        if user.role == 'parent':
            return Eleve.objects.filter(parent=user)
        return Eleve.objects.none()


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Note.objects.all()
        if user.role == 'professeur':
            # Ses propres matières, + toutes les notes des classes dont il est titulaire.
            return Note.objects.filter(
                Q(matiere__professeur=user) | Q(eleve__classe__professeur_principal=user)
            ).distinct()
        if user.role == 'parent':
            return Note.objects.filter(eleve__parent=user)
        if user.role == 'surveillant':
            # Lecture seule (aucune écriture possible : cf. serializer.validate ci-dessous).
            return Note.objects.all()
        return Note.objects.none()

    def perform_update(self, serializer):
        user = self.request.user
        note = self.get_object()
        if user.role == 'professeur' and note.matiere.professeur_id != user.id:
            raise permissions.PermissionDenied("Vous ne pouvez modifier que vos propres notes.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'professeur' and instance.matiere.professeur_id != user.id:
            raise permissions.PermissionDenied("Vous ne pouvez supprimer que vos propres notes.")
        if user.role not in ('admin', 'professeur'):
            raise permissions.PermissionDenied("Action non autorisée.")
        instance.delete()


class PaiementViewSet(viewsets.ModelViewSet):
    serializer_class = PaiementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Paiement.objects.all()
        if user.role == 'parent':
            return Paiement.objects.filter(eleve__parent=user)
        if user.role == 'surveillant':
            return Paiement.objects.all()
        return Paiement.objects.none()


class CreneauEDTViewSet(viewsets.ModelViewSet):
    serializer_class = CreneauEDTSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('admin', 'surveillant'):
            return CreneauEDT.objects.all()
        if user.role == 'professeur':
            return CreneauEDT.objects.filter(classe__in=classes_du_professeur(user.id))
        if user.role == 'parent':
            return CreneauEDT.objects.filter(classe__eleves__parent=user).distinct()
        return CreneauEDT.objects.none()


class PresenceViewSet(viewsets.ModelViewSet):
    serializer_class = PresenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('admin', 'surveillant'):
            return Presence.objects.all()
        if user.role == 'professeur':
            return Presence.objects.filter(eleve__in=eleves_du_professeur(user.id))
        if user.role == 'parent':
            return Presence.objects.filter(eleve__parent=user)
        return Presence.objects.none()

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in permissions.SAFE_METHODS and request.user.role not in ('admin', 'professeur', 'surveillant'):
            self.permission_denied(request, message="Action non autorisée.")


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(destinataire=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Seul l'administrateur peut créer des notifications.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def marquer_lu(self, request, pk=None):
        notif = self.get_object()
        notif.lu = True
        notif.save(update_fields=['lu'])
        return Response(NotificationSerializer(notif).data)
