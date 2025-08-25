# backend/core/services/pessoas_service.py
from core.models import Profile, Role
from django.contrib.auth.models import Group

def _nome_user(u) -> str:
    if not u:
        return ""
    return (u.get_full_name() or u.first_name or u.email or "").strip()

def get_nome_presidente() -> str:
    """
    Resolve o nome do Presidente:
      1) Role com slug/name 'presidente' (case-insensitive)
      2) Grupo Django 'Presidente'
      3) Fallback: 'Presidente da Câmara'
    """
    # 1) Role (slug ou name), sem quebrar se maiúsculas/minúsculas diferirem
    role = (
        Role.objects.filter(slug__iexact="presidente").first()
        or Role.objects.filter(name__iexact="presidente").first()
    )
    if role:
        prof = Profile.objects.filter(roles=role).select_related("user").first()
        if prof and prof.user:
            nome = _nome_user(prof.user)
            if nome:
                return nome

    # 2) Grupo Django "Presidente"
    grp = Group.objects.filter(name__iexact="Presidente").first()
    if grp:
        u = grp.user_set.filter(is_active=True).order_by("id").first()
        if u:
            nome = _nome_user(u)
            if nome:
                return nome

    # 3) fallback
    return "Presidente da Câmara"
