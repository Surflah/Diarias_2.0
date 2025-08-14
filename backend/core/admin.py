# backend/core/admin.py
from django.contrib import admin
from .models import Processo, ParametrosSistema, Feriado, ProcessoHistorico, Documento, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """
    Configuração para exibir o modelo Profile no painel de administração do Django.
    """
    list_display = ('user', 'cpf', 'cargo')
    search_fields = ('user__username', 'user__email', 'cpf')
    list_filter = ('cargo',)

# Inline para mostrar o histórico dentro da página do Processo
class ProcessoHistoricoInline(admin.TabularInline):
    model = ProcessoHistorico
    extra = 0 # Não mostra formulários extras para adicionar histórico
    fields = ('timestamp', 'status_novo', 'responsavel', 'anotacao')
    readonly_fields = ('timestamp', 'status_novo', 'responsavel', 'anotacao')

    def has_change_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(Processo)
class ProcessoAdmin(admin.ModelAdmin):
    list_display = ('id', 'solicitante', 'destino', 'status', 'data_saida', 'valor_total_empenhar')
    list_filter = ('status', 'solicitante')
    search_fields = ('id', 'objetivo_viagem', 'solicitante__username', 'solicitante__first_name')
    readonly_fields = (
        'solicitante', 'valor_total_diarias', 'valor_deslocamento',
        'valor_taxa_inscricao', 'valor_total_empenhar',
        'created_at', 'updated_at', 'gdrive_folder_id'
    )
    inlines = [ProcessoHistoricoInline] # Adiciona o histórico na tela do processo

@admin.register(ParametrosSistema)
class ParametrosSistemaAdmin(admin.ModelAdmin):
    # Impede que novos parâmetros sejam criados, permitindo apenas a edição do existente
    def has_add_permission(self, request):
        return not ParametrosSistema.objects.exists()

@admin.register(Feriado)
class FeriadoAdmin(admin.ModelAdmin):
    list_display = ('data', 'descricao')
    ordering = ('data',)

# Registrando os outros modelos para simples visualização
admin.site.register(Documento)
admin.site.register(ProcessoHistorico)