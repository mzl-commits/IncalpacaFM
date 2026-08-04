from django.urls import path

from .views import NotificationListView, NotificationReadView, NotificationRetryView

urlpatterns = [
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<uuid:pk>/read/', NotificationReadView.as_view(), name='notification-read'),
    path('notifications/<uuid:pk>/retry/', NotificationRetryView.as_view(), name='notification-retry'),
]
