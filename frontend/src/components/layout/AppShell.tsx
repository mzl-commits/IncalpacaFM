import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { listWorkRequests, WORK_REQUESTS_UPDATED_EVENT } from "@/modules/incidents/incidentRepository";
import { listWorkOrders, WORK_ORDERS_UPDATED_EVENT } from "@/modules/workorders/workOrderRepository";

import { Topbar } from "@/components/layout/Topbar";
import { RouteBreadcrumbs } from "@/components/navigation/RouteBreadcrumbs";
import { AdminSidebar } from "@/components/navigation/AdminSidebar";
import { TechnicianSidebar } from "@/components/navigation/TechnicianSidebar";
import { SupervisorSidebar } from "@/components/navigation/SupervisorSidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { QuickActionsDialog, useQuickActionsDialog } from "@/components/navigation/QuickActionsDialog";

import {
  modules,
  quickActions,
  getRouteContext,
  getInitials,
  getRoleLabel,
  isGroupActive,
  itemsForRole,
  countMenuActions,
  type MenuCounts,
} from "@/components/navigation/navData";

/**
 * AppShell
 * Orquestador principal de la aplicación.
 * Calcula el estado global (usuario, contadores, ruta) y delega
 * el renderizado a sub-componentes especializados.
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const quickMenu = useQuickActionsDialog();

  // ── Contadores de insignia en el menú ─────────────────────────────────────
  const [liveCounts, setLiveCounts] = useState<MenuCounts>({});

  useEffect(() => {
    let active = true;
    const refreshCounts = async () => {
      const [requestsResult, ordersResult] = await Promise.allSettled([
        listWorkRequests(),
        listWorkOrders(),
      ]);
      if (!active || !user) return;
      if (requestsResult.status !== "fulfilled" || ordersResult.status !== "fulfilled") return;
      setLiveCounts(countMenuActions(user, requestsResult.value, ordersResult.value));
    };
    void refreshCounts();
    window.addEventListener(WORK_REQUESTS_UPDATED_EVENT, refreshCounts);
    window.addEventListener(WORK_ORDERS_UPDATED_EVENT, refreshCounts);
    return () => {
      active = false;
      window.removeEventListener(WORK_REQUESTS_UPDATED_EVENT, refreshCounts);
      window.removeEventListener(WORK_ORDERS_UPDATED_EVENT, refreshCounts);
    };
  }, [user]);

  // ── Módulos y navegación filtrados por rol ────────────────────────────────
  const roleModules = modules
    .filter((mod) => !mod.roles || Boolean(user && mod.roles.includes(user.role)))
    .map((mod) => ({
      ...mod,
      items: itemsForRole(mod.items, user).map((item) => ({
        ...item,
        count: liveCounts[item.to],
      })),
    }))
    .filter((mod) => mod.items.length > 0);

  const configModule = roleModules.find((mod) => mod.id === "administration");
  const matchedModuleId =
    roleModules.find((mod) => isGroupActive(location.pathname, mod.paths))?.id ?? "dashboard";
  const roleQuickActions = user?.role === "ADMINISTRADOR" ? quickActions : [];

  // ── Contexto de ruta y datos de usuario ───────────────────────────────────
  const [baseSection, baseTitle] = getRouteContext(location.pathname);
  const [routeSection, routeTitle] =
    user?.role === "USUARIO" && location.pathname.startsWith("/incidencias/nueva")
      ? ["Solicitudes", "Nueva solicitud"]
      : user?.role === "USUARIO" && location.pathname.startsWith("/incidencias")
        ? ["Solicitudes", "Mis solicitudes"]
        : user?.role === "USUARIO"
          ? ["Solicitante", "Inicio"]
          : [baseSection, baseTitle];

  const initials = getInitials(user?.fullName);
  const roleLabel = getRoleLabel(user?.role);

  // ── Sidebar según rol ─────────────────────────────────────────────────────
  const isTechnicianLayout = user?.role === "TECNICO" || user?.role === "USUARIO";
  const isSupervisorLayout = user?.role === "SUPERVISOR";

  const techNavigation = roleModules.find((mod) => mod.id === "work_orders")?.items ?? [];
  const supervisorNavigation = roleModules.flatMap((mod) => mod.items);

  const contentClass = [
    "content-frame-overlay",
    isTechnicianLayout ? "is-technician" : "",
    isSupervisorLayout ? "is-supervisor-rail" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app-frame-overlay">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {isTechnicianLayout && user ? (
        <TechnicianSidebar
          navigation={techNavigation}
          initials={initials}
          user={user}
          onLogout={logout}
        />
      ) : isSupervisorLayout ? (
        <SupervisorSidebar
          navigation={supervisorNavigation}
          initials={initials}
          onLogout={logout}
        />
      ) : user ? (
        <AdminSidebar
          roleModules={roleModules}
          configModule={configModule}
          matchedModuleId={matchedModuleId}
          initials={initials}
          roleLabel={roleLabel}
          user={user}
          onLogout={logout}
        />
      ) : null}

      {/* ── Mobile navigation ───────────────────────────────────────────── */}
      <MobileNav roleModules={roleModules} user={user} />

      {/* ── Quick actions dialog ────────────────────────────────────────── */}
      <QuickActionsDialog
        actions={roleQuickActions}
        dialogRef={quickMenu.dialogRef}
        onClose={quickMenu.handleClose}
      />

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className={contentClass}>
        <Topbar
          routeSection={routeSection}
          routeTitle={routeTitle}
          initials={initials}
          fullName={user?.fullName}
          roleLabel={roleLabel}
          hasQuickActions={roleQuickActions.length > 0}
          onOpenQuickMenu={quickMenu.open}
        />

        <main className="main-content">
          <RouteBreadcrumbs />
          <div className="route-stage" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
