from rest_framework.routers import DefaultRouter

from apps.catalogo.views import (
    CategoriaViewSet,
    SubcategoriaViewSet,
    MaterialViewSet,
    PiezaViewSet,
    AlmacenViewSet,
    UnidadMedidaViewSet,
    TipoManejoStockViewSet,
)

router = DefaultRouter()
router.register("categorias", CategoriaViewSet)
router.register("subcategorias", SubcategoriaViewSet)
router.register("materiales", MaterialViewSet)
router.register("piezas", PiezaViewSet)
router.register("almacenes", AlmacenViewSet)
router.register("unidades-medida", UnidadMedidaViewSet)
router.register("tipos-manejo-stock", TipoManejoStockViewSet)

urlpatterns = router.urls
