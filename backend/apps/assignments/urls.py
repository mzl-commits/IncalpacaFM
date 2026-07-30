from django.urls import path

from .views import AssignmentCatalogView, AssignmentDetailView, AssignmentListView, AssignmentOperationView, DeliveryCreateView

urlpatterns = [
    path('assignments/', AssignmentListView.as_view(), name='assignment-list'),
    path('assignments/catalog/', AssignmentCatalogView.as_view(), name='assignment-catalog'),
    path('assignments/deliver/', DeliveryCreateView.as_view(), name='assignment-deliver'),
    path('assignments/<uuid:pk>/', AssignmentDetailView.as_view(), name='assignment-detail'),
    path('assignments/<uuid:pk>/operation/', AssignmentOperationView.as_view(), name='assignment-operation'),
]
