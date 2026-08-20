from rest_framework.routers import DefaultRouter

from apps.catalogo.views import (
    CategoriaViewSet,
    SubcategoriaViewSet,
    MaterialViewSet,
    PiezaViewSet,
    AlmacenViewSet,
    UnidadMedidaViewSet,
    TipoManejoStockViewSet,
    TipoMedidaCatalogoViewSet,
)

router = DefaultRouter()
router.register("categorias", CategoriaViewSet)
router.register("subcategorias", SubcategoriaViewSet)
router.register("materiales", MaterialViewSet)
router.register("piezas", PiezaViewSet)
router.register("almacenes", AlmacenViewSet)
router.register("unidades-medida", UnidadMedidaViewSet)
router.register("tipos-manejo-stock", TipoManejoStockViewSet)
router.register("tipos-medida", TipoMedidaCatalogoViewSet)

urlpatterns = router.urls