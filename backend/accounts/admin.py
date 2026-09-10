from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ('email', 'prenom', 'nom', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email', 'nom', 'prenom', 'username')
    ordering = ('nom', 'prenom')

    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Informations personnelles', {'fields': ('nom', 'prenom', 'role', 'avatar')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates importantes', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'nom', 'prenom', 'role', 'password1', 'password2'),
        }),
    )
