from django.contrib import admin
from apps.cuentas.models import Usuario

@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "rol", "activo")