from django.urls import path

from .views import NotificationListView, NotificationRetryView

urlpatterns = [
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<uuid:pk>/retry/', NotificationRetryView.as_view(), name='notification-retry'),
]
