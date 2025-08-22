# backend/api/views.py

import requests
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.conf import settings
from django.db import transaction

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status, viewsets, permissions, generics
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import action

from decimal import Decimal, ROUND_HALF_UP


from core.models import Processo, ParametrosSistema, Feriado, Documento, Profile
from core.services import calculos_service, google_drive_service, google_docs_service
from .serializers import ProcessoSerializer, ParametrosSistemaSerializer, FeriadoSerializer, ProfileSerializer, CalculoPreviewSerializer

from core.services.orquestrador_gdrive import create_process_folder_and_doc
from core.services.email_service import send_process_created_email
from num2words import num2words

import json
import math
from babel.dates import format_date


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
    
def valor_extenso_sem_centavos_if_round(value):
    """
    Retorna o valor por extenso em pt_BR.
    - Se o valor for 'redondo' (centavos == 0) retorna: "dois mil reais" (ou "um real").
    - Caso contrário usa a formatação de moeda do num2words: "dois mil reais e cinquenta centavos".
    """
    # usa Decimal para evitar problemas de ponto flutuante
    v = Decimal(str(value or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    inteiro = int(v // 1)
    centavos = int((v - inteiro) * 100)

    if centavos == 0:
        # cardinal para números inteiros + palavra correta (singular/plural)
        words = num2words(inteiro, lang='pt_BR', to='cardinal')
        currency_word = 'real' if abs(inteiro) == 1 else 'reais'
        return f"{words} {currency_word}"
    else:
        # usar formatação de moeda, que inclui centavos
        return num2words(float(v), lang='pt_BR', to='currency')
    
def format_tag_value(value, prefix="", suffix="", is_currency=False):
    """
    Formata valores para as tags. Se o valor for 0 ou None, retorna '-----'.
    Adiciona prefixo e sufixo se o valor for válido.
    """
    if value is None or float(value) == 0:
        return "-----"
    
    if is_currency:
        # Formata como R$ 1.234,56
        formatted_value = f"{float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"R$ {formatted_value}"
        
    return f"{prefix}{value}{suffix}"

class ProcessoViewSet(viewsets.ModelViewSet):
    """
    Endpoint da API para visualizar e criar Processos de Diárias.
    """
    queryset = Processo.objects.all().order_by('-created_at')
    serializer_class = ProcessoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Filtra os processos para mostrar apenas os do usuário logado
        # Observação: aqui assumimos que 'solicitante' é um FK para User
        return Processo.objects.filter(solicitante=self.request.user)

    def perform_create(self, serializer):
        """
        Criação simples via POST /api/processos/ (sem arquivos).
        - Salva o processo (associa solicitante)
        - Executa cálculos de diárias e deslocamento
        - Calcula valor_total_empenhar e salva.
        """
        user = self.request.user

        # 1) salva inicialmente com solicitante
        processo_instance = serializer.save(solicitante=user)

        # 2) calcular deslocamento quando aplicável
        deslocamento_data = {'valor_deslocamento': 0.0, 'distancia_km': 0.0, 'preco_gas_usado': 0.0}
        meio = serializer.validated_data.get('meio_transporte')
        if meio == 'VEICULO_PROPRIO':
            try:
                deslocamento_data = calculos_service.calcular_deslocamento(destino=serializer.validated_data.get('destino'))
            except Exception as e:
                logger.exception("Erro ao calcular deslocamento no perform_create: %s", str(e))
                deslocamento_data = {'valor_deslocamento': 0.0, 'distancia_km': 0.0, 'preco_gas_usado': 0.0}

        # 3) calcula diárias com a instância do processo
        try:
            diarias_data = calculos_service.calcular_diarias(processo=processo_instance)
        except Exception as e:
            logger.exception("Erro ao calcular diárias no perform_create: %s", str(e))
            diarias_data = {'valor_total': 0.0}

        # 4) atualiza campos calculados
        processo_instance.distancia_total_km = deslocamento_data.get('distancia_km', 0)
        processo_instance.valor_deslocamento = deslocamento_data.get('valor_deslocamento', 0)
        processo_instance.valor_total_diarias = diarias_data.get('valor_total', 0)
        processo_instance.valor_total_empenhar = processo_instance.valor_total_diarias + processo_instance.valor_deslocamento

        # 5) salva alterações finais
        processo_instance.save()
    
    @action(detail=False, methods=['post'], url_path='submit', permission_classes=[permissions.IsAuthenticated])
    def submit(self, request, *args, **kwargs):
        """
        Endpoint multipart aprimorado:
        - Espera 'processo' (JSON) e 'files' (anexos).
        - Usa os cálculos do frontend para preencher o documento.
        - Faz o upload dos arquivos para o Google Drive.
        - Preenche todas as tags do template corretamente.
        """
        # 1. Obter e validar payload JSON
        try:
            processo_json = json.loads(request.data.get('processo'))
            # Extrai os cálculos enviados pelo frontend para usar no doc
            calculos_frontend = processo_json.pop('calculos', {})
        except (json.JSONDecodeError, TypeError):
            return Response({"error": "Campo 'processo' (JSON) inválido ou ausente."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=processo_json)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # 2. Salvar processo inicial e gerar número/ano
        try:
            with transaction.atomic():
                processo_instance = serializer.save(solicitante=request.user)
                ano_atual = timezone.now().year
                last_num = Processo.objects.filter(ano=ano_atual).aggregate(Max('numero'))['numero__max'] or 0
                processo_instance.ano = ano_atual
                processo_instance.numero = int(last_num) + 1
                
                # Atualiza o processo com os valores calculados do frontend para persistência
                processo_instance.valor_total_diarias = Decimal(calculos_frontend.get('calculo_diarias', {}).get('valor_total_diarias', 0))
                processo_instance.valor_deslocamento = Decimal(calculos_frontend.get('calculo_deslocamento', {}).get('valor_deslocamento', 0))
                processo_instance.distancia_total_km = int(calculos_frontend.get('calculo_deslocamento', {}).get('distancia_km', 0))
                processo_instance.valor_total_empenhar = Decimal(calculos_frontend.get('total_empenhar', 0))
                
                processo_instance.save()

        except Exception as e:
            logger.exception("Falha ao criar processo no banco de dados: %s", e)
            return Response({"error": "Erro interno ao salvar o processo."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 3. Orquestração com o Google Drive
        try:
            # Cria a estrutura de pastas
            root_folder_id = settings.GDRIVE_ROOT_FOLDER_ID
            ano_folder = google_drive_service.ensure_folder(root_folder_id, str(processo_instance.ano))
            processo_folder_name = f"Diária {processo_instance.numero}-{processo_instance.ano} - {processo_instance.solicitante.get_full_name()}"
            processo_folder = google_drive_service.ensure_folder(ano_folder['id'], processo_folder_name)
            docs_folder = google_drive_service.ensure_folder(processo_folder['id'], "1 - Documentos recebidos na requisição")
            
            # Salva o ID da pasta principal no processo
            processo_instance.gdrive_folder_id = processo_folder['id']
            processo_instance.save(update_fields=['gdrive_folder_id'])

            # 4. Faz o upload dos arquivos anexados
            attachments = request.FILES.getlist('files')
            for f in attachments:
                uploaded_file = google_drive_service.upload_file(docs_folder['id'], f.name, f, f.content_type)
                Documento.objects.create(
                    processo=processo_instance,
                    nome_arquivo=f.name,
                    gdrive_file_id=uploaded_file['id'],
                    tipo_documento=Documento.TipoDocumento.OUTRO,
                    uploaded_by=request.user
                )

            # 5. Prepara os dados para o template do Google Docs
            local_created_at = timezone.localtime(processo_instance.created_at)
            
            # Cálculo correto do período da viagem
            delta_dias = processo_instance.data_retorno - processo_instance.data_saida
            numero_dias = math.ceil(delta_dias.total_seconds() / 86400)
            periodo_viagem_str = f"{int(numero_dias)} dia(s)"

            diarias_data = calculos_frontend.get('calculo_diarias', {})
            deslocamento_data = calculos_frontend.get('calculo_deslocamento', {})

            # Dicionário de substituição de tags CORRIGIDO
            replacements = {
                'Numero': f"{processo_instance.numero}-{processo_instance.ano}",
                'Nome': processo_instance.solicitante.get_full_name(),
                'CPF': processo_instance.solicitante.profile.cpf or '',
                'Cargo': processo_instance.solicitante.profile.cargo or '',
                'Local_Destino': processo_instance.destino,
                'Hora_Partida': timezone.localtime(processo_instance.data_saida).strftime('%d/%m/%Y %H:%M'),
                'Hora_Retorno': timezone.localtime(processo_instance.data_retorno).strftime('%d/%m/%Y %H:%M'),
                'Transporte': processo_instance.get_meio_transporte_display(),
                'placa': processo_instance.placa_veiculo or 'Não aplicável',
                'solicitadoEm': local_created_at.strftime('%d/%m/%Y %H:%M'),
                'Periodo_Viagem': periodo_viagem_str,
                
                'numCom': diarias_data.get('num_com_pernoite', 0),
                'upmCom': diarias_data.get('upm_com_pernoite', 0),
                'vlrUPM': f"R$ {diarias_data.get('valor_upm_usado', 0):.2f}".replace('.',','),
                'totalCom': f"R$ {diarias_data.get('total_com_pernoite', 0):.2f}".replace('.',','),
                'numSem': diarias_data.get('num_sem_pernoite', 0),
                'upmSem': diarias_data.get('upm_sem_pernoite', 0),
                'totalSem': f"R$ {diarias_data.get('total_sem_pernoite', 0):.2f}".replace('.',','),
                'numMeia': diarias_data.get('num_meia_diaria', 0),
                'upmMeia': diarias_data.get('upm_meia_diaria', 0),
                'totalMeia': f"R$ {diarias_data.get('total_meia_diaria', 0):.2f}".replace('.',','),
                'totalDiarias': f"R$ {diarias_data.get('valor_total_diarias', 0):.2f}".replace('.',','),
                
                'kmTotal': deslocamento_data.get('distancia_km', 0),
                'precoGas': f"R$ {deslocamento_data.get('preco_gas_usado', 0):.2f}".replace('.',','),
                'vlrDeslocamento': f"R$ {deslocamento_data.get('valor_deslocamento', 0):.2f}".replace('.',','),
                
                'totEmpenhar': f"R$ {calculos_frontend.get('total_empenhar', 0):.2f}".replace('.',','),
                'Total_Empenhar': f"R$ {calculos_frontend.get('total_empenhar', 0):.2f}".replace('.',','),
                'Vlr_Total_Extenso': valor_extenso_sem_centavos_if_round(calculos_frontend.get('total_empenhar', 0)),

                'Finalidade': processo_instance.objetivo_viagem,
                'constaAnexo': 'Sim' if attachments else 'Não',
                'ponto': 'SIM',
                'Pagamento_Curso': 'Sim' if processo_instance.solicita_pagamento_inscricao else 'Não',
                'justificaViagemAntecipada': processo_instance.justificativa_viagem_antecipada or 'Não se aplica.',
                'extrair_data': format_date(local_created_at.date(), format='d \'de\' MMMM \'de\' yyyy', locale='pt_BR'),
            }

            # 6. Cria o documento no Drive e preenche as tags
            doc_copy = google_drive_service.copy_file(
                file_id=settings.GDOC_TEMPLATE_ID,
                new_title=f"Solicitação de Diária - {processo_folder_name}",
                parent_id=docs_folder['id']
            )
            google_docs_service.replace_tags(doc_copy['id'], replacements)
            
            # Envia e-mails, etc.

            # Adicione esta linha para capturar o retorno da orquestração
            orq_res = {
                "doc_url": doc_copy.get('webViewLink'),
                "folder_url": google_drive_service.get_folder_link(processo_folder['id']),
            }
            
            # Envia e-mails, etc.
        except Exception as e:
            logger.exception("Erro ao orquestrar criação no GDrive: %s", e)
            return Response({"error": "Erro ao salvar documentos no Google Drive."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 9. salvar link da pasta no processo (campo gdrive_folder_id já existente)

        # 10. enviar emails
        try:
            send_process_created_email(processo_instance, controle_emails, requester_email=request.user.email)
        except Exception:
            logger.exception("Falha ao enviar emails de notificação para processo %s", processo_instance.id)

        # 11. resposta
        return Response({
            "id": processo_instance.id,
            "numero": processo_instance.numero,
            "ano": processo_instance.ano,
            "gdrive_doc_url": orq_res.get('doc_url'),
            "gdrive_folder_url": orq_res.get('folder_url'),
        }, status=status.HTTP_201_CREATED)


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
