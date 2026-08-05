from rest_framework.routers import DefaultRouter
from apps.inventario.views import MovimientoViewSet

router = DefaultRouter()
router.register("movimientos", MovimientoViewSet)

urlpatterns = router.urls
