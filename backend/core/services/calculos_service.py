# backend/core/services/calculos_service.py

import requests
from decimal import Decimal
from datetime import datetime
from django.conf import settings
from ..models import ParametrosSistema

# --- Constantes para as regras de negócio ---

# Cidades que pertencem ao Grupo 1, conforme Decreto 291/2025
CIDADES_GRUPO_1 = ['florianopolis', 'curitiba']

# Fatores de multiplicação da UPM para cada tipo de diária.
# Usar um dicionário torna o código mais limpo e fácil de manter.
VALORES_DIARIA_UPM = {
    'grupo_1': {
        'com_pernoite': Decimal('100.00'),
        'sem_pernoite': Decimal('40.00'),
        'meia_diaria': Decimal('20.00'),
    },
    'grupo_2': {
        'com_pernoite': Decimal('200.00'),
        'sem_pernoite': Decimal('80.00'),
        'meia_diaria': Decimal('20.00'),
    }
}

class CalculoServiceError(Exception):
    """Exceção customizada para erros nos serviços de cálculo."""
    pass


def calcular_valor_diarias(destino: str, data_saida: datetime, data_retorno: datetime) -> Decimal:
    """
    Calcula o valor total das diárias com base no destino e no período.
    Esta função é "pura", não depende de um objeto Processo,
    o que a torna ideal para a API de preview.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros or not parametros.valor_upm:
            raise CalculoServiceError("Valor da UPM não cadastrado nos parâmetros do sistema.")
    except ParametrosSistema.DoesNotExist:
        raise CalculoServiceError("Parâmetros do sistema não encontrados.")

    if not all([destino, data_saida, data_retorno]) or data_retorno <= data_saida:
        return Decimal('0.00')

    grupo = 'grupo_1' if destino.lower().strip() in CIDADES_GRUPO_1 else 'grupo_2'
    
    duracao_total = data_retorno - data_saida
    total_horas = duracao_total.total_seconds() / 3600
    
    numero_pernoites = duracao_total.days
    horas_restantes = total_horas - (numero_pernoites * 24)

    valor_total_upm = Decimal('0.00')
    valor_total_upm += numero_pernoites * VALORES_DIARIA_UPM[grupo]['com_pernoite']
    
    if horas_restantes >= 12:
        valor_total_upm += VALORES_DIARIA_UPM[grupo]['sem_pernoite']
    elif horas_restantes > 4:
        valor_total_upm += VALORES_DIARIA_UPM[grupo]['meia_diaria']
    
    valor_calculado = valor_total_upm * parametros.valor_upm
    
    return round(valor_calculado, 2)


def calcular_valor_deslocamento(destino: str) -> dict:
    """
    Calcula o valor da indenização por deslocamento usando a API de Rotas.
    Retorna um dicionário com o valor e a distância.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros or not parametros.preco_medio_gasolina:
            raise CalculoServiceError("Preço da gasolina não cadastrado nos parâmetros do sistema.")
        
        # CORREÇÃO: Pega a chave da API a partir das configurações do Django
        api_key = settings.GOOGLE_MAPS_API_KEY
        if not api_key:
            raise CalculoServiceError("GOOGLE_MAPS_API_KEY não configurada no backend.")

        origem = "Câmara Municipal de Itapoá, SC"
        url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origem}&destination={destino}&key={api_key}"
        
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'OK':
            distancia_metros = data['routes'][0]['legs'][0]['distance']['value']
            distancia_km = Decimal(distancia_metros / 1000)
            distancia_total_km = distancia_km * 2
            
            preco_gasolina = parametros.preco_medio_gasolina
            valor = (distancia_total_km / Decimal(10)) * preco_gasolina
            
            return {
                "valor_deslocamento": round(valor, 2),
                "distancia_km": round(distancia_total_km, 1)
            }
        else:
            # Retorna um erro claro para o frontend, se possível
            error_message = data.get('error_message', data['status'])
            raise CalculoServiceError(f"Erro na API de Rotas: {error_message}")

    except requests.exceptions.RequestException as e:
        raise CalculoServiceError(f"Erro de comunicação com a API de Rotas: {e}")
    except (KeyError, IndexError):
        raise CalculoServiceError("Resposta inesperada da API de Rotas. O destino é válido?")