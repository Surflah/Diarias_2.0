# backend/common/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

# Para que nossos campos customizados (cargo, matricula) apareçam no admin
class CustomUserAdmin(UserAdmin):
    # Adiciona os campos ao final da aba "Informações pessoais"
    fieldsets = UserAdmin.fieldsets + (
        ('Campos Personalizados', {'fields': ('cargo', 'matricula')}),
    )
    # Adiciona os campos na lista de visualização de usuários
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'cargo')

admin.site.register(User, CustomUserAdmin)