from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from .health import CeleryHealthView, LiveHealthView, ReadyHealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/live/", LiveHealthView.as_view(), name="health-live"),
    path("api/v1/health/ready/", ReadyHealthView.as_view(), name="health-ready"),
    path("api/v1/health/celery/", CeleryHealthView.as_view(), name="health-celery"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.organization.urls")),
    path("api/v1/", include("apps.assets.urls")),
    path("api/v1/", include("apps.spaces.urls")),
    path("api/v1/", include("apps.taxonomy.urls")),
    path("api/v1/", include("apps.assignments.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.incidents.urls")),
    path("api/v1/", include("apps.workorders.urls")),
    path("api/v1/", include("apps.lifecycle.urls")),
    path("api/v1/", include("apps.audit.urls")),
    path("api/v1/", include("apps.documents.urls")),
    path("api/v1/", include("apps.privacy.urls")),
    path("api/v1/", include("apps.catalogo.urls")),
    path("api/v1/", include("apps.inspeccion.urls")),
    path("api/v1/", include("apps.inventario.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
