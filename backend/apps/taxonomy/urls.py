from django.urls import path

from .views import (
    FMCodeListView,
    FMCodeSummaryView,
    TaxonomyActivateView,
    TaxonomyDeactivateView,
    TaxonomyDetailView,
    TaxonomyListCreateView,
)

urlpatterns = [
    path("fm-codes/", FMCodeListView.as_view(), name="fm-code-list"),
    path("fm-codes/summary/", FMCodeSummaryView.as_view(), name="fm-code-summary"),
    path("taxonomies/", TaxonomyListCreateView.as_view(), name="taxonomy-list-create"),
    path("taxonomies/<uuid:pk>/", TaxonomyDetailView.as_view(), name="taxonomy-detail"),
    path(
        "taxonomies/<uuid:pk>/activate/",
        TaxonomyActivateView.as_view(),
        name="taxonomy-activate",
    ),
    path(
        "taxonomies/<uuid:pk>/deactivate/",
        TaxonomyDeactivateView.as_view(),
        name="taxonomy-deactivate",
    ),
]
