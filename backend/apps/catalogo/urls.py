from rest_framework.routers import DefaultRouter

from apps.catalogo.views import CategoriaViewSet, MaterialViewSet, PiezaViewSet, SubcategoriaViewSet

router = DefaultRouter()
router.register("categorias", CategoriaViewSet)
router.register("subcategorias", SubcategoriaViewSet)
router.register("materiales", MaterialViewSet)
router.register("piezas", PiezaViewSet)

urlpatterns = router.urls