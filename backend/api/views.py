# backend/api/views.py
from rest_framework import viewsets, permissions
from core.models import Processo, ParametrosSistema, Feriado
from core.services import calculos_service # Importamos nossa lógica de negócio
from .serializers import ProcessoSerializer, ParametrosSistemaSerializer, FeriadoSerializer

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

class GoogleLogin(SocialLoginView):
    """
    View para o login social com Google. Esta é a classe que estava faltando.
    """
    adapter_class = GoogleOAuth2Adapter
    # ATENÇÃO: A URL de callback deve ser EXATAMENTE a mesma que você configurou
    # nas credenciais do Google Cloud para o seu frontend.
    callback_url = "http://localhost:3000" 
    client_class = OAuth2Client


class ProcessoViewSet(viewsets.ModelViewSet):
    """
    Endpoint da API para visualizar e criar Processos de Diárias.
    """
    queryset = Processo.objects.all().order_by('-created_at')
    serializer_class = ProcessoSerializer
    # Garante que apenas usuários logados possam acessar este endpoint
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Filtra os processos para mostrar apenas os do usuário logado
        return Processo.objects.filter(solicitante=self.request.user)

    def perform_create(self, serializer):
        """
        Esta função é chamada quando um novo processo é criado (via POST).
        Aqui é onde a mágica acontece!
        """
        # 1. Calcula o deslocamento antes de salvar
        deslocamento_data = calculos_service.calcular_deslocamento(
            destino=serializer.validated_data.get('destino')
        )
        
        # 2. Instancia o processo com os dados validados, mas ainda não salva no banco
        processo_instance = serializer.save(solicitante=self.request.user)
        
        # 3. Calcula as diárias usando a instância do processo
        diarias_data = calculos_service.calcular_diarias(processo=processo_instance)

        # 4. Atualiza a instância com os valores calculados
        processo_instance.distancia_total_km = deslocamento_data.get('distancia_km', 0)
        processo_instance.valor_deslocamento = deslocamento_data.get('valor_deslocamento', 0)
        processo_instance.valor_total_diarias = diarias_data.get('valor_total', 0)
        
        # 5. Calcula o valor total final
        processo_instance.valor_total_empenhar = (
            processo_instance.valor_total_diarias + 
            processo_instance.valor_deslocamento +
            processo_instance.valor_taxa_inscricao
        )
        
        # 6. Agora sim, salva o processo completo no banco de dados
        processo_instance.save()


# ViewSets para os outros modelos (geralmente com permissões mais restritas)
class ParametrosSistemaViewSet(viewsets.ReadOnlyModelViewSet):
    """ Endpoint somente leitura para os parâmetros do sistema """
    queryset = ParametrosSistema.objects.all()
    serializer_class = ParametrosSistemaSerializer
    permission_classes = [permissions.IsAuthenticated] # Ou IsAdminUser

class FeriadoViewSet(viewsets.ReadOnlyModelViewSet):
    """ Endpoint somente leitura para a lista de feriados """
    queryset = Feriado.objects.all()
    serializer_class = FeriadoSerializer
    permission_classes = [permissions.IsAuthenticated]