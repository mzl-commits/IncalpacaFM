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
import { LegacyLifecycleRedirect } from "@/app/LegacyLifecycleRedirect";

function lazyRoute<TModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return async () => {
    const module = await loader();
    return { Component: module[exportName] as ComponentType };
  };
}

const modules = [
  ["mantenimiento", "Mantenimiento"],
  ["notificaciones", "Notificaciones"],
] as const;

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
  },  {
    path: "/login",
    lazy: lazyRoute(() => import("@/modules/accounts/pages/LoginPage"), "LoginPage"),
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
        path: "bienes",
        lazy: lazyRoute(
          () => import("@/modules/assets/pages/AssetInventoryPage"),
          "AssetInventoryPage",
        ),
      },
      {
        path: "bienes/entradas",
        lazy: lazyRoute(
          () => import("@/modules/assets/pages/AssetEntryListPage"),
          "AssetEntryListPage",
        ),
      },
      {
        path: "bienes/entradas/nueva",
        lazy: lazyRoute(
          () => import("@/modules/assets/pages/AssetEntryWizardPage"),
          "AssetEntryWizardPage",
        ),
      },
      {
        path: "bienes/qr",
        lazy: lazyRoute(
          () => import("@/modules/assets/pages/AssetQrInventoryPage"),
          "AssetQrInventoryPage",
        ),
      },
      {
        path: "mapa",
        lazy: lazyRoute(
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
        path: "ordenes-trabajo",
        lazy: lazyRoute(
          () => import("@/modules/workorders/pages/WorkOrderListPage"),
          "WorkOrderListPage",
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
      { path: "bienes/ciclo-vida", element: <Navigate to="/bienes/ciclo-vida/bajas" replace /> },
      {
        path: "bienes/ciclo-vida/bajas",
        lazy: lazyRoute(
          () => import("@/modules/lifecycle/pages/RetirementRequestListPage"),
          "RetirementRequestListPage",
        ),
      },
      {
        path: "bienes/ciclo-vida/bajas/nueva/:diagnosisId",
        lazy: lazyRoute(
          () => import("@/modules/lifecycle/pages/RetirementRequestCreatePage"),
          "RetirementRequestCreatePage",
        ),
      },
      {
        path: "bienes/ciclo-vida/bajas/:id",
        lazy: lazyRoute(
          () => import("@/modules/lifecycle/pages/RetirementRequestDetailPage"),
          "RetirementRequestDetailPage",
        ),
      },
      {
        path: "bienes/ciclo-vida/bajas/:id/disposicion",
        lazy: lazyRoute(
          () => import("@/modules/lifecycle/pages/FinalDispositionPage"),
          "FinalDispositionPage",
        ),
      },
      {
        path: "informes",
        lazy: lazyRoute(() => import("@/modules/reports/pages/ReportsPage"), "ReportsPage"),
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
        element: (
          <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
            <TaxonomyCatalogPage />
          </RoleRoute>
        ),
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
      ...modules.map(([path, title]) => ({
        path,
        element: <ModulePlaceholderPage title={title} />,
      })),
    ],
  },
]);
