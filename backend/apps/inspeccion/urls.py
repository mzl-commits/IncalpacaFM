from rest_framework.routers import DefaultRouter

from apps.inspeccion.views import (
    PlantillaCriterioViewSet,
    CriterioViewSet,
    InspeccionViewSet,
    RespuestaCriterioViewSet,
    ProgramacionInspeccionViewSet,
    PlanInspeccionAnualViewSet,
    DocumentoInspeccionViewSet,
)

router = DefaultRouter()
router.register("plantillas-criterios", PlantillaCriterioViewSet)
router.register("criterios", CriterioViewSet)
router.register("inspecciones", InspeccionViewSet)
router.register("respuestas-criterios", RespuestaCriterioViewSet)
router.register("programaciones-inspeccion", ProgramacionInspeccionViewSet, basename="programacion-inspeccion")
router.register("plan-anual", PlanInspeccionAnualViewSet, basename="plan-anual")
router.register("documentos-inspeccion", DocumentoInspeccionViewSet)

urlpatterns = router.urls