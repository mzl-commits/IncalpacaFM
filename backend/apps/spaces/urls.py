from django.urls import path

from .views import (
    FacilitySiteArchiveView,
    FacilitySiteDetailView,
    FacilitySiteListCreateView,
    FacilitySiteRestoreView,
    SpaceImpactView,
    SpaceNodeArchiveView,
    SpaceNodeDetailView,
    SpaceNodeListCreateView,
    SpaceNodeRestoreView,
    SpaceOptionsView,
    SpaceSearchView,
    SpaceTreeView,
)

urlpatterns = [
    path("spaces/sites/", FacilitySiteListCreateView.as_view(), name="space-site-list-create"),
    path("spaces/sites/<uuid:pk>/", FacilitySiteDetailView.as_view(), name="space-site-detail"),
    path("spaces/sites/<uuid:pk>/archive/", FacilitySiteArchiveView.as_view(), name="space-site-archive"),
    path("spaces/sites/<uuid:pk>/restore/", FacilitySiteRestoreView.as_view(), name="space-site-restore"),
    path("spaces/nodes/", SpaceNodeListCreateView.as_view(), name="space-node-list-create"),
    path("spaces/nodes/<uuid:pk>/", SpaceNodeDetailView.as_view(), name="space-node-detail"),
    path("spaces/nodes/<uuid:pk>/archive/", SpaceNodeArchiveView.as_view(), name="space-node-archive"),
    path("spaces/nodes/<uuid:pk>/restore/", SpaceNodeRestoreView.as_view(), name="space-node-restore"),
    path("spaces/nodes/<uuid:pk>/impact/", SpaceImpactView.as_view(), name="space-node-impact"),
    path("spaces/tree/", SpaceTreeView.as_view(), name="space-tree"),
    path("spaces/search/", SpaceSearchView.as_view(), name="space-search"),
    path("spaces/options/", SpaceOptionsView.as_view(), name="space-options"),
]
