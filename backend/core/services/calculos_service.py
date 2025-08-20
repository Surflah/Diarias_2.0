import requests
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from django.conf import settings
from ..models import ParametrosSistema
from unicodedata import normalize as _normalize

# --- Constantes (sem alteração funcional) ---
CIDADES_GRUPO_1 = ['florianopolis', 'curitiba']
VALORES_DIARIA_UPM = {
    'grupo_1': {'com_pernoite': Decimal('100.00'), 'sem_pernoite': Decimal('40.00'), 'meia_diaria': Decimal('20.00')},
    'grupo_2': {'com_pernoite': Decimal('200.00'), 'sem_pernoite': Decimal('80.00'), 'meia_diaria': Decimal('0.00')}
}

# Lista de capitais (usada para inferir região) — mesma lista que o backend devolve via /config/
CAPITAIS_BRASIL = [
    "aracaju", "belém", "belo horizonte", "boa vista", "brasília", "campo grande",
    "cuiabá", "fortaleza", "goiânia", "joão pessoa", "macapá", "maceió", "manaus",
    "natal", "palmas", "porto alegre", "porto velho", "recife", "rio branco",
    "rio de janeiro", "salvador", "são luís", "são paulo", "teresina", "vitória"
]


class CalculoServiceError(Exception):
    pass


def _normalize_city(s: str) -> str:
    if not s:
        return ''
    return _normalize('NFD', s).encode('ascii', 'ignore').decode('ascii').lower().strip()


def _infer_region_from_destino(destino: str) -> str:
    """
    Retorna 'LOCAL' ou 'OUTROS' baseado no nome da cidade presente em `destino`.
    regras:
      - se cidade é Florianópolis/Curitiba -> LOCAL (grupo_1)
      - se cidade é capital brasileira (exceto as duas acima) -> OUTROS
      - senão -> LOCAL (interior)
    """
    city = destino.split(',')[0].strip()
    normalized = _normalize_city(city)
    if normalized in [c.lower() for c in CIDADES_GRUPO_1]:
        return 'LOCAL'
    if normalized in [_normalize_city(c) for c in CAPITAIS_BRASIL]:
        return 'OUTROS'
    return 'LOCAL'


def calcular_valor_diarias(
    destino: str,
    data_saida: datetime,
    data_retorno: datetime,
    num_com_pernoite: int = None,
    num_sem_pernoite: int = None,
    num_meia_diaria: int = None,
    regiao_diaria: str = None,  # 'LOCAL' | 'OUTROS' (opcional)
) -> dict:
    """
    Calcula o valor das diárias.
    - Prioridade: se frontend enviar num_com_pernoite/num_sem_pernoite/num_meia_diaria, usamos esses valores.
    - Senão: fazemos fallback com regra por dias (N dias -> (N-1) com pernoite + 1 sem pernoite; 1 dia -> sem pernoite).
    - Regiao: se for enviada pelo frontend usamos; senão inferimos a partir do destino.
    Retorna dicionário com Decimal para valores monetários.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros or parametros.valor_upm is None:
            raise CalculoServiceError("Valor da UPM não cadastrado nos parâmetros do sistema.")
    except ParametrosSistema.DoesNotExist:
        raise CalculoServiceError("Parâmetros do sistema não encontrados.")

    valor_upm: Decimal = parametros.valor_upm

    detalhes = {
        'num_com_pernoite': 0, 'upm_com_pernoite': Decimal('0.00'), 'total_com_pernoite': Decimal('0.00'),
        'num_sem_pernoite': 0, 'upm_sem_pernoite': Decimal('0.00'), 'total_sem_pernoite': Decimal('0.00'),
        'num_meia_diaria': 0, 'upm_meia_diaria': Decimal('0.00'), 'total_meia_diaria': Decimal('0.00'),
        'valor_upm_usado': valor_upm,
        'valor_total_diarias': Decimal('0.00')
    }

    # validações básicas
    if not destino or not data_saida or not data_retorno or data_retorno < data_saida:
        return detalhes

    # determinar região
    region = None
    if regiao_diaria:
        try:
            region = regiao_diaria.upper()
            if region not in ('LOCAL', 'OUTROS'):
                region = None
        except Exception:
            region = None
    if not region:
        region = _infer_region_from_destino(destino)

    grupo = 'grupo_1' if region == 'LOCAL' else 'grupo_2'
    regras_upm = VALORES_DIARIA_UPM[grupo]

    # usar quantidades vindas do frontend se existirem (prioridade)
    provided_counts = any(x is not None for x in (num_com_pernoite, num_sem_pernoite, num_meia_diaria))

    if provided_counts:
        num_com = int(num_com_pernoite or 0)
        num_sem = int(num_sem_pernoite or 0)
        num_meia = int(num_meia_diaria or 0)
    else:
        # fallback por dias (sem basear em horas)
        duracao_days = (data_retorno.date() - data_saida.date()).days + 1
        if duracao_days <= 0:
            num_com = num_sem = num_meia = 0
        elif duracao_days == 1:
            # padrão neutro: 1 dia -> sem pernoite (frontend idealmente irá escolher meia/seme)
            num_com = 0; num_sem = 1; num_meia = 0
        else:
            # N >= 2: (N-1) com pernoite + 1 sem pernoite
            num_com = max(duracao_days - 1, 0)
            num_sem = 1
            num_meia = 0

    # Preenche os detalhes monetários (Decimal)
    detalhes['num_com_pernoite'] = num_com
    detalhes['upm_com_pernoite'] = regras_upm['com_pernoite']
    detalhes['total_com_pernoite'] = (Decimal(num_com) * regras_upm['com_pernoite'] * valor_upm).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    detalhes['num_sem_pernoite'] = num_sem
    detalhes['upm_sem_pernoite'] = regras_upm['sem_pernoite']
    detalhes['total_sem_pernoite'] = (Decimal(num_sem) * regras_upm['sem_pernoite'] * valor_upm).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    detalhes['num_meia_diaria'] = num_meia
    detalhes['upm_meia_diaria'] = regras_upm['meia_diaria']
    detalhes['total_meia_diaria'] = (Decimal(num_meia) * regras_upm['meia_diaria'] * valor_upm).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    total = detalhes['total_com_pernoite'] + detalhes['total_sem_pernoite'] + detalhes['total_meia_diaria']
    detalhes['valor_total_diarias'] = total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    return detalhes


def calcular_valor_deslocamento(destino, data_saida=None, data_retorno=None, **kwargs):
    """
    Calcula o valor do deslocamento via Google Directions (ida e volta).
    Retorna números primitivos (floats) para serialização JSON.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros or parametros.preco_medio_gasolina is None:
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
        return {
            "valor_deslocamento": 0.0,
            "distancia_km": 0.0,
            "preco_gas_usado": float(parametros.preco_medio_gasolina) if 'parametros' in locals() and parametros and parametros.preco_medio_gasolina else 0.0,
            "error": f"Ocorreu um erro inesperado no cálculo de deslocamento: {str(e)}"
        }
