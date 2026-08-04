from django.urls import path

from .views import DocumentDownloadView, DocumentRegistryView

urlpatterns = [
    path("documents/", DocumentRegistryView.as_view(), name="document-registry"),
    path(
        "documents/files/<str:source>/<uuid:entity_id>/<str:item_key>/",
        DocumentDownloadView.as_view(),
        name="document-download",
    ),
]
