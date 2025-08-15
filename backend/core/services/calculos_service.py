# backend/core/services/calculos_service.py

import requests
from decimal import Decimal
from datetime import datetime
from django.conf import settings
from ..models import ParametrosSistema

# --- Constantes (sem alteração) ---
CIDADES_GRUPO_1 = ['florianopolis', 'curitiba']
VALORES_DIARIA_UPM = {
    'grupo_1': {'com_pernoite': Decimal('100.00'), 'sem_pernoite': Decimal('40.00'), 'meia_diaria': Decimal('20.00')},
    'grupo_2': {'com_pernoite': Decimal('200.00'), 'sem_pernoite': Decimal('80.00'), 'meia_diaria': Decimal('20.00')}
}

class CalculoServiceError(Exception):
    pass

# <-- FUNÇÃO ALTERADA PARA RETORNAR UM DICIONÁRIO DETALHADO -->
def calcular_valor_diarias(destino: str, data_saida: datetime, data_retorno: datetime) -> dict:
    """
    Calcula o valor das diárias e retorna uma análise detalhada do cálculo.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros or not parametros.valor_upm:
            raise CalculoServiceError("Valor da UPM não cadastrado nos parâmetros do sistema.")
    except ParametrosSistema.DoesNotExist:
        raise CalculoServiceError("Parâmetros do sistema não encontrados.")

    valor_upm = parametros.valor_upm
    # Prepara o dicionário de retorno com valores padrão
    detalhes = {
        'num_com_pernoite': 0, 'upm_com_pernoite': Decimal('0.00'), 'total_com_pernoite': Decimal('0.00'),
        'num_sem_pernoite': 0, 'upm_sem_pernoite': Decimal('0.00'), 'total_sem_pernoite': Decimal('0.00'),
        'num_meia_diaria': 0, 'upm_meia_diaria': Decimal('0.00'), 'total_meia_diaria': Decimal('0.00'),
        'valor_upm_usado': valor_upm,
        'valor_total_diarias': Decimal('0.00')
    }

    if not all([destino, data_saida, data_retorno]) or data_retorno <= data_saida:
        return detalhes

    grupo = 'grupo_1' if destino.lower().strip() in CIDADES_GRUPO_1 else 'grupo_2'
    regras_upm = VALORES_DIARIA_UPM[grupo]

    duracao_total = data_retorno - data_saida
    total_horas = duracao_total.total_seconds() / 3600
    
    numero_pernoites = duracao_total.days
    horas_restantes = total_horas - (numero_pernoites * 24)

    # Preenche os detalhes do cálculo
    if numero_pernoites > 0:
        detalhes['num_com_pernoite'] = numero_pernoites
        detalhes['upm_com_pernoite'] = regras_upm['com_pernoite']
        detalhes['total_com_pernoite'] = numero_pernoites * regras_upm['com_pernoite'] * valor_upm

    if horas_restantes >= 12:
        detalhes['num_sem_pernoite'] = 1
        detalhes['upm_sem_pernoite'] = regras_upm['sem_pernoite']
        detalhes['total_sem_pernoite'] = 1 * regras_upm['sem_pernoite'] * valor_upm
    elif horas_restantes > 4:
        detalhes['num_meia_diaria'] = 1
        detalhes['upm_meia_diaria'] = regras_upm['meia_diaria']
        detalhes['total_meia_diaria'] = 1 * regras_upm['meia_diaria'] * valor_upm
    
    # Soma o total final
    detalhes['valor_total_diarias'] = round(
        detalhes['total_com_pernoite'] + detalhes['total_sem_pernoite'] + detalhes['total_meia_diaria'], 2
    )
    
    return detalhes

def calcular_valor_deslocamento(destino: str) -> dict:
    """
    Calcula o valor do deslocamento e retorna uma análise detalhada.
    Retorna números em tipos primitivos (floats) para facilitar serialização JSON.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros or not parametros.preco_medio_gasolina:
            raise CalculoServiceError("Preço da gasolina não cadastrado nos parâmetros do sistema.")
        
        preco_gasolina = parametros.preco_medio_gasolina
        resultado = {
            "valor_deslocamento": 0.0,
            "distancia_km": 0.0,
            "preco_gas_usado": float(preco_gasolina)
        }
        
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', None)
        if not api_key:
            raise CalculoServiceError("GOOGLE_MAPS_API_KEY não configurada.")

        origem = "Câmara Municipal de Itapoá, SC"
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            'origin': origem,
            'destination': destino,
            'key': api_key,
            'mode': 'driving',
            'units': 'metric'
        }

        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get('status') == 'OK' and data.get('routes'):
            try:
                distancia_metros = data['routes'][0]['legs'][0]['distance']['value']
                distancia_km = Decimal(distancia_metros) / Decimal(1000)
                distancia_total_km = distancia_km * 2  # ida e volta

                valor = (distancia_total_km / Decimal(10)) * Decimal(preco_gasolina)

                resultado["valor_deslocamento"] = float(round(valor, 2))
                resultado["distancia_km"] = float(round(distancia_total_km, 1))
                resultado["preco_gas_usado"] = float(preco_gasolina)
                return resultado
            except (KeyError, IndexError, TypeError) as e:
                raise CalculoServiceError("Resposta inesperada da API de Rotas. O destino é válido? " + str(e))
        else:
            error_message = data.get('error_message') or data.get('status') or 'Unknown error from Google Directions API'
            raise CalculoServiceError(f"Erro na API de Rotas: {error_message}")

    except requests.exceptions.RequestException as e:
        raise CalculoServiceError(f"Erro de comunicação com a API de Rotas: {e}")
    except CalculoServiceError:
        raise
    except Exception as e:
        # Em caso de erro inesperado, devolve padrão e mensagem
        return {
            "valor_deslocamento": 0.0,
            "distancia_km": 0.0,
            "preco_gas_usado": float(parametros.preco_medio_gasolina) if 'parametros' in locals() and parametros and parametros.preco_medio_gasolina else 0.0,
            "error": f"Ocorreu um erro inesperado no cálculo de deslocamento: {str(e)}"
        }
