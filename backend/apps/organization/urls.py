from django.urls import path

from .views import ReporterProfileListView

urlpatterns = [
    path("organization/reporters/", ReporterProfileListView.as_view(), name="reporter-profile-list"),
]
