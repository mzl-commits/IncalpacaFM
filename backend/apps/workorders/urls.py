from django.urls import path

from .views import (
    ReportTemplateDetailView,
    ReportTemplateListCreateView,
    WorkOrderActionView,
    WorkOrderCostAutocompletarView,
    WorkOrderCostDetailView,
    WorkOrderCostListCreateView,
    WorkOrderDetailView,
    WorkOrderListCreateView,
    WorkOrderMaterialDetailView,
    WorkOrderMaterialListCreateView,
    WorkOrderMaterialMarkBlockingView,
    WorkOrderMaterialMarkAcquiredView,
    WorkOrderPhotoView,
    WorkOrderQuickAssignView,
    WorkOrderReportDownloadView,
    WorkOrderReportView,
)

urlpatterns = [
    path("work-orders/", WorkOrderListCreateView.as_view(), name="work-order-list-create"),
    path("work-orders/<uuid:pk>/", WorkOrderDetailView.as_view(), name="work-order-detail"),
    path("work-orders/<uuid:pk>/quick-assign/", WorkOrderQuickAssignView.as_view(), name="work-order-quick-assign"),
    path("work-orders/<uuid:pk>/actions/", WorkOrderActionView.as_view(), name="work-order-action"),
    path("work-orders/<uuid:pk>/photos/<str:stage>/", WorkOrderPhotoView.as_view(), name="work-order-photo"),
    path("work-orders/<uuid:pk>/costs/", WorkOrderCostListCreateView.as_view(), name="work-order-costs"),
    path("work-orders/<uuid:pk>/costs/autocompletar-materiales/", WorkOrderCostAutocompletarView.as_view(), name="work-order-costs-autocompletar"),
    path("work-orders/<uuid:pk>/costs/<uuid:cost_id>/", WorkOrderCostDetailView.as_view(), name="work-order-cost-detail"),
    path("work-orders/<uuid:pk>/materiales/", WorkOrderMaterialListCreateView.as_view(), name="work-order-materiales"),
    path("work-orders/<uuid:pk>/materiales/<uuid:material_id>/", WorkOrderMaterialDetailView.as_view(), name="work-order-material-detail"),
    path("work-orders/<uuid:pk>/materiales/<uuid:material_id>/marcar-bloqueante/", WorkOrderMaterialMarkBlockingView.as_view(), name="work-order-material-bloqueante"),
    path("work-orders/<uuid:pk>/materiales/<uuid:material_id>/marcar-adquirido/", WorkOrderMaterialMarkAcquiredView.as_view(), name="work-order-material-adquirido"),
    path("work-orders/<uuid:pk>/reports/", WorkOrderReportView.as_view(), name="work-order-reports"),
    path("work-orders/<uuid:pk>/reports/<uuid:report_id>/", WorkOrderReportDownloadView.as_view(), name="work-order-report-download"),
    path("report-templates/", ReportTemplateListCreateView.as_view(), name="report-template-list"),
    path("report-templates/<uuid:pk>/", ReportTemplateDetailView.as_view(), name="report-template-detail"),
]
