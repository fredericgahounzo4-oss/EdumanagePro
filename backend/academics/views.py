from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response

from .models import Classe, Matiere, Eleve, Note, Paiement, CreneauEDT, Presence, Notification, Conversation, Message
from .serializers import (
    ClasseSerializer, MatiereSerializer, EleveSerializer, NoteSerializer,
    PaiementSerializer, CreneauEDTSerializer, PresenceSerializer, NotificationSerializer,
    ConversationSerializer, MessageSerializer,
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


class ConversationViewSet(viewsets.ModelViewSet):
    """
    Messagerie parent <-> personnel. Un admin peut écrire à n'importe quel
    parent ; un professeur ne peut écrire qu'aux parents d'élèves de ses
    propres classes. Envoi possible à un élève précis (son parent) ou à
    toute une classe (fan-out : une conversation par parent, chacun ne
    voit que la sienne). Les parents ne peuvent que répondre dans un fil
    déjà existant, jamais en démarrer un nouveau.
    """
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        return ctx

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(Q(parent=user) | Q(staff=user)).distinct()

    def create(self, request, *args, **kwargs):
        user = request.user
        if user.role not in ('admin', 'professeur'):
            raise PermissionDenied("Seuls l'administration et les professeurs peuvent démarrer une conversation.")

        contenu = (request.data.get('contenu') or '').strip()
        if not contenu:
            raise ValidationError({'contenu': 'Ce champ est requis.'})

        eleve_id = request.data.get('eleve')
        classe_id = request.data.get('classe')
        if not eleve_id and not classe_id:
            raise ValidationError('Précisez un élève ou une classe destinataire.')
        if eleve_id and classe_id:
            raise ValidationError('Choisissez soit un élève, soit une classe — pas les deux.')

        mes_classes_ids = None
        if user.role == 'professeur':
            mes_classes_ids = set(classes_du_professeur(user.id).values_list('id', flat=True))

        if classe_id:
            classe = get_object_or_404(Classe, id=classe_id)
            if mes_classes_ids is not None and classe.id not in mes_classes_ids:
                raise PermissionDenied("Vous n'enseignez pas dans cette classe.")
            eleves = Eleve.objects.filter(classe=classe, parent__isnull=False)
            if not eleves.exists():
                raise ValidationError("Aucun élève de cette classe n'a de parent associé à un compte pour le moment.")
            created = 0
            for eleve in eleves:
                conv, _ = Conversation.objects.get_or_create(
                    parent=eleve.parent, staff=user, defaults={'eleve': eleve}
                )
                Message.objects.create(conversation=conv, auteur=user, contenu=contenu)
                created += 1
            return Response({'created': created}, status=status.HTTP_201_CREATED)

        eleve = get_object_or_404(Eleve, id=eleve_id)
        if not eleve.parent_id:
            raise ValidationError("Cet élève n'a pas de parent associé à un compte pour le moment.")
        if mes_classes_ids is not None and eleve.classe_id not in mes_classes_ids:
            raise PermissionDenied("Vous n'enseignez pas dans la classe de cet élève.")

        conv, _ = Conversation.objects.get_or_create(parent=eleve.parent, staff=user, defaults={'eleve': eleve})
        Message.objects.create(conversation=conv, auteur=user, contenu=contenu)
        return Response(ConversationSerializer(conv, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        conv = self.get_object()  # get_queryset restreint déjà aux participants
        if request.method == 'GET':
            return Response(MessageSerializer(conv.messages.all(), many=True).data)

        contenu = (request.data.get('contenu') or '').strip()
        if not contenu:
            raise ValidationError({'contenu': 'Ce champ est requis.'})
        msg = Message.objects.create(conversation=conv, auteur=request.user, contenu=contenu)
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def marquer_lu(self, request, pk=None):
        conv = self.get_object()
        conv.messages.exclude(auteur=request.user).update(lu=True)
        return Response({'ok': True})
