from django.contrib import admin
from django.utils.html import format_html

from apps.catalogo.models import Categoria, Material, Pieza, Subcategoria


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "prefijo", "activo", "requiere_inspeccion")
    list_filter = ("requiere_inspeccion",)
    search_fields = ("nombre", "prefijo")


@admin.register(Subcategoria)
class SubcategoriaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "categoria", "activo")
    list_filter = ("categoria",)
    search_fields = ("nombre",)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "precio", "activo", "subcategoria", "tipo_control", "control_individual", "cantidad_total", "vista_foto")
    list_filter = ("activo", "subcategoria__categoria", "tipo_control", "control_individual")
    search_fields = ("codigo", "nombre", "marca")
    readonly_fields = ("cantidad_total",)

    def save_model(self, request, obj, form, change):
        if not change:  # solo al crear, no al editar
            obj.activo = True
        super().save_model(request, obj, form, change)

    def vista_foto(self, obj):
        if obj.foto:
            return format_html('<img src="{}" style="height:40px;" />', obj.foto.url)
        return "—"
    vista_foto.short_description = "Foto"


@admin.register(Pieza)
class PiezaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "material", "estado", "padre", "vista_foto")
    list_filter = ("estado", "material__subcategoria__categoria")
    search_fields = ("codigo",)

    def vista_foto(self, obj):
        if obj.foto:
            return format_html('<img src="{}" style="height:40px;" />', obj.foto.url)
        return "—"
    vista_foto.short_description = "Foto"