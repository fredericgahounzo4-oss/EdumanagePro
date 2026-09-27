from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User

CREATABLE_ROLES = (User.Role.PROFESSEUR, User.Role.SURVEILLANT)


def unique_username(email: str) -> str:
    base = email.split('@')[0].lower()
    username = base
    i = 1
    while User.objects.filter(username=username).exists():
        i += 1
        username = f'{base}{i}'
    return username


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'nom', 'prenom', 'role', 'avatar', 'is_active']


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Création d'un compte professeur ou surveillant par l'admin, depuis
    l'interface (plus besoin du Django admin pour ça).
    """
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'email', 'nom', 'prenom', 'role', 'password']

    def validate_role(self, value):
        if value not in CREATABLE_ROLES:
            raise serializers.ValidationError("Seuls les comptes Professeur et Surveillant peuvent être créés ici.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé par un autre compte.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(username=unique_username(validated_data['email']), **validated_data)
        user.set_password(password)
        user.save()
        return user


class ParentRegisterSerializer(serializers.ModelSerializer):
    """
    Auto-inscription : un parent crée lui-même son compte (public, sans
    authentification). Le rôle est toujours 'parent' — jamais choisi par
    l'appelant. Le rattachement à son ou ses enfant(s) reste fait par
    l'admin ensuite (page Élèves), comme pour tout élève.
    """
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'email', 'nom', 'prenom', 'password']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé par un autre compte.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(username=unique_username(validated_data['email']), role=User.Role.PARENT, **validated_data)
        user.set_password(password)
        user.save()
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login par email + mot de passe, renvoie access/refresh + le profil utilisateur."""
    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
