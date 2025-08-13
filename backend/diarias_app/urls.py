# backend/diarias_app/urls.py

from django.contrib import admin
from django.urls import path, include
from api.views import GoogleLogin # Importamos nossa view de login do Google

urlpatterns = [
    path('admin/', admin.site.urls),

    # Inclui as rotas do nosso app 'api' (ex: /api/processos/)
    path('api/', include('api.urls')),

    # Rotas do dj-rest-auth para login, logout, etc.
    path('api/auth/', include('dj_rest_auth.urls')),
    
    # Rota específica para o callback do login com Google
    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),
]