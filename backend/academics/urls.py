from rest_framework.routers import DefaultRouter
from .views import (
    ClasseViewSet, MatiereViewSet, EleveViewSet, NoteViewSet,
    PaiementViewSet, CreneauEDTViewSet, PresenceViewSet, NotificationViewSet,
    ConversationViewSet,
)

router = DefaultRouter()
router.register('classes', ClasseViewSet, basename='classe')
router.register('matieres', MatiereViewSet, basename='matiere')
router.register('eleves', EleveViewSet, basename='eleve')
router.register('notes', NoteViewSet, basename='note')
router.register('paiements', PaiementViewSet, basename='paiement')
router.register('emploi-du-temps', CreneauEDTViewSet, basename='creneauedt')
router.register('presences', PresenceViewSet, basename='presence')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('conversations', ConversationViewSet, basename='conversation')

urlpatterns = router.urls
