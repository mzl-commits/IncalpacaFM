from django.contrib import admin

from apps.inspeccion.models import Criterio, Inspeccion, PlantillaCriterio, RespuestaCriterio

from .models import PlanInspeccionAnual, ProgramacionInspeccion


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

@admin.register(PlanInspeccionAnual)
class PlanInspeccionAnualAdmin(admin.ModelAdmin):
    list_display = ["anio", "estado", "fecha_inicio", "fecha_fin"]
    list_filter = ["estado"]

@admin.register(ProgramacionInspeccion)
class ProgramacionInspeccionAdmin(admin.ModelAdmin):
    list_display = ["__str__", "fecha_programada", "estado", "periodicidad_dias"]
    list_filter = ["estado"]
    search_fields = ["material__codigo", "pieza__codigo"]