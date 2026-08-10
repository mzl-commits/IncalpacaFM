import type { ComponentType } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ModulePlaceholderPage } from "@/components/feedback/ModulePlaceholderPage";
import { ProtectedRoute } from "@/modules/accounts/ProtectedRoute";
import { RoleRoute } from "@/modules/accounts/RoleRoute";
import { TaxonomyCatalogPage } from "@/modules/taxonomy/pages/TaxonomyCatalogPage";
import { TaxonomyFormPage } from "@/modules/taxonomy/pages/TaxonomyFormPage";
import { FmCodeCatalogPage } from "@/modules/taxonomy/pages/FmCodeCatalogPage";
import { FmCodeAssignPage } from "@/modules/taxonomy/pages/FmCodeAssignPage";
import { FacilityMapPage } from "@/modules/taxonomy/pages/FacilityMapPage";
import { LocationMapAdminPage } from "@/modules/assets/pages/LocationMapAdminPage";
import { DocumentRegistryPage } from "@/modules/documents/pages/DocumentRegistryPage";
import { AuditLogPage } from "@/modules/audit/pages/AuditLogPage";
import { TechnicianManagementPage } from "@/modules/accounts/pages/TechnicianManagementPage";
import { ReporterRegistryPage } from "@/modules/accounts/pages/ReporterRegistryPage";
import { TechnicianDetailPage } from "@/modules/accounts/pages/TechnicianDetailPage";
import { TechnicianSchedulePage } from "@/modules/workorders/pages/TechnicianSchedulePage";
import { LegacyLifecycleRedirect } from "@/app/LegacyLifecycleRedirect";
import { SupervisorWorkOrderReviewPage } from "@/modules/workorders/pages/SupervisorWorkOrderReviewPage";

function lazyRoute<TModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return async () => {
    const module = await loader();
    return { Component: module[exportName] as ComponentType };
  };
}

function supervisorWorkOrderReviewRoute() {
  return <SupervisorWorkOrderReviewPage />;
}

function administratorLazyRoute<TModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return async () => {
    const module = await loader();
    const Component = module[exportName] as ComponentType;
    return {
      Component: () => (
        <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
          <Component />
        </RoleRoute>
      ),
    };
  };
}

const modules = [["mantenimiento", "Mantenimiento"]] as const;

