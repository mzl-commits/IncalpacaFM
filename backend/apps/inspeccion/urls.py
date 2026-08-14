from rest_framework.routers import DefaultRouter

from apps.inspeccion.views import (
    CriterioViewSet,
    InspeccionViewSet,
    PlanInspeccionAnualViewSet,
    PlantillaCriterioViewSet,
    ProgramacionInspeccionViewSet,
    RespuestaCriterioViewSet,
)

router = DefaultRouter()
router.register("plantillas-criterios", PlantillaCriterioViewSet)
router.register("criterios", CriterioViewSet)
router.register("inspecciones", InspeccionViewSet)
router.register("respuestas-criterios", RespuestaCriterioViewSet)
router.register("programaciones-inspeccion", ProgramacionInspeccionViewSet, basename="programacion-inspeccion")
router.register("plan-anual", PlanInspeccionAnualViewSet, basename="plan-anual")

urlpatterns = router.urls