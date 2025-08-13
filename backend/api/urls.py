# backend/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'processos', views.ProcessoViewSet, basename='processo')
router.register(r'parametros', views.ParametrosSistemaViewSet, basename='parametros')
router.register(r'feriados', views.FeriadoViewSet, basename='feriados')

urlpatterns = [
    path('', include(router.urls)),
]