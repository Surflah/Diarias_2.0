# backend/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import GoogleAuthView, UserProfileView, CalculoPreviewAPIView, ConfigDataView

router = DefaultRouter()
router.register(r'processos', views.ProcessoViewSet, basename='processo')
router.register(r'parametros', views.ParametrosSistemaViewSet, basename='parametros')
router.register(r'feriados', views.FeriadoViewSet, basename='feriados')

urlpatterns = [
    # rota manual deve vir antes do include(router.urls)
    path('processos/calcular-preview/', CalculoPreviewAPIView.as_view(), name='processo-calcular-preview'),

    # outras rotas avulsas
    path("google-login/", GoogleAuthView.as_view(), name="google-login"),
    path('profile/me/', UserProfileView.as_view(), name='user-profile'),
    path('config/', ConfigDataView.as_view(), name='config-data'),
    path("profile/me/", UserProfileView.as_view(), name="profile-me"),

    # por fim, as rotas geradas pelo router
    path('', include(router.urls)),
]
