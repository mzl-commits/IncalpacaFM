from django.urls import path

from .views import WorkOrderActionView, WorkOrderDetailView, WorkOrderListCreateView

urlpatterns = [
    path("work-orders/", WorkOrderListCreateView.as_view(), name="work-order-list-create"),
    path("work-orders/<uuid:pk>/", WorkOrderDetailView.as_view(), name="work-order-detail"),
    path("work-orders/<uuid:pk>/actions/", WorkOrderActionView.as_view(), name="work-order-action"),
]
