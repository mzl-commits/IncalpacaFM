from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.inspeccion.views import (
    PlantillaCriterioViewSet,
    CriterioViewSet,
    InspeccionViewSet,
    RespuestaCriterioViewSet,
    ProgramacionInspeccionViewSet,
    PlanInspeccionAnualViewSet,
    DocumentoInspeccionViewSet,
    color_mes_view,
    frecuencia_uso_view,
    checklist_contexto_view,
)

router = DefaultRouter()
router.register("plantillas-criterios", PlantillaCriterioViewSet)
router.register("criterios", CriterioViewSet)
router.register("inspecciones", InspeccionViewSet)
router.register("respuestas-criterios", RespuestaCriterioViewSet)
router.register("programaciones-inspeccion", ProgramacionInspeccionViewSet, basename="programacion-inspeccion")
router.register("plan-anual", PlanInspeccionAnualViewSet, basename="plan-anual")
router.register("documentos-inspeccion", DocumentoInspeccionViewSet)

urlpatterns = [
    path("color-mes/", color_mes_view, name="color-mes"),
    path("frecuencia-uso/", frecuencia_uso_view, name="frecuencia-uso"),
    path("checklist-contexto/", checklist_contexto_view, name="checklist-contexto"),
    path("inspecciones/checklist-contexto/", checklist_contexto_view, name="inspeccion-checklist-contexto"),
] + router.urls
