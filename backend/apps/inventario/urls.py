from rest_framework.routers import DefaultRouter

from apps.inventario.views import MovimientoViewSet, SolicitudMovimientoViewSet

router = DefaultRouter()
router.register("movimientos", MovimientoViewSet)
router.register("solicitudes", SolicitudMovimientoViewSet, basename="solicitudmovimiento")

urlpatterns = router.urls
