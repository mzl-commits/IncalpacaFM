from django.urls import path

from .views import ReportTemplateDetailView, ReportTemplateListCreateView, WorkOrderActionView, WorkOrderCostListCreateView, WorkOrderDetailView, WorkOrderListCreateView, WorkOrderPhotoView, WorkOrderReportDownloadView, WorkOrderReportView

urlpatterns = [
    path("work-orders/", WorkOrderListCreateView.as_view(), name="work-order-list-create"),
    path("work-orders/<uuid:pk>/", WorkOrderDetailView.as_view(), name="work-order-detail"),
    path("work-orders/<uuid:pk>/actions/", WorkOrderActionView.as_view(), name="work-order-action"),
    path("work-orders/<uuid:pk>/photos/<str:stage>/", WorkOrderPhotoView.as_view(), name="work-order-photo"),
    path("work-orders/<uuid:pk>/costs/", WorkOrderCostListCreateView.as_view(), name="work-order-costs"),
    path("work-orders/<uuid:pk>/reports/", WorkOrderReportView.as_view(), name="work-order-reports"),
    path("work-orders/<uuid:pk>/reports/<uuid:report_id>/", WorkOrderReportDownloadView.as_view(), name="work-order-report-download"),
    path("report-templates/", ReportTemplateListCreateView.as_view(), name="report-template-list"),
    path("report-templates/<uuid:pk>/", ReportTemplateDetailView.as_view(), name="report-template-detail"),
]
