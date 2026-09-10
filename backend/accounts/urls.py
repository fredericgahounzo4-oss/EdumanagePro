from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, MeView, UserViewSet, RegisterParentView

router = DefaultRouter()
router.register('users', UserViewSet, basename='users')

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterParentView.as_view(), name='register-parent'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
]
