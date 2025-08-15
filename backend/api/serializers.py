# backend/api/serializers.py

from rest_framework import serializers
from core.models import Processo, ParametrosSistema, Feriado, Profile, Role
from common.models import User
from rest_framework import serializers



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'cargo', 'matricula']


class ProcessoSerializer(serializers.ModelSerializer):
    solicitante_nome = serializers.CharField(source='solicitante.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Processo
        fields = [
            'id', 'solicitante', 'solicitante_nome', 'status', 'status_display',
            'objetivo_viagem', 'destino', 'data_saida', 'data_retorno',
            'meio_transporte', 'placa_veiculo', 'envolve_passagens_aereas',
            'solicita_pagamento_inscricao', 'distancia_total_km',
            'valor_total_diarias', 'valor_deslocamento', 'valor_taxa_inscricao',
            'valor_total_empenhar', 'created_at'
        ]
        read_only_fields = [
            'id', 'solicitante', 'solicitante_nome', 'status', 'status_display',
            'distancia_total_km', 'valor_total_diarias', 'valor_deslocamento',
            'valor_total_empenhar', 'created_at'
        ]

class ParametrosSistemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametrosSistema
        fields = '__all__'

class FeriadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feriado
        fields = '__all__'

class ProfileSerializer(serializers.ModelSerializer):
    
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    email = serializers.EmailField(source='user.email', read_only=True)
    roles = serializers.SlugRelatedField(
        many=True,
        read_only=True,
        slug_field='slug'  
    )

    class Meta:
        model = Profile
        fields = ('first_name', 'last_name', 'email', 'cpf', 'cargo', 'lotacao', 'roles')

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        user = instance.user

        instance.cpf = validated_data.get('cpf', instance.cpf)
        instance.cargo = validated_data.get('cargo', instance.cargo)
        instance.lotacao = validated_data.get('lotacao', instance.lotacao)
        instance.save()

        user.first_name = user_data.get('first_name', user.first_name)
        user.last_name = user_data.get('last_name', user.last_name)
        user.save()

        return instance
    
class CalculoPreviewSerializer(serializers.Serializer):
    """
    Valida os dados necessários para o cálculo de preview de uma diária.
    Não está ligado a nenhum modelo, apenas define os campos esperados.
    """
    destino = serializers.CharField(max_length=255)
    data_saida = serializers.DateTimeField()
    data_retorno = serializers.DateTimeField()

    def validate(self, data):
        """
        Validação customizada para garantir que a data de retorno é posterior à de saída.
        """
        if data['data_saida'] >= data['data_retorno']:
            raise serializers.ValidationError("A data de retorno deve ser posterior à data de saída.")
        return data
