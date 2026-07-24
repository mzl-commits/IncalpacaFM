import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AssetEntryListPage } from "@/modules/assets/pages/AssetEntryListPage";
import { AssetEntryWizardPage } from "@/modules/assets/pages/AssetEntryWizardPage";
import { PublicAssetPage } from "@/modules/assets/pages/PublicAssetPage";
import { ModulePlaceholderPage } from "@/components/feedback/ModulePlaceholderPage";
import { IncidentListPage } from "@/modules/incidents/pages/IncidentListPage";
import { IncidentCreatePage } from "@/modules/incidents/pages/IncidentCreatePage";
import { IncidentDetailPage } from "@/modules/incidents/pages/IncidentDetailPage";
import { WorkOrderCreatePage } from "@/modules/workorders/pages/WorkOrderCreatePage";
import { WorkOrderListPage } from "@/modules/workorders/pages/WorkOrderListPage";


const modules = [
  ["asignaciones", "Asignaciones"],
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

      { path: "incidencias", element: <IncidentListPage /> },
      { path: "incidencias/nueva", element: <IncidentCreatePage /> },
      { path: "incidencias/:id", element: <IncidentDetailPage /> },

      { path: "ordenes-trabajo", element: <WorkOrderListPage /> },
      { path: "ordenes-trabajo/nueva/:requestId", element: <WorkOrderCreatePage /> },

      ...modules.map(([path, title]) => ({
        path,
        element: <ModulePlaceholderPage title={title} />,
      })),
    ],
  },
]);
