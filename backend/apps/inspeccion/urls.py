from rest_framework.routers import DefaultRouter

from apps.inspeccion.views import (
    PlantillaCriterioViewSet,
    CriterioViewSet,
    InspeccionViewSet,
    RespuestaCriterioViewSet,
)

router = DefaultRouter()
router.register("plantillas-criterios", PlantillaCriterioViewSet)
router.register("criterios", CriterioViewSet)
router.register("inspecciones", InspeccionViewSet)
router.register("respuestas-criterios", RespuestaCriterioViewSet)

urlpatterns = router.urls
