# backend/api/serializers.py
from rest_framework import serializers
from core.models import Processo, ParametrosSistema, Feriado
from common.models import User

# Serializer para leitura de dados do usuário (não expõe dados sensíveis)
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'cargo', 'matricula']

# Serializer principal para o Processo
class ProcessoSerializer(serializers.ModelSerializer):
    # Campo extra para mostrar o nome do solicitante (apenas leitura)
    solicitante_nome = serializers.CharField(source='solicitante.get_full_name', read_only=True)
    # Campo extra para mostrar o texto do status (apenas leitura)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Processo
        # Lista todos os campos que queremos que a API exponha
        fields = [
            'id', 'solicitante', 'solicitante_nome', 'status', 'status_display',
            'objetivo_viagem', 'destino', 'data_saida', 'data_retorno',
            'meio_transporte', 'placa_veiculo', 'envolve_passagens_aereas',
            'solicita_pagamento_inscricao', 'distancia_total_km',
            'valor_total_diarias', 'valor_deslocamento', 'valor_taxa_inscricao',
            'valor_total_empenhar', 'created_at'
        ]
        # Define campos que não podem ser editados diretamente pela API
        read_only_fields = [
            'id', 'solicitante', 'solicitante_nome', 'status', 'status_display',
            'distancia_total_km', 'valor_total_diarias', 'valor_deslocamento',
            'valor_total_empenhar', 'created_at'
        ]

# Crie serializers simples para os outros modelos, se precisar expô-los na API
class ParametrosSistemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametrosSistema
        fields = '__all__'

class FeriadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feriado
        fields = '__all__'