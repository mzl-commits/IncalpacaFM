from django.urls import path

from .views import (ActivePrivacyNoticeView, AdminArcoRequestDetailView, AdminArcoRequestListView, AdminPrivacyNoticeDetailView, AdminPrivacyNoticeListView, ArcoRequestCreateView, PersonalDataIncidentDetailView, PersonalDataIncidentListView, PrivacyAcknowledgementCreateView, ProcessingInventoryDetailView, ProcessingInventoryListView)

urlpatterns = [
    path("privacy/notices/active/", ActivePrivacyNoticeView.as_view()),
    path("privacy/acknowledgements/", PrivacyAcknowledgementCreateView.as_view()),
    path("privacy/arco/", ArcoRequestCreateView.as_view()),
    path("admin/privacy/notices/", AdminPrivacyNoticeListView.as_view()),
    path("admin/privacy/notices/<uuid:pk>/", AdminPrivacyNoticeDetailView.as_view()),
    path("admin/privacy/arco/", AdminArcoRequestListView.as_view()),
    path("admin/privacy/arco/<uuid:pk>/", AdminArcoRequestDetailView.as_view()),
    path("admin/privacy/inventory/", ProcessingInventoryListView.as_view()),
    path("admin/privacy/inventory/<uuid:pk>/", ProcessingInventoryDetailView.as_view()),
    path("admin/privacy/incidents/", PersonalDataIncidentListView.as_view()),
    path("admin/privacy/incidents/<uuid:pk>/", PersonalDataIncidentDetailView.as_view()),
]
