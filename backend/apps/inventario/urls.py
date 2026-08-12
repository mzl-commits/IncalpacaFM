from django.urls import path
from rest_framework.routers import DefaultRouter
from apps.inventario.views import (
    MovimientoViewSet,
    SolicitudMovimientoViewSet,
    GrupoSolicitudViewSet,
    WorkOrderActivasView,
)

router = DefaultRouter()
router.register("movimientos", MovimientoViewSet)
router.register("solicitudes", SolicitudMovimientoViewSet, basename="solicitudmovimiento")
router.register("grupos-solicitud", GrupoSolicitudViewSet, basename="gruposolicitud")

urlpatterns = router.urls + [
    path("ots-activas/", WorkOrderActivasView.as_view(), name="ots-activas"),
]