export const router = createBrowserRouter([
  {
    path: "/q/:token",
    lazy: lazyRoute(() => import("@/modules/assets/pages/PublicAssetPage"), "PublicAssetPage"),
  },
  {
    path: "/solicitud-trabajo",
    lazy: lazyRoute(
      () => import("@/modules/incidents/pages/PublicWorkRequestPage"),
      "PublicWorkRequestPage",
    ),
  },
  {
    path: "/reportar/:token",
    element: <LegacyPublicReportRedirect />,
  },
  {
    path: "/seguimiento-solicitud",
    lazy: lazyRoute(
      () => import("@/modules/incidents/pages/RequestTrackingPage"),
      "RequestTrackingPage",
    ),
  },
  {
    path: "/seguimiento-solicitud/:code",
    lazy: lazyRoute(
      () => import("@/modules/incidents/pages/RequestTrackingPage"),
      "RequestTrackingPage",
    ),
  },
  {
    path: "/login",
    lazy: lazyRoute(() => import("@/modules/accounts/pages/LoginPage"), "LoginPage"),
  },
  {
    path: "/privacidad",
    lazy: lazyRoute(() => import("@/modules/privacy/pages/PrivacyPage"), "PrivacyPage"),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        lazy: lazyRoute(() => import("@/modules/dashboard/pages/DashboardPage"), "DashboardPage"),
      },
      {
        path: "mi-jornada",
        element: (
          <RoleRoute allowedRoles={["TECNICO"]}>
            <TechnicianSchedulePage />
          </RoleRoute>
        ),
      },
      {
        path: "bienes",
        lazy: administratorLazyRoute(
          () => import("@/modules/assets/pages/AssetInventoryPage"),
          "AssetInventoryPage",
        ),
      },
      {
        path: "bienes/entradas",
        lazy: administratorLazyRoute(
          () => import("@/modules/assets/pages/AssetEntryListPage"),
          "AssetEntryListPage",
        ),
      },
      {
        path: "bienes/entradas/nueva",
        lazy: administratorLazyRoute(
          () => import("@/modules/assets/pages/AssetEntryWizardPage"),
          "AssetEntryWizardPage",
        ),
      },
      {
        path: "bienes/qr",
        lazy: administratorLazyRoute(
          () => import("@/modules/assets/pages/AssetQrInventoryPage"),
          "AssetQrInventoryPage",
        ),
      },
      {
        path: "mapa",
        lazy: administratorLazyRoute(
          () => import("@/modules/assets/pages/AssetMapOverviewPage"),
          "AssetMapOverviewPage",
        ),
      },
      {
        path: "bienes/:id",
        lazy: lazyRoute(() => import("@/modules/assets/pages/AssetDetailPage"), "AssetDetailPage"),
      },
      {
        path: "asignaciones",
        lazy: lazyRoute(
          () => import("@/modules/assignments/pages/AssignmentListPage"),
          "AssignmentListPage",
        ),
      },
      {
        path: "asignaciones/nueva",
        lazy: lazyRoute(
          () => import("@/modules/assignments/pages/AssignmentWizardPage"),
          "AssignmentWizardPage",
        ),
      },
      {
        path: "asignaciones/:id",
        lazy: lazyRoute(
          () => import("@/modules/assignments/pages/AssignmentDetailPage"),
          "AssignmentDetailPage",
        ),
      },
      {
        path: "incidencias",
        lazy: lazyRoute(
          () => import("@/modules/incidents/pages/IncidentListPage"),
          "IncidentListPage",
        ),
      },
      {
        path: "incidencias/nueva",
        lazy: lazyRoute(
          () => import("@/modules/incidents/pages/IncidentCreatePage"),
          "IncidentCreatePage",
        ),
      },
      {
        path: "incidencias/:id",
        lazy: lazyRoute(
          () => import("@/modules/incidents/pages/IncidentDetailPage"),
          "IncidentDetailPage",
        ),
      },
      {
        path: "incidencias/:id/seguimiento",
        lazy: lazyRoute(
          () => import("@/modules/incidents/pages/RequestTrackingPage"),
          "RequestTrackingPage",
        ),
      },
      {
        path: "supervision",
        element: (
          <RoleRoute allowedRoles={["SUPERVISOR", "ADMINISTRADOR"]}>
            {supervisorWorkOrderReviewRoute()}
          </RoleRoute>
        ),
      },
      {
        path: "ordenes-trabajo",
        lazy: lazyRoute(
          () => import("@/modules/workorders/pages/WorkOrderListPage"),
          "WorkOrderListPage",
        ),
      },
      {
        path: "ordenes-trabajo/nueva",
        lazy: administratorLazyRoute(
          () => import("@/modules/workorders/pages/WorkOrderTypeSelectorPage"),
          "WorkOrderTypeSelectorPage",
        ),
      },
      {
        path: "ordenes-trabajo/nueva/ot",
        lazy: administratorLazyRoute(
          () => import("@/modules/workorders/pages/DirectWorkOrderCreatePage"),
          "DirectWorkOrderCreatePage",
        ),
      },
      {
        path: "ordenes-trabajo/nueva/ol",
        lazy: administratorLazyRoute(
          () => import("@/modules/workorders/pages/DirectWorkOrderCreatePage"),
          "DirectWorkOrderCreatePage",
        ),
      },
      {
        path: "ordenes-trabajo/nueva/ol-rutinaria",
        lazy: administratorLazyRoute(
          () => import("@/modules/workorders/pages/RoutineCleaningOrderCreatePage"),
          "RoutineCleaningOrderCreatePage",
        ),
      },
      {
        path: "ordenes-trabajo/nueva/:requestId",
        lazy: lazyRoute(
          () => import("@/modules/workorders/pages/WorkOrderCreatePage"),
          "WorkOrderCreatePage",
        ),
      },
      {
        path: "ordenes-trabajo/:id",
        lazy: lazyRoute(
          () => import("@/modules/workorders/pages/WorkOrderDetailPage"),
          "WorkOrderDetailPage",
        ),
      },
      {
        path: "ordenes-trabajo/:id/ejecutar",
        lazy: lazyRoute(
          () => import("@/modules/workorders/pages/WorkOrderExecutionPage"),
          "WorkOrderExecutionPage",
        ),
      },
      {
        path: "ordenes-trabajo/:id/diagnostico",
        lazy: lazyRoute(
          () => import("@/modules/lifecycle/pages/TechnicalDiagnosisPage"),
          "TechnicalDiagnosisPage",
        ),
      },
      { path: "bienes/mapa", element: <Navigate to="/mapa" replace /> },
      {
        path: "bienes/ciclo-vida",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <Navigate to="/bienes/ciclo-vida/bajas" replace />
          </RoleRoute>
        ),
      },
      { path: "bienes/escanear", lazy: lazyRoute(() => import("@/modules/assets/pages/AssetScannerPage"), "AssetScannerPage") },
      {
        path: "ordenes-trabajo/recomendaciones",
        lazy: administratorLazyRoute(
          () => import("@/modules/workorders/pages/AssignmentRecommendationsPage"),
          "AssignmentRecommendationsPage",
        ),
      },
      {
        path: "bienes/ciclo-vida/bajas",
        lazy: administratorLazyRoute(
          () => import("@/modules/lifecycle/pages/RetirementRequestListPage"),
          "RetirementRequestListPage",
        ),
      },
      {
        path: "bienes/ciclo-vida/bajas/nueva/:diagnosisId",
        lazy: administratorLazyRoute(
          () => import("@/modules/lifecycle/pages/RetirementRequestCreatePage"),
          "RetirementRequestCreatePage",
        ),
      },
      {
        path: "bienes/ciclo-vida/bajas/:id",
        lazy: administratorLazyRoute(
          () => import("@/modules/lifecycle/pages/RetirementRequestDetailPage"),
          "RetirementRequestDetailPage",
        ),
      },
      {
        path: "bienes/ciclo-vida/bajas/:id/disposicion",
        lazy: administratorLazyRoute(
          () => import("@/modules/lifecycle/pages/FinalDispositionPage"),
          "FinalDispositionPage",
        ),
      },
      {
        path: "informes",
        lazy: administratorLazyRoute(() => import("@/modules/reports/pages/ReportsPage"), "ReportsPage"),
      },
      {
        path: "informes/ordenes-trabajo",
        lazy: administratorLazyRoute(() => import("@/modules/reports/pages/WorkOrderReportsPage"), "WorkOrderReportsPage"),
      },
      { path: "informes/plantillas", lazy: administratorLazyRoute(() => import("@/modules/reports/pages/ReportTemplatesPage"), "ReportTemplatesPage") },

      {
        path: "notificaciones",
        lazy: lazyRoute(
          () => import("@/modules/notifications/pages/NotificationsPage"),
          "NotificationsPage",
        ),
      },
      {
        path: "documentos",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <DocumentRegistryPage />
          </RoleRoute>
        ),
      },
      {
        path: "auditoria",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <AuditLogPage />
          </RoleRoute>
        ),
      },
      { path: "ciclo-vida/*", element: <LegacyLifecycleRedirect /> },
      { path: "administracion", element: <Navigate to="/administracion/taxonomia" replace /> },
      {
        path: "administracion/taxonomia",
        lazy: administratorLazyRoute(
          () => import("@/modules/taxonomy/pages/TaxonomyCatalogPage"),
          "TaxonomyCatalogPage",
        ),
      },
      {
        path: "administracion/modelos",
        lazy: administratorLazyRoute(
          () => import("@/modules/taxonomy/pages/ModelCatalogPage"),
          "ModelCatalogPage",
        ),
      },
      {
        path: "administracion/tecnicos",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <TechnicianManagementPage />
          </RoleRoute>
        ),
      },
      {
        path: "administracion/reportantes",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <ReporterRegistryPage />
          </RoleRoute>
        ),
      },
      {
        path: "administracion/tecnicos/:id",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <TechnicianDetailPage />
          </RoleRoute>
        ),
      },
      {
        path: "mi-perfil",
        lazy: lazyRoute(() => import("@/modules/accounts/pages/UserDashboardPage"), "default"),
      },
      {
        path: "usuarios/:id",
        lazy: lazyRoute(() => import("@/modules/accounts/pages/UserBetaProfilePage"), "UserBetaProfilePage"),
      },
      {
        path: "administracion/taxonomia/nueva",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <TaxonomyFormPage />
          </RoleRoute>
        ),
      },
      {
        path: "administracion/taxonomia/codigos",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <FmCodeCatalogPage />
          </RoleRoute>
        ),
      },
      {
        path: "administracion/taxonomia/codigos/nuevo",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <FmCodeAssignPage />
          </RoleRoute>
        ),
      },
      {
        path: "administracion/taxonomia/mapa",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <FacilityMapPage />
          </RoleRoute>
        ),
      },
      {
        path: "administracion/mapas-ambientes",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <LocationMapAdminPage />
          </RoleRoute>
        ),
      },
      {
        path: "administracion/taxonomia/:id/editar",
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <TaxonomyFormPage />
          </RoleRoute>
        ),
      },
      // ── Almacén ──────────────────────────────────────────────────────────
      { path: "almacen", element: <Navigate to="/almacen/catalogo" replace /> },
      {
        path: "almacen/catalogo",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/CatalogoPage"),
          "CatalogoPage",
        ),
      },
      {
        path: "almacen/catalogo/nuevo",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/MaterialFormPage"),
          "MaterialFormPage",
        ),
      },
      {
        path: "almacen/catalogo/:id",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/MaterialDetailPage"),
          "MaterialDetailPage",
        ),
      },
      {
        path: "almacen/catalogo/:id/editar",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/MaterialFormPage"),
          "MaterialFormPage",
        ),
      },
      {
        path: "almacen/catalogo/:id/alta-piezas",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/AltaPiezasPage"),
          "AltaPiezasPage",
        ),
      },
      {
        path: "almacen/movimientos",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/MovimientosPage"),
          "MovimientosPage",
        ),
      },
      {
        path: "almacen/movimientos/nuevo",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/MovimientoFormPage"),
          "MovimientoFormPage",
        ),
      },
      {
        path: "almacen/checklist",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/ChecklistPage"),
          "ChecklistPage",
        ),
      },
      {
        path: "almacen/inspecciones",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/InspeccionesPage"),
          "InspeccionesPage",
        ),
      },
      {
        path: "almacen/inspecciones/nueva",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/InspeccionFormPage"),
          "InspeccionFormPage",
        ),
      },
      {
        path: "almacen/inspecciones/vencidas",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/InspeccionVencidasPage"),
          "InspeccionVencidasPage",
        ),
      },
      {
        path: "almacen/inspecciones/:id",
        lazy: lazyRoute(
          () => import("@/modules/almacen/pages/InspeccionDetailPage"),
          "InspeccionDetailPage",
        ),
      },
      // ─────────────────────────────────────────────────────────────────────
      ...modules.map(([path, title]) => ({
        path,
        element: <ModulePlaceholderPage title={title} />,
      })),
    ],
  },
]);

function LegacyPublicReportRedirect() {
  const token = window.location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  return <Navigate to={`/solicitud-trabajo?asset=${encodeURIComponent(token)}`} replace />;
}
