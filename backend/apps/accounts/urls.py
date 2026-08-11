from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    CurrentUserView,
    LoginView,
    UserListView,
    TechnicianListCreateView,
    TechnicianImportView,
    TechnicianDetailView,
    TechnicianManualNotificationView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("users/", UserListView.as_view(), name="user-list"),
    path("technicians/", TechnicianListCreateView.as_view(), name="technician-list"),
    path("technicians/import/", TechnicianImportView.as_view(), name="technician-import"),
    path("technicians/<uuid:pk>/", TechnicianDetailView.as_view(), name="technician-detail"),
    path("technicians/<uuid:pk>/notifications/", TechnicianManualNotificationView.as_view(), name="technician-notifications"),
]
