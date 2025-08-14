# backend/core/models.py
from django.db import models
from django.conf import settings 

from django.contrib.auth.models import User
from django.db.models.signals import post_save

class Role(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Nome do Perfil")
    # Ex: 'solicitante', 'controle_interno', etc.
    slug = models.SlugField(max_length=100, unique=True, help_text="Identificador único usado no código")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Perfil de Acesso"
        verbose_name_plural = "Perfis de Acesso"
        ordering = ['name']


class Profile(models.Model):
    """
    Modelo de Perfil para estender o modelo de usuário padrão do Django
    com informações adicionais específicas da nossa aplicação.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    cpf = models.CharField(max_length=14, null=True, blank=True, help_text="Formato: 123.456.789-00")
    cargo = models.CharField(max_length=100, null=True, blank=True)
    roles = models.ManyToManyField(Role, blank=True, related_name='profiles', verbose_name="Perfis de Acesso")

    def __str__(self):
        return f'Perfil de {self.user.username}'


class ParametrosSistema(models.Model):
    """
    Armazena parâmetros globais do sistema que o administrador pode alterar.
    Deve haver apenas uma linha nesta tabela.
    """
    valor_upm = models.DecimalField(
        "Valor da UPM (R$)",
        max_digits=10,
        decimal_places=2,
        help_text="Valor atual, em Reais, da Unidade Padrão Municipal."
    )
    preco_medio_gasolina = models.DecimalField(
        "Preço Médio da Gasolina (R$)",
        max_digits=10,
        decimal_places=2,
        help_text="Preço médio do litro da gasolina para cálculo de deslocamento."
    )

    class Meta:
        verbose_name = "Parâmetro do Sistema"
        verbose_name_plural = "Parâmetros do Sistema"

    def __str__(self):
        return f"Configurações Atuais do Sistema"


class Feriado(models.Model):
    """
    Modelo para cadastrar feriados e dias não úteis para o cálculo de prazos.
    """
    data = models.DateField("Data", unique=True)
    descricao = models.CharField("Descrição", max_length=100)

    class Meta:
        verbose_name = "Feriado ou Recesso"
        verbose_name_plural = "Feriados e Recessos"

    def __str__(self):
        return f"{self.data.strftime('%d/%m/%Y')} - {self.descricao}"


class Processo(models.Model):
    """
    O modelo central que representa uma solicitação de diária e todo o seu ciclo de vida.
    """
    class Status(models.TextChoices):
        RASCUNHO = 'RASCUNHO', 'Rascunho'
        ANALISE_ADMIN = 'ANALISE_ADMIN', 'Aguardando Análise Administrativa'
        AGUARDANDO_ASSINATURAS_SOLICITACAO = 'AG_ASS_SOL', 'Aguardando Assinaturas (Solicitação)'
        AGUARDANDO_INSCRICAO = 'AG_INSCRICAO', 'Aguardando Comprovante de Inscrição'
        AGUARDANDO_EMPENHO = 'AG_EMPENHO', 'Aguardando Empenho'
        AGUARDANDO_PAGAMENTO = 'AG_PAGAMENTO', 'Aguardando Pagamento'
        AGUARDANDO_PC = 'AG_PC', 'Aguardando Prestação de Contas'
        PC_EM_ANALISE = 'PC_ANALISE', 'PC em Análise (Controle Interno)'
        AGUARDANDO_ASSINATURAS_PC = 'AG_ASS_PC', 'Aguardando Assinaturas (PC)'
        PC_ANALISE_CONTABILIDADE = 'PC_ANALISE_CONT', 'PC em Análise (Contabilidade)'
        ARQUIVADO = 'ARQUIVADO', 'Processo Arquivado'
        CORRECAO_PENDENTE = 'CORRECAO', 'Correção Pendente'
        INDEFERIDO = 'INDEFERIDO', 'Indeferido'
        CANCELADO = 'CANCELADO', 'Cancelado'
        
    class MeioTransporte(models.TextChoices):
        VEICULO_PROPRIO = 'VEICULO_PROPRIO', 'Veículo Próprio'
        VEICULO_OFICIAL = 'VEICULO_OFICIAL', 'Veículo Oficial'
        AEREO = 'AEREO', 'Transporte Aéreo'
        ONIBUS = 'ONIBUS', 'Transporte Rodoviário (Ônibus)'
        OUTRO = 'OUTRO', 'Outro'

    # --- Relacionamentos ---
    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='solicitacoes',
        verbose_name="Solicitante"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RASCUNHO
    )

    # --- Informações da Viagem (Art. 5º da Resolução) ---
    objetivo_viagem = models.TextField("Objetivo da Viagem")
    destino = models.CharField("Cidade de Destino", max_length=255)
    data_saida = models.DateTimeField("Data e Hora da Saída")
    data_retorno = models.DateTimeField("Data e Hora do Retorno")
    meio_transporte = models.CharField(
        "Meio de Transporte",
        max_length=20,
        choices=MeioTransporte.choices
    )
    placa_veiculo = models.CharField(
        "Placa do Veículo",
        max_length=10,
        blank=True, null=True,
        help_text="Preencher somente se o meio de transporte for 'Veículo Próprio'."
    )
    envolve_passagens_aereas = models.BooleanField(
        "Viagem envolve compra de passagens aéreas?",
        default=False,
        help_text="Marcar esta opção altera o prazo de solicitação para 10 dias úteis."
    )
    solicita_pagamento_inscricao = models.BooleanField(
        "Solicita pagamento de taxa de inscrição?",
        default=False
    )

    # --- Valores Calculados e Armazenados ---
    distancia_total_km = models.PositiveIntegerField(
        "Distância Total (km)",
        null=True, blank=True,
        help_text="Distância de ida e volta calculada automaticamente."
    )
    valor_total_diarias = models.DecimalField(
        "Valor Total das Diárias (R$)",
        max_digits=10, decimal_places=2, default=0.0
    )
    valor_deslocamento = models.DecimalField(
        "Valor da Indenização de Deslocamento (R$)",
        max_digits=10, decimal_places=2, default=0.0
    )
    valor_taxa_inscricao = models.DecimalField(
        "Valor da Taxa de Inscrição (R$)",
        max_digits=10, decimal_places=2, default=0.0
    )
    valor_total_empenhar = models.DecimalField(
        "Valor Total a Empenhar (R$)",
        max_digits=10, decimal_places=2, default=0.0
    )

    # --- Metadados e Controle ---
    gdrive_folder_id = models.CharField(max_length=100, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Processo de Diária"
        verbose_name_plural = "Processos de Diárias"
        ordering = ['-created_at']

    def __str__(self):
        return f"Processo #{self.id} - {self.solicitante.get_full_name()}"


class ProcessoHistorico(models.Model):
    """
    Registra cada mudança de status de um processo, criando uma trilha de auditoria.
    """
    processo = models.ForeignKey(Processo, on_delete=models.CASCADE, related_name='historico')
    status_anterior = models.CharField(max_length=20, choices=Processo.Status.choices, null=True, blank=True)
    status_novo = models.CharField(max_length=20, choices=Processo.Status.choices)
    timestamp = models.DateTimeField(auto_now_add=True)
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        verbose_name="Responsável pela Ação"
    )
    anotacao = models.TextField("Anotação / Justificativa", blank=True)

    class Meta:
        verbose_name = "Histórico do Processo"
        verbose_name_plural = "Históricos dos Processos"
        ordering = ['-timestamp']


class Documento(models.Model):
    """
    Representa um arquivo associado a um processo, armazenado no Google Drive.
    """
    class TipoDocumento(models.TextChoices):
        SOLICITACAO_INICIAL = 'SOLICITACAO_INICIAL', 'Solicitação Inicial'
        SOLICITACAO_ASSINADA = 'SOLICITACAO_ASSINADA', 'Solicitação Assinada'
        COMPROVANTE_INSCRICAO = 'COMPROVANTE_INSCRICAO', 'Comprovante de Inscrição'
        EMPENHO = 'EMPENHO', 'Nota de Empenho'
        COMPROVANTE_PAGAMENTO = 'COMPROVANTE_PAGAMENTO', 'Comprovante de Pagamento'
        RELATORIO_VIAGEM = 'RELATORIO_VIAGEM', 'Relatório de Viagem'
        COMPROVANTE_HOSPEDAGEM = 'COMPROVANTE_HOSPEDAGEM', 'Comprovante de Hospedagem'
        OUTRO = 'OUTRO', 'Outro'
        
    processo = models.ForeignKey(Processo, on_delete=models.CASCADE, related_name='documentos')
    nome_arquivo = models.CharField("Nome do Arquivo", max_length=255)
    gdrive_file_id = models.CharField("ID do Arquivo no Drive", max_length=100, unique=True)
    tipo_documento = models.CharField(
        "Tipo do Documento",
        max_length=30,
        choices=TipoDocumento.choices
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"