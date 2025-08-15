# backend/core/signals.py

from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.dispatch import receiver
from .models import Profile, Role

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Cria um perfil de usuário automaticamente e atribui o perfil
    padrão 'Solicitante' quando um novo usuário é criado.
    """
    if created:
        # 1. Cria o perfil para o novo usuário
        new_profile = Profile.objects.create(user=instance)
        
        # 2. NOVO: Tenta encontrar e atribuir o perfil padrão 'Solicitante'
        try:
            # Usamos o 'slug' que é um identificador fixo e confiável
            solicitante_role = Role.objects.get(slug='solicitante')
            new_profile.roles.add(solicitante_role)
        except Role.DoesNotExist:
            # Este bloco é um "seguro". Ele roda se, por algum motivo, o perfil 'Solicitante'
            # não existir no banco de dados. Ele evita que o sistema quebre.
            # No terminal do backend, veremos um aviso para que o administrador crie o perfil.
            print("="*50)
            print("AVISO CRÍTICO: O Perfil de Acesso com slug 'solicitante' não foi encontrado.")
            print(f"O novo usuário '{instance.username}' foi criado sem um perfil padrão.")
            print("Por favor, crie o perfil 'Solicitante' no painel de administração.")
            print("="*50)