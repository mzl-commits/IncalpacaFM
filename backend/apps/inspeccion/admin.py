from django.contrib import admin
from apps.inspeccion.models import PlantillaCriterio, Criterio, Inspeccion, RespuestaCriterio


class CriterioInline(admin.TabularInline):
    model = Criterio
    extra = 1


@admin.register(PlantillaCriterio)
class PlantillaCriterioAdmin(admin.ModelAdmin):
    list_display = ("nombre",)
    inlines = [CriterioInline]


class RespuestaCriterioInline(admin.TabularInline):
    model = RespuestaCriterio
    extra = 0


@admin.register(Inspeccion)
class InspeccionAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "material", "pieza", "resultado_general", "fecha", "inspector")
    list_filter = ("tipo", "resultado_general", "plantilla")
    inlines = [RespuestaCriterioInline]