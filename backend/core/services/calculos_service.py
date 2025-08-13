# backend/core/services/calculos_service.py
import requests
from decimal import Decimal
from datetime import timedelta
from django.conf import settings
from ..models import ParametrosSistema, Processo

# Constantes para os valores base em UPM
UPM_COM_PERNOITE_G1 = 100
UPM_SEM_PERNOITE_G1 = 40
UPM_MEIA_DIARIA_G1 = 20
#... adicione os outros valores do decreto para G2

def calcular_diarias(processo: Processo) -> dict:
    """
    Calcula o valor total das diárias com base na duração e destino da viagem.
    Retorna um dicionário com o valor total e detalhes do cálculo.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros:
            raise ValueError("Parâmetros do sistema não configurados.")

        valor_upm = parametros.valor_upm
        duracao_total = processo.data_retorno - processo.data_saida
        
        # --- Lógica para determinar a quantidade de cada tipo de diária ---
        # Esta é uma lógica simplificada e precisa ser refinada com as regras de negócio exatas.
        # Ex: Como contar pernoites? Como tratar viagens que cruzam a meia-noite?
        
        dias_completos = duracao_total.days
        horas_restantes = duracao_total.seconds / 3600
        
        num_com_pernoite = dias_completos
        num_sem_pernoite = 0
        num_meia_diaria = 0

        if horas_restantes > 12:
            num_sem_pernoite = 1  # Cobre exclusivamente alimentação e locomoção urbana, quando o afastamento exceder 12 (doze) horas diárias [cite: 79]
        elif 4 < horas_restantes <= 12: # Assumindo que uma viagem de menos de 4h não gera diária
            num_meia_diaria = 1 # Cobre exclusivamente alimentação e locomoção urbana, quando o afastamento for inferior a 12 (doze) horas diárias [cite: 80]
        
        # --- Lógica para determinar o grupo de destino ---
        # Por enquanto, uma lógica simples. Pode ser expandida no futuro.
        destino_lower = processo.destino.lower()
        if 'florianópolis' in destino_lower or 'curitiba' in destino_lower:
            # Grupo 1
            total = (num_com_pernoite * UPM_COM_PERNOITE_G1 * valor_upm) + \
                    (num_sem_pernoite * UPM_SEM_PERNOITE_G1 * valor_upm) + \
                    (num_meia_diaria * UPM_MEIA_DIARIA_G1 * valor_upm)
        else:
            # Assumindo Grupo 2 para os demais casos por enquanto
            # Substituir pelos valores corretos de UPM para Grupo 2
            total = 0 # Implementar
            
        return {
            "valor_total": total,
            "detalhes": {
                "com_pernoite": num_com_pernoite,
                "sem_pernoite": num_sem_pernoite,
                "meia_diaria": num_meia_diaria
            }
        }

    except Exception as e:
        # É importante tratar erros, como a falta de parâmetros
        return {"valor_total": Decimal("0.0"), "error": str(e)}


def calcular_deslocamento(destino: str) -> dict:
    """
    Calcula o valor da indenização por deslocamento usando a API do Google Maps.
    Retorna um dicionário com o valor total e a distância.
    """
    try:
        parametros = ParametrosSistema.objects.first()
        if not parametros:
            raise ValueError("Parâmetros do sistema não configurados.")
        
        # = settings.Google Maps_API_KEY # Adicione esta variável ao seu .env e settings.py
        origem = "Câmara Municipal de Itapoá, SC" # Ponto de partida fixo [cite: 195]

        # Monta a URL para a API de Rotas
        url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origem}&destination={destino}&key={api_key}"
        
        response = requests.get(url)
        response.raise_for_status() # Lança um erro para respostas ruins (4xx ou 5xx)
        
        data = response.json()
        
        if data['status'] == 'OK':
            # Pega a distância em metros da primeira rota encontrada
            distancia_metros = data['routes'][0]['legs'][0]['distance']['value']
            distancia_km = Decimal(distancia_metros / 1000)
            
            # A fórmula considera a distância total (ida e volta)
            distancia_total_km = distancia_km * 2
            
            # Aplica a fórmula do Decreto 291/2025
            preco_gasolina = parametros.preco_medio_gasolina
            valor = (distancia_total_km / Decimal(10)) * preco_gasolina # [cite: 184]
            
            return {
                "valor_deslocamento": valor.quantize(Decimal("0.01")),
                "distancia_km": distancia_total_km.quantize(Decimal("0.1"))
            }
        else:
            raise ValueError(f"Erro na API do Google Maps: {data.get('error_message', data['status'])}")

    except Exception as e:
        return {"valor_deslocamento": Decimal("0.0"), "distancia_km": 0, "error": str(e)}