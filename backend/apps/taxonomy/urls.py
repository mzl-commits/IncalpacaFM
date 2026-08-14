from django.urls import path

from .views import (
    FMCodeListView,
    FMCodeSummaryView,
    TaxonomyActivateView,
    TaxonomyDeactivateView,
    TaxonomyDetailView,
    TaxonomyListCreateView,
    TaxonomyFamilyListCreateView,
    TaxonomyFamilyDetailView,
    TaxonomyTreeView,
    TaxonomyPartListCreateView,
    TaxonomyPartDetailView,
    TaxonomyPieceListCreateView,
    TaxonomyPieceDetailView,
)

urlpatterns = [
    path("fm-codes/", FMCodeListView.as_view(), name="fm-code-list"),
    path("fm-codes/summary/", FMCodeSummaryView.as_view(), name="fm-code-summary"),
    path("taxonomies/", TaxonomyListCreateView.as_view(), name="taxonomy-list-create"),
    path("taxonomies/families/", TaxonomyFamilyListCreateView.as_view(), name="taxonomy-family-list-create"),
    path("taxonomies/families/<uuid:pk>/", TaxonomyFamilyDetailView.as_view(), name="taxonomy-family-detail"),
    path("taxonomies/parts/", TaxonomyPartListCreateView.as_view(), name="taxonomy-part-list-create"),
    path("taxonomies/parts/<uuid:pk>/", TaxonomyPartDetailView.as_view(), name="taxonomy-part-detail"),
    path("taxonomies/pieces/", TaxonomyPieceListCreateView.as_view(), name="taxonomy-piece-list-create"),
    path("taxonomies/pieces/<uuid:pk>/", TaxonomyPieceDetailView.as_view(), name="taxonomy-piece-detail"),
    path("taxonomies/tree/", TaxonomyTreeView.as_view(), name="taxonomy-tree"),
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
