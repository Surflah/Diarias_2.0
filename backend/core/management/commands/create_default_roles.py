# backend/core/management/commands/create_default_roles.py
from django.core.management.base import BaseCommand
from core.models import Role

DEFAULT_ROLES = [
    ('Solicitante', 'solicitante'),
    ('Controle Interno', 'controle_interno'),
    # adicionar outros se necessário
]

class Command(BaseCommand):
    help = "Cria perfis de acesso padrão caso não existam."

    def handle(self, *args, **options):
        for name, slug in DEFAULT_ROLES:
            r, created = Role.objects.get_or_create(slug=slug, defaults={'name': name})
            if created:
                self.stdout.write(self.style.SUCCESS(f"Criou role: {slug}"))
            else:
                self.stdout.write(f"Role já existe: {slug}")
