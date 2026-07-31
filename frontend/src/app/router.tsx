import { Navigate, createBrowserRouter } from "react-router-dom";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { AppShell } from "@/components/layout/AppShell";
import { AssetEntryListPage } from "@/modules/assets/pages/AssetEntryListPage";
import { AssetEntryWizardPage } from "@/modules/assets/pages/AssetEntryWizardPage";
import { AssetQrInventoryPage } from "@/modules/assets/pages/AssetQrInventoryPage";
import { AssetDetailPage } from "@/modules/assets/pages/AssetDetailPage";
import { AssetInventoryPage } from "@/modules/assets/pages/AssetInventoryPage";
import { PublicAssetPage } from "@/modules/assets/pages/PublicAssetPage";
import { ModulePlaceholderPage } from "@/components/feedback/ModulePlaceholderPage";
import { AssignmentListPage } from "@/modules/assignments/pages/AssignmentListPage";
import { AssignmentWizardPage } from "@/modules/assignments/pages/AssignmentWizardPage";
import { AssignmentDetailPage } from "@/modules/assignments/pages/AssignmentDetailPage";
import { IncidentListPage } from "@/modules/incidents/pages/IncidentListPage";
import { IncidentCreatePage } from "@/modules/incidents/pages/IncidentCreatePage";
import { IncidentDetailPage } from "@/modules/incidents/pages/IncidentDetailPage";
import { PublicWorkRequestPage } from "@/modules/incidents/pages/PublicWorkRequestPage";
import { WorkOrderCreatePage } from "@/modules/workorders/pages/WorkOrderCreatePage";
import { WorkOrderListPage } from "@/modules/workorders/pages/WorkOrderListPage";
import { WorkOrderDetailPage } from "@/modules/workorders/pages/WorkOrderDetailPage";
import { WorkOrderExecutionPage } from "@/modules/workorders/pages/WorkOrderExecutionPage";
import { TechnicalDiagnosisPage } from "@/modules/lifecycle/pages/TechnicalDiagnosisPage";
import { RetirementRequestCreatePage } from "@/modules/lifecycle/pages/RetirementRequestCreatePage";
import { RetirementRequestListPage } from "@/modules/lifecycle/pages/RetirementRequestListPage";
import { RetirementRequestDetailPage } from "@/modules/lifecycle/pages/RetirementRequestDetailPage";
import { FinalDispositionPage } from "@/modules/lifecycle/pages/FinalDispositionPage";
import { ReportsPage } from "@/modules/reports/pages/ReportsPage";
import { LoginPage } from "@/modules/accounts/pages/LoginPage";
import { ProtectedRoute } from "@/modules/accounts/ProtectedRoute";
import { RequestTrackingPage } from "@/modules/incidents/pages/RequestTrackingPage";

const modules = [
  ["mantenimiento", "Mantenimiento"],
  ["documentos", "Documentos"],
  ["notificaciones", "Notificaciones"],
  ["auditoria", "Auditoría"],
] as const;

export const router = createBrowserRouter([
  { path: "/q/:token", element: <PublicAssetPage /> },
  { path: "/solicitud-trabajo", element: <PublicWorkRequestPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "bienes", element: <AssetInventoryPage /> },
      { path: "bienes/entradas", element: <AssetEntryListPage /> },
      { path: "bienes/entradas/nueva", element: <AssetEntryWizardPage /> },
      { path: "bienes/qr", element: <AssetQrInventoryPage /> },
      { path: "bienes/:id", element: <AssetDetailPage /> },
      { path: "asignaciones", element: <AssignmentListPage /> },
      { path: "asignaciones/nueva", element: <AssignmentWizardPage /> },
      { path: "asignaciones/:id", element: <AssignmentDetailPage /> },
      { path: "incidencias", element: <IncidentListPage /> },
      { path: "incidencias/nueva", element: <IncidentCreatePage /> },
      { path: "incidencias/:id", element: <IncidentDetailPage /> },
      { path: "incidencias/:id/seguimiento", element:<RequestTrackingPage /> },
      { path: "ordenes-trabajo", element: <WorkOrderListPage /> },
      { path: "ordenes-trabajo/nueva/:requestId", element: <WorkOrderCreatePage /> },
      { path: "ordenes-trabajo/:id", element: <WorkOrderDetailPage /> },
      { path: "ordenes-trabajo/:id/ejecutar", element: <WorkOrderExecutionPage /> },
      { path: "ordenes-trabajo/:id/diagnostico", element: <TechnicalDiagnosisPage /> },
      { path: "ciclo-vida", element: <Navigate to="/ciclo-vida/bajas" replace /> },
      { path: "ciclo-vida/bajas", element: <RetirementRequestListPage /> },
      { path: "ciclo-vida/bajas/nueva/:diagnosisId", element: <RetirementRequestCreatePage /> },
      { path: "ciclo-vida/bajas/:id", element: <RetirementRequestDetailPage /> },
      { path: "ciclo-vida/bajas/:id/disposicion", element: <FinalDispositionPage /> },
      { path: "informes", element: <ReportsPage /> },
      ...modules.map(([path, title]) => ({
        path,
        element: <ModulePlaceholderPage title={title} />,
      })),
    ],
  },
]);
