import secrets
import string
from rest_framework import generics, permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, ParentRegisterSerializer, EmailTokenObtainPairSerializer


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


class RegisterParentView(generics.CreateAPIView):
    """
    Auto-inscription publique — réservée au rôle parent. Connecte
    automatiquement la personne après création (renvoie access/refresh),
    comme pour un login classique.
    """
    serializer_class = ParentRegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


def generate_password(length=10):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsAdminOrListProfesseurs(permissions.BasePermission):
    """
    Admin -> accès complet (liste, détail, création, modification, reset mdp).
    Tout autre utilisateur connecté -> peut uniquement lister les comptes
    professeur (GET /api/auth/users/?role=professeur), pour afficher les
    noms des enseignants sur les bulletins et la fiche "classe titulaire".
    Rien d'autre n'est autorisé aux non-admins (pas de détail, pas d'écriture,
    pas de liste non filtrée par rôle).
    """
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == 'admin':
            return True
        return (
            request.method in permissions.SAFE_METHODS
            and view.action == 'list'
            and request.query_params.get('role') == 'professeur'
        )


class UserViewSet(viewsets.ModelViewSet):
    """
    Gestion des comptes — réservée à l'admin. Remplace le Django admin pour
    la création des comptes Professeur et Surveillant : l'admin les crée
    depuis l'interface (Comptes), avec un mot de passe généré ou choisi.
    Filtrable par rôle en lecture : /api/auth/users/?role=professeur
    (les non-admins peuvent aussi lister avec ce filtre précis, en lecture
    seule, pour afficher les noms des professeurs ailleurs dans l'appli).
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrListProfesseurs]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_serializer_class(self):
        return UserCreateSerializer if self.action == 'create' else UserSerializer

    def get_queryset(self):
        qs = User.objects.all().order_by('nom', 'prenom')
        if self.request.user.role != 'admin':
            # Les non-admins ne passent le contrôle de permission ci-dessus
            # que pour une liste filtrée sur role=professeur — on applique
            # le même filtre ici par sécurité, quel que soit le paramètre reçu.
            return qs.filter(role='professeur')
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        generated = False
        if not data.get('password'):
            data['password'] = generate_password()
            generated = True
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = UserSerializer(user).data
        if generated:
            payload['generated_password'] = data['password']
        return Response(payload, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        # Seuls le prénom, le nom et l'activation du compte sont modifiables ici
        # (pas le rôle ni l'email, pour éviter les glissements de privilège accidentels).
        instance = self.get_object()
        allowed = {k: v for k, v in request.data.items() if k in ('nom', 'prenom', 'is_active')}
        for k, v in allowed.items():
            setattr(instance, k, v)
        instance.save(update_fields=list(allowed.keys()) or None)
        return Response(UserSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password') or generate_password()
        user.set_password(new_password)
        user.save()
        return Response({'password': new_password})
