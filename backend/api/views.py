# backend/api/views.py

import requests
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status, viewsets, permissions, generics
from rest_framework_simplejwt.tokens import RefreshToken


from core.models import Processo, ParametrosSistema, Feriado
from core.services import calculos_service
from .serializers import ProcessoSerializer, ParametrosSistemaSerializer, FeriadoSerializer, ProfileSerializer, CalculoPreviewSerializer

from core.services.calculos_service import calcular_valor_diarias, calcular_valor_deslocamento, CalculoServiceError
import logging
logger = logging.getLogger(__name__)

User = get_user_model()

class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):

        code = request.data.get("code")
        if not code:
            return Response({"error": "Missing code"}, status=status.HTTP_400_BAD_REQUEST)

        # pega credenciais a partir do settings (definidas pelo settings.py acima)
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", None) or getattr(settings, "GOOGLE_CLOUD_CLIENT_ID", None)
        client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", None) or getattr(settings, "GOOGLE_CLOUD_CLIENT_SECRET", None)

        if not client_id or not client_secret:
            return Response(
                {
                    "error": "Google client credentials not configured on server.",
                    "detail": "Coloque credentials.json na raiz do backend ou defina GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        token_res = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": "postmessage",  
                "grant_type": "authorization_code"
            }
        )

        token_data = token_res.json()
        if "error" in token_data:
            return Response({"error": token_data}, status=status.HTTP_400_BAD_REQUEST)

        id_token = token_data.get("id_token")
        if not id_token:
            return Response({"error": "No id_token from Google"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Valida o token com Google
        info_res = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
        user_info = info_res.json()

        email = user_info.get("email")
        if not email:
            return Response({"error": "Invalid token info"}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Cria ou pega usuário
        user, created = User.objects.get_or_create(
            email=email,
            defaults={"username": email, "first_name": user_info.get("given_name", "")}
        )

        # 4. Gera JWT
        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        })

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
        deslocamento_data = {'valor_deslocamento': 0.0, 'distancia_km': 0.0, 'preco_gas_usado': 0.0}
        meio = serializer.validated_data.get('meio_transporte')
        if meio == 'VEICULO_PROPRIO':
            deslocamento_data = calculos_service.calcular_deslocamento(destino=serializer.validated_data.get('destino'))

        processo_instance.distancia_total_km = deslocamento_data.get('distancia_km', 0)
        processo_instance.valor_deslocamento = deslocamento_data.get('valor_deslocamento', 0)
        processo_instance.valor_total_diarias = diarias_data.get('valor_total', 0)
        processo_instance.valor_total_empenhar = processo_instance.valor_total_diarias + processo_instance.valor_deslocamento

        
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
            processo_instance.valor_deslocamento 
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

class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    View para ler e atualizar o perfil do usuário logado.
    Garante que um usuário só possa ver e editar o seu próprio perfil.
    """
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        # Esta função é a chave da segurança:
        # ela retorna sempre o perfil do usuário que está fazendo a requisição.
        # Impede que um usuário acesse /api/profile/me/ e veja dados de outro.
        return self.request.user.profile
    
class CalculoPreviewAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _decimals_to_primitives(self, obj):
        """Recursively convert Decimal -> float for JSON serialization."""
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, dict):
            return {k: self._decimals_to_primitives(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._decimals_to_primitives(v) for v in obj]
        return obj

    def post(self, request, *args, **kwargs):
        serializer = CalculoPreviewSerializer(data=request.data)
        if not serializer.is_valid():
            logger.debug('CalculoPreviewSerializer inválido: %s', serializer.errors)
            print('CalculoPreviewSerializer inválido:', serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            # monta kwargs opcionais apenas com os campos realmente presentes (None é ok)
            # monta kwargs opcionais para diárias
            optional_kwargs = {}
            for k in ('num_com_pernoite', 'num_sem_pernoite', 'num_meia_diaria', 'regiao_diaria'):
                if k in data:
                    optional_kwargs[k] = data.get(k)

            # cálculo das diárias (sempre)
            detalhes_diarias = calcular_valor_diarias(
                destino=data['destino'],
                data_saida=data['data_saida'],
                data_retorno=data['data_retorno'],
                **optional_kwargs
            )

            meio_transporte = data.get('meio_transporte')

            # tenta calcular deslocamento (distância + preco)
            try:
                detalhes_deslocamento = calcular_valor_deslocamento(
                    destino=data['destino'],
                    data_saida=data['data_saida'],
                    data_retorno=data['data_retorno'],
                    # passe outros parâmetros se a função exigir
                )
            except CalculoServiceError as e:
                logger.debug('Erro ao calcular deslocamento: %s', str(e))
                # fallback com zeros — mas manter a resposta padronizada
                detalhes_deslocamento = {
                    "valor_deslocamento": Decimal('0'),
                    "distancia_km": Decimal('0'),
                    "preco_gas_usado": Decimal('0'),
                }

            # se não for veículo próprio, manter distancia e preco, mas zerar o valor do pagamento
            if meio_transporte != 'VEICULO_PROPRIO':
                # mantemos distancia_km e preco_gas_usado para exibição, mas valor_deslocamento = 0
                detalhes_deslocamento['valor_deslocamento'] = Decimal('0')

            # Normaliza Decimals -> floats (sua função já faz isso)
            detalhes_diarias_norm = self._decimals_to_primitives(detalhes_diarias)
            detalhes_deslocamento_norm = self._decimals_to_primitives(detalhes_deslocamento)

            total_empenhar = (
                (detalhes_diarias_norm.get('valor_total_diarias') or 0) +
                (detalhes_deslocamento_norm.get('valor_deslocamento') or 0)
            )

            response_data = {
                'calculo_diarias': detalhes_diarias_norm,
                'calculo_deslocamento': detalhes_deslocamento_norm,
                'total_empenhar': total_empenhar
            }


            return Response(response_data, status=status.HTTP_200_OK)

        except CalculoServiceError as e:
            logger.debug('CalculoPreviewAPIView CalculoServiceError: %s', str(e))
            print('CalculoPreviewAPIView CalculoServiceError:', str(e))
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception('Erro inesperado em CalculoPreviewAPIView')
            print('Erro inesperado em CalculoPreviewAPIView:', str(e))
            return Response({'error': 'Erro interno no servidor ao calcular preview.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ConfigDataView(APIView):
    """
    Endpoint que fornece dados de configuração essenciais para o frontend.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # 1. Busca o valor da UPM dos parâmetros do sistema
        valor_upm = Decimal('0.00')
        try:
            parametros = ParametrosSistema.objects.first()
            if parametros:
                valor_upm = parametros.valor_upm
        except Exception:
            # Se algo der errado, continua com o valor padrão para não quebrar o frontend
            pass

        # 2. Lista estática de capitais do Brasil para a lógica de inferência de região
        capitais_brasil = [
            "aracaju", "belém", "belo horizonte", "boa vista", "brasília", "campo grande",
            "cuiabá", "fortaleza", "goiânia", "joão pessoa",
            "macapá", "maceió", "manaus", "natal", "palmas", "porto alegre", "porto velho",
            "recife", "rio branco", "rio de janeiro", "salvador", "são luís", "são paulo",
            "teresina", "vitória"
        ]

        # 3. Monta e retorna a resposta
        config_data = {
            'valor_upm': valor_upm,
            'capitais': capitais_brasil,
        }
        return Response(config_data, status=status.HTTP_200_OK)
