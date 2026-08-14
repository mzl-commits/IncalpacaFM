from rest_framework.routers import DefaultRouter

from apps.catalogo.views import (
    CategoriaViewSet, SubcategoriaViewSet, MaterialViewSet, PiezaViewSet, AlmacenViewSet,
)

router = DefaultRouter()
router.register("categorias", CategoriaViewSet)
router.register("subcategorias", SubcategoriaViewSet)
router.register("materiales", MaterialViewSet)
router.register("piezas", PiezaViewSet)
router.register("almacenes", AlmacenViewSet)

urlpatterns = router.urls