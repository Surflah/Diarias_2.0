# backend/core/services/workflow_service.py
from typing import List, Dict
from django.contrib.auth import get_user_model
from django.db import transaction
from core.models import Processo, ProcessoHistorico, Profile, Role

User = get_user_model()

# mapeia pelas escolhas atuais do seu models.Processo.Status
S = Processo.Status

# Quem pode operar em cada status (por slug de Role)
PERMISSOES: Dict[str, List[str]] = {
    S.ANALISE_ADMIN: ["controle_interno", "adm"],
    S.AGUARDANDO_ASSINATURAS_SOLICITACAO: ["assinatura"],
    S.AGUARDANDO_INSCRICAO: ["solicitante"],
    S.AGUARDANDO_EMPENHO: ["contabilidade"],
    S.AGUARDANDO_PAGAMENTO: ["pagamento"],
    S.AGUARDANDO_PC: ["solicitante"],
    S.PC_EM_ANALISE: ["controle_interno", "adm"],
    S.AGUARDANDO_ASSINATURAS_PC: ["assinatura"],
    S.PC_ANALISE_CONTABILIDADE: ["contabilidade"],
}

# Grafo simples de transições (minimamente útil para começar)
TRANSICOES: Dict[str, List[str]] = {
    S.ANALISE_ADMIN: [S.AGUARDANDO_ASSINATURAS_SOLICITACAO, S.INDEFERIDO],
    S.AGUARDANDO_ASSINATURAS_SOLICITACAO: [S.AGUARDANDO_INSCRICAO, S.AGUARDANDO_EMPENHO, S.INDEFERIDO],
    S.AGUARDANDO_INSCRICAO: [S.AGUARDANDO_EMPENHO, S.CANCELADO],
    S.AGUARDANDO_EMPENHO: [S.AGUARDANDO_PAGAMENTO],
    S.AGUARDANDO_PAGAMENTO: [S.AGUARDANDO_PC],
    S.AGUARDANDO_PC: [S.PC_EM_ANALISE, S.AGUARDANDO_DEVOLUCAO if hasattr(S, "AGUARDANDO_DEVOLUCAO") else S.PC_EM_ANALISE],
    S.PC_EM_ANALISE: [S.AGUARDANDO_ASSINATURAS_PC, S.CORRECAO_PENDENTE],
    S.AGUARDANDO_ASSINATURAS_PC: [S.PC_ANALISE_CONTABILIDADE],
    S.PC_ANALISE_CONTABILIDADE: [S.ARQUIVADO],
}

def _slugs_do_user(user: User) -> List[str]:
    try:
        prof = Profile.objects.get(user=user)
    except Profile.DoesNotExist:
        return []
    slugs = list(prof.roles.values_list("slug", flat=True))
    # “flags” comuns — ajuste se tiver
    if user.is_staff and "adm" not in slugs:
        slugs.append("adm")
    return [s.lower() for s in slugs]

def _user_pode_operar(user: User, processo: Processo) -> bool:
    slugs = _slugs_do_user(user)
    # solicitante sempre pode quando a permissão exigir 'solicitante'
    if processo.solicitante_id == user.id:
        slugs.append("solicitante")
    exigidos = PERMISSOES.get(processo.status, [])
    return any(s in exigidos for s in slugs) if exigidos else False

def acoes_permitidas(processo: Processo, user: User) -> List[str]:
    return TRANSICOES.get(processo.status, []) if _user_pode_operar(user, processo) else []

@transaction.atomic
def transicionar(processo: Processo, destino: str, user: User, observacao: str = "") -> ProcessoHistorico:
    if destino not in TRANSICOES.get(processo.status, []):
        raise ValueError(f"Transição inválida: {processo.status} → {destino}")
    if not _user_pode_operar(user, processo):
        raise PermissionError("Usuário sem permissão para esta etapa.")

    de = processo.status
    processo.status = destino
    processo.save(update_fields=["status"])

    hist = ProcessoHistorico.objects.create(
        processo=processo,
        status_anterior=de,
        status_novo=destino,
        responsavel=user,
        anotacao=(observacao or "")
    )
    return hist
