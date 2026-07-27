import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AssetEntryListPage } from "@/modules/assets/pages/AssetEntryListPage";
import { AssetEntryWizardPage } from "@/modules/assets/pages/AssetEntryWizardPage";
import { AssetQrInventoryPage } from "@/modules/assets/pages/AssetQrInventoryPage";
import { AssetDetailPage } from "@/modules/assets/pages/AssetDetailPage";
import { PublicAssetPage } from "@/modules/assets/pages/PublicAssetPage";
import { ModulePlaceholderPage } from "@/components/feedback/ModulePlaceholderPage";
import { AssignmentListPage } from "@/modules/assignments/pages/AssignmentListPage";
import { AssignmentWizardPage } from "@/modules/assignments/pages/AssignmentWizardPage";
import { AssignmentDetailPage } from "@/modules/assignments/pages/AssignmentDetailPage";
import { IncidentListPage } from "@/modules/incidents/pages/IncidentListPage";
import { IncidentCreatePage } from "@/modules/incidents/pages/IncidentCreatePage";
import { IncidentDetailPage } from "@/modules/incidents/pages/IncidentDetailPage";
import { WorkOrderCreatePage } from "@/modules/workorders/pages/WorkOrderCreatePage";
import { WorkOrderListPage } from "@/modules/workorders/pages/WorkOrderListPage";
import { WorkOrderDetailPage } from "@/modules/workorders/pages/WorkOrderDetailPage";
import { WorkOrderExecutionPage } from "@/modules/workorders/pages/WorkOrderExecutionPage";

const modules = [
  ["mantenimiento", "Mantenimiento"],
  ["ciclo-vida", "Ciclo de vida"],
  ["documentos", "Documentos"],
  ["notificaciones", "Notificaciones"],
  ["auditoria", "Auditoría"],
] as const;

export const router = createBrowserRouter([
  { path: "/q/:token", element: <PublicAssetPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/bienes/entradas" replace /> },
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
      { path: "ordenes-trabajo", element: <WorkOrderListPage /> },
      { path: "ordenes-trabajo/nueva/:requestId", element: <WorkOrderCreatePage /> },
      { path: "ordenes-trabajo/:id", element: <WorkOrderDetailPage /> },
      { path: "ordenes-trabajo/:id/ejecutar", element: <WorkOrderExecutionPage /> },
      ...modules.map(([path, title]) => ({
        path,
        element: <ModulePlaceholderPage title={title} />,
      })),
    ],
  },
]);

