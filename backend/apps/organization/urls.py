from django.urls import path

from .views import ReporterLookupView, ReporterProfileListView

urlpatterns = [
    path("organization/reporters/", ReporterProfileListView.as_view(), name="reporter-profile-list"),
    path("organization/reporters/lookup/", ReporterLookupView.as_view(), name="reporter-lookup"),
]
