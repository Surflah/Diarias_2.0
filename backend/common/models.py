# backend/common/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission

class User(AbstractUser):
    """
    Modelo de usuário customizado. Estende o User padrão do Django.
    """
    cargo = models.CharField(
        "Cargo ou Função",
        max_length=150,
        blank=True,
        help_text="Cargo ou função do usuário, ex: Vereador, Assessor Parlamentar."
    )
    matricula = models.CharField(
        "Matrícula",
        max_length=20,
        blank=True,
        null=True,
        unique=True,
        help_text="Matrícula funcional do servidor, se aplicável."
    )

    # ADICIONE ESTES DOIS CAMPOS PARA RESOLVER O CONFLITO
    groups = models.ManyToManyField(
        Group,
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        related_name="common_user_groups",  # Apelido único para esta relação
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name="common_user_permissions",  # Apelido único para esta relação
        related_query_name="user",
    )
    # FIM DA ADIÇÃO

    class Meta:
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"

    def __str__(self):
        return self.get_full_name() or self.username