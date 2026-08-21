from django.urls import path

from .views import (
    FMCodeListView,
    FMCodeSummaryView,
    TaxonomyActivateView,
    TaxonomyDeactivateView,
    TaxonomyDetailView,
    TaxonomyListCreateView,
    TaxonomyTreeView,
    TaxonomyFamilyView,
    TaxonomyTypeView,
    TaxonomyPartView,
    TaxonomyPieceView,
)

urlpatterns = [
    path("fm-codes/", FMCodeListView.as_view(), name="fm-code-list"),
    path("fm-codes/summary/", FMCodeSummaryView.as_view(), name="fm-code-summary"),
    path("taxonomies/", TaxonomyListCreateView.as_view(), name="taxonomy-list-create"),
    path("taxonomies/tree/", TaxonomyTreeView.as_view(), name="taxonomy-tree"),

    path("taxonomies/families/", TaxonomyFamilyView.as_view(), name="taxonomy-family-list"),
    path("taxonomies/families/<str:pk>/", TaxonomyFamilyView.as_view(), name="taxonomy-family-detail"),
    path("taxonomies/types/", TaxonomyTypeView.as_view(), name="taxonomy-type-list"),
    path("taxonomies/types/<str:pk>/", TaxonomyTypeView.as_view(), name="taxonomy-type-detail"),
    path("taxonomies/parts/", TaxonomyPartView.as_view(), name="taxonomy-part-list"),
    path("taxonomies/parts/<str:pk>/", TaxonomyPartView.as_view(), name="taxonomy-part-detail"),
    path("taxonomies/pieces/", TaxonomyPieceView.as_view(), name="taxonomy-piece-list"),
    path("taxonomies/pieces/<str:pk>/", TaxonomyPieceView.as_view(), name="taxonomy-piece-detail"),

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
