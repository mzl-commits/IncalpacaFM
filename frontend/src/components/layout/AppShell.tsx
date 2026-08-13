import {
  ArrowRight,
  Barcode,
  CalendarBlank,
  CalendarPlus,
  CaretDown,
  ChartBar,
  ChartLineUp,
  ClipboardText,
  DotsThree,
  Files,
  GearSix,
  House,
  Lightning,
  ListChecks,
  ListDashes,
  MapTrifold,
  Package,
  Plus,
  ShieldCheck,
  SignOut,
  SquaresFour,
  TreeStructure,
  Tag,
  Toolbox,
  UserCircle,
  UserPlus,
  UsersThree,
  WarningDiamond,
  Wrench,
  X,
} from "@phosphor-icons/react";

import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/accounts/AuthContext";
import type { SystemUser, UserRole } from "@/modules/accounts/types";
import { RouteBreadcrumbs } from "@/components/navigation/RouteBreadcrumbs";
import { NotificationCenter } from "@/modules/notifications/components/NotificationCenter";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { listWorkRequests, WORK_REQUESTS_UPDATED_EVENT } from "@/modules/incidents/incidentRepository";
import type { WorkRequest } from "@/modules/incidents/types";
import { listWorkOrders, WORK_ORDERS_UPDATED_EVENT } from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

type NavItem = {
  to: string;
  label: string;
  icon: typeof House;
  end?: boolean;
  count?: string | number;
  roles?: UserRole[];
};

type ModuleGroup = {
  id: string;
  label: string;
  shortLabel: string;
  icon: typeof House;
  paths: string[];
  roles?: UserRole[];
  items: NavItem[];
};

const modules: ModuleGroup[] = [
  {
    id: "dashboard",
    label: "Mantenimiento",
    shortLabel: "Mantenimiento",
    icon: Wrench,
    paths: ["/", "/incidencias", "/ordenes-trabajo", "/mi-jornada"],
    items: [
      { to: "/", label: "Panel de mantenimiento", icon: SquaresFour, end: true },
      { to: "/incidencias", label: "Bandeja de reportes", icon: ListChecks },
      { to: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Toolbox },
      { to: "/mi-jornada", label: "Mi jornada", icon: CalendarBlank, roles: ["TECNICO"] },
    ],
  },
  {
    id: "assets",
    label: "Activos y espacios",
    shortLabel: "Activos",
    icon: Package,
    paths: ["/bienes", "/asignaciones", "/mapa"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/bienes/entradas", label: "Entradas", icon: Package },
      { to: "/asignaciones", label: "Asignaciones", icon: ClipboardText },
      { to: "/bienes/qr", label: "Códigos QR", icon: Barcode },
      { to: "/mapa", label: "Mapa de activos", icon: MapTrifold },
      { to: "/bienes/ciclo-vida/bajas", label: "Ciclo de vida", icon: ShieldCheck },
      { to: "/bienes", label: "Inventario general", icon: ListDashes, end: true },
    ],
  },
  {
    id: "almacen",
    label: "Almacén",
    shortLabel: "Almacén",
    icon: Toolbox,
    paths: ["/almacen"],
    roles: ["ADMINISTRADOR", "ALMACENERO", "INSPECTOR"],
    items: [
      { to: "/almacen/catalogo", label: "Catálogo", icon: ListDashes, end: true },
      { to: "/almacen/movimientos", label: "Movimientos", icon: ArrowRight },
      { to: "/almacen/checklist", label: "Devolución", icon: ListChecks },
      { to: "/almacen/inspecciones", label: "Inspecciones", icon: ClipboardText },
      { to: "/almacen/plantillas", label: "Plantillas SST", icon: Files },
      { to: "/almacen/calendario", label: "Calendario", icon: CalendarBlank },
      { to: "/almacen/plan-anual", label: "Plan anual", icon: CalendarPlus },
    ],
  },
  {
    id: "team",
    label: "Equipo",
    shortLabel: "Equipo",
    icon: UsersThree,
    paths: ["/ordenes-trabajo", "/mi-jornada"],
    roles: ["ADMINISTRADOR", "SUPERVISOR"],
    items: [
      { to: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Toolbox },
      { to: "/mi-jornada", label: "Agenda semanal", icon: CalendarBlank },
    ],
  },
  {
    id: "qr",
    label: "Códigos QR",
    shortLabel: "QR",
    icon: Barcode,
    paths: ["/bienes/qr", "/administracion/taxonomia/codigos"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/bienes/qr", label: "Imprimir QR", icon: Barcode },
      { to: "/administracion/taxonomia/codigos", label: "Códigos FM", icon: Tag },
    ],
  },
  {
    id: "reports",
    label: "Reportes",
    shortLabel: "Reportes",
    icon: ChartBar,
    paths: ["/informes"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/informes", label: "Panel ejecutivo", icon: ChartBar, end: true },
      { to: "/informes/ordenes-trabajo", label: "Informes de OT", icon: Toolbox },
      { to: "/informes/plantillas", label: "Plantillas", icon: Files },
    ],
  },
  {
    id: "administration",
    label: "Configuración",
    shortLabel: "Configuración",
    icon: GearSix,
    paths: ["/administracion", "/documentos", "/auditoria"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/administracion/taxonomia", label: "Taxonomía", icon: TreeStructure },
      { to: "/administracion/taxonomia/codigos", label: "Códigos FM", icon: Barcode },
      { to: "/administracion/modelos", label: "Modelos de bienes", icon: Tag },
      { to: "/administracion/mapas-ambientes", label: "Mapas de ambientes", icon: MapTrifold },
      { to: "/administracion/tecnicos", label: "Técnicos y horarios", icon: UsersThree },
      { to: "/administracion/usuarios", label: "Usuarios", icon: UserCircle },
      { to: "/administracion/formularios", label: "Formularios de inspección", icon: ListChecks },
      { to: "/documentos", label: "Documentos", icon: Files },
      { to: "/auditoria", label: "Auditoría", icon: ShieldCheck },
    ],
  },
];

const mobilePrimary: NavItem[] = [
  { to: "/", label: "Inicio", icon: House, end: true },
  { to: "/bienes", label: "Bienes", icon: ListDashes, end: true },
  { to: "/mapa", label: "Mapa", icon: MapTrifold, end: true },
  { to: "/informes", label: "Informes", icon: ChartBar, end: true },
];

const quickActions: NavItem[] = [
  { to: "/bienes/entradas/nueva", label: "Registrar un bien", icon: Package },
  { to: "/asignaciones/nueva", label: "Crear una asignación", icon: UserPlus },
  { to: "/incidencias/nueva", label: "Reportar una incidencia", icon: WarningDiamond },
  { to: "/informes", label: "Abrir informes", icon: ChartLineUp },
];

type MenuCounts = Partial<Record<string, number>>;

function countMenuActions(user: SystemUser, requests: WorkRequest[], orders: WorkOrder[]): MenuCounts {
  const withBadge = (path: string, count: number): MenuCounts => count > 0 ? { [path]: count } : {};

  if (user.role === "ADMINISTRADOR") {
    const pendingRequests = requests.filter((request) => request.status === "PENDIENTE").length;
    const adminOrders = orders.filter((order) =>
      ["PENDIENTE_REPROGRAMACION", "PENDIENTE_DE_VALIDACION"].includes(order.status),
    ).length;
    return { ...withBadge("/incidencias", pendingRequests), ...withBadge("/ordenes-trabajo", adminOrders) };
  }

  if (user.role === "SUPERVISOR") {
    const reviewQueue = orders.filter(
      (order) => order.supervisorId === user.id && order.status === "PENDIENTE_DE_SUPERVISION",
    ).length;
    return withBadge("/ordenes-trabajo", reviewQueue);
  }

  if (user.role === "TECNICO") {
    const activeWork = orders.filter(
      (order) =>
        order.operatorId === user.id &&
        ["PROGRAMADA", "ASIGNADA", "EN_PROCESO", "DEVUELTA", "REPROCESO"].includes(order.status),
    ).length;
    return withBadge("/ordenes-trabajo", activeWork);
  }

  return {};
}

function getRouteContext(pathname: string) {
  if (pathname === "/") return ["Mantenimiento", "Panel operativo"];
  if (pathname.startsWith("/mi-jornada")) return ["Mi trabajo", "Agenda semanal"];
  if (pathname.startsWith("/bienes/qr")) return ["Bienes", "Códigos QR"];
  if (pathname.startsWith("/mapa")) return ["Activos y espacios", "Mapa de activos"];
  if (pathname.startsWith("/bienes/entradas")) return ["Activos y espacios", "Entradas"];
  if (pathname.startsWith("/bienes")) return ["Activos y espacios", "Inventario"];
  if (pathname.startsWith("/asignaciones")) return ["Activos y espacios", "Asignaciones"];
  if (pathname.startsWith("/incidencias")) return ["Mantenimiento", "Reportes"];
  if (pathname.startsWith("/supervision")) return ["Mantenimiento", "Órdenes de trabajo"];
  if (pathname.startsWith("/ordenes-trabajo")) return ["Mantenimiento", "Órdenes de trabajo"];
  if (pathname.startsWith("/bienes/ciclo-vida")) return ["Bienes", "Ciclo de vida"];
  if (pathname.startsWith("/informes")) return ["Inteligencia", "Informes"];
  if (pathname.startsWith("/administracion/taxonomia/codigos")) return ["Taxonomía", "Códigos FM"];
  if (pathname.startsWith("/administracion/tecnicos")) return ["Administración", "Técnicos"];
  if (pathname.startsWith("/administracion/usuarios")) return ["Administración", "Usuarios"];
  if (pathname.startsWith("/administracion/reportantes")) return ["Administración", "Reportantes"];
  if (pathname.startsWith("/administracion/mapas-ambientes")) return ["Administración", "Mapas de ambientes"];
  if (pathname.startsWith("/administracion/taxonomia")) return ["Administración", "Taxonomía"];
  if (pathname.startsWith("/documentos")) return ["Administración", "Documentos"];
  if (pathname.startsWith("/auditoria")) return ["Administración", "Auditoría"];
  if (pathname.startsWith("/almacen/catalogo")) return ["Almacén", "Catálogo"];
  if (pathname.startsWith("/almacen/movimientos")) return ["Almacén", "Movimientos"];
  if (pathname.startsWith("/almacen/checklist")) return ["Almacén", "Devolución"];
  if (pathname.startsWith("/almacen/inspecciones")) return ["Almacén", "Inspecciones"];
  if (pathname.startsWith("/almacen/calendario")) return ["Almacén", "Calendario"];
  if (pathname.startsWith("/almacen/plan-anual")) return ["Almacén", "Plan anual"];
  if (pathname.startsWith("/almacen")) return ["Almacén", "Almacén de herramientas"];
  return ["FM Incalpaca", "Facility Management"];
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [routeSection, routeTitle] = getRouteContext(location.pathname);
  const [liveCounts, setLiveCounts] = useState<MenuCounts>({});

  useEffect(() => {
    let active = true;
    const refreshCounts = async () => {
      const [requestsResult, ordersResult] = await Promise.allSettled([listWorkRequests(), listWorkOrders()]);
      if (!active) return;
      if (!user || requestsResult.status !== "fulfilled" || ordersResult.status !== "fulfilled") return;
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
  }, [user?.id, user?.role, user?.workerCode]);

  const roleModules = modules
    .filter((mod) => !mod.roles || Boolean(user && mod.roles.includes(user.role)))
    .map((mod) => ({ ...mod, items: itemsForRole(mod.items, user).map((item) => ({ ...item, count: liveCounts[item.to] })) }))
    .filter((mod) => mod.items.length > 0);
  const roleQuickActions = user?.role === "ADMINISTRADOR" ? quickActions : [];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);
  const quickMenuRef = useRef<HTMLDialogElement>(null);

  const roleLabel =
    user?.role === "TECNICO"
      ? "Técnico"
      : user?.role === "SUPERVISOR"
        ? "Supervisor"
        : user?.role === "ALMACENERO"
          ? "Almacenero"
          : user?.role === "INSPECTOR"
            ? "Inspector"
            : user?.role === "SOLICITANTE"
              ? "Usuario solicitante"
              : "Administrador / Planner";
  const initials =
    user?.fullName
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "SG";

  const technicianNavigation = roleModules.find((mod) => mod.id === "dashboard")?.items ?? [];

  function openMobileMenu() {
    setMobileMenuOpen(true);
    mobileMenuRef.current?.showModal();
  }

  function openQuickMenu() {
    setQuickMenuOpen(true);
    quickMenuRef.current?.showModal();
  }

  function closeMobileMenu() {
    mobileMenuRef.current?.close();
  }

  function closeQuickMenu() {
    quickMenuRef.current?.close();
  }

  return (
    <div className="app-frame-overlay">
      {user?.role === "TECNICO" ? (
        <aside className="technician-sidebar" aria-label="Navegación del técnico">
          <div className="technician-sidebar-brand">
            <BrandLogo size={36} variant="light" />
            <span><strong>FM Incalpaca</strong><small>Mi trabajo</small></span>
          </div>
          <nav className="technician-sidebar-nav" aria-label="Mi trabajo">
            {technicianNavigation.map(({ to, label, icon: Icon, end, count }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `technician-sidebar-link ${isActive ? "is-active" : ""}`}>
                <Icon size={20} weight="duotone" /><span>{label}</span>{count !== undefined && <small>{count}</small>}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/perfil" className="technician-sidebar-profile">
            <span>{initials}</span><div><strong>{user.fullName}</strong><small>Técnico</small></div>
          </NavLink>
          <button className="technician-sidebar-logout" type="button" onClick={logout}><SignOut size={18} />Cerrar sesión</button>
        </aside>
      ) : (
      <aside className="persistent-sidebar" aria-label="Navegación principal">
        <div className="persistent-sidebar-brand">
          <BrandLogo size={36} variant="light" />
          <span><strong>FM Incalpaca</strong><small>{roleLabel}</small></span>
        </div>
        <nav className="persistent-sidebar-nav">
          {roleModules.map((module) => (
            <section key={module.id} className="persistent-nav-group" aria-label={module.label}>
              <h2>{module.label}</h2>
              {module.items.map(({ to, label, icon: Icon, end, count }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `persistent-nav-link ${isActive ? "is-active" : ""}`}>
                  <Icon size={19} weight="duotone" />
                  <span>{label}</span>
                  {count !== undefined && <small>{count}</small>}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
        <NavLink to="/perfil" className="persistent-sidebar-profile">
          <span>{initials}</span><div><strong>{user?.fullName}</strong><small>{roleLabel}</small></div>
        </NavLink>
        <button className="persistent-sidebar-logout" type="button" onClick={logout}><SignOut size={18} />Cerrar sesión</button>
      </aside>
      )}

      {/* MOBILE NAVIGATION */}
      <nav className="mobile-navigation" aria-label="Accesos rápidos">
        {mobilePrimary.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `mobile-nav-item ${isActive ? "is-active" : ""}`}
          >
            <Icon size={21} weight="duotone" />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          className={`mobile-nav-item ${mobileMenuOpen ? "is-active" : ""}`}
          type="button"
          aria-expanded={mobileMenuOpen}
          onClick={openMobileMenu}
        >
          <DotsThree size={22} weight="bold" />
          <span>Más</span>
        </button>
      </nav>

      {/* MOBILE MORE DIALOG */}
      <dialog
        ref={mobileMenuRef}
        className="mobile-more-dialog"
        onClose={() => setMobileMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMobileMenu();
        }}
      >
        <section className="mobile-more-menu" aria-labelledby="mobile-more-title">
          <header>
            <div>
              <strong id="mobile-more-title">Más funciones</strong>
              <span>Accesos secundarios del sistema</span>
            </div>
            <button type="button" aria-label="Cerrar menú" onClick={closeMobileMenu}>
              <X />
            </button>
          </header>
          <div className="mobile-more-groups">
            {roleModules.map((mod) => (
              <div key={mod.id} className="mobile-more-group">
                <h3>{mod.label}</h3>
                <div className="mobile-more-items">
                  {itemsForRole(mod.items, user).map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `mobile-more-link ${isActive ? "is-active" : ""}`}
                    >
                      <Icon size={21} weight="duotone" />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </dialog>

      {/* QUICK ACTIONS DIALOG */}
      <dialog
        ref={quickMenuRef}
        className="quick-actions-dialog"
        onClose={() => setQuickMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeQuickMenu();
        }}
      >
        <section className="quick-actions-sheet" aria-labelledby="quick-actions-title">
          <header>
            <div>
              <span>Centro de acciones</span>
              <h2 id="quick-actions-title">¿Qué deseas iniciar?</h2>
            </div>
            <button type="button" aria-label="Cerrar acciones rápidas" onClick={closeQuickMenu}>
              <X />
            </button>
          </header>

          <nav aria-label="Acciones globales">
            {roleQuickActions.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={closeQuickMenu}>
                <Icon size={23} weight="bold" />
                <span>{label}</span>
                <ArrowRight size={18} weight="bold" />
              </NavLink>
            ))}
          </nav>
        </section>
      </dialog>

      {/* MAIN CONTENT FRAME: Starts immediately after rail (margin-left: 92px) */}
      <div className={`content-frame-overlay ${user?.role === "TECNICO" ? "is-technician" : "is-persistent-sidebar"}`}>
        <header className="topbar">
          <div className="topbar-context">
            <SquaresFour size={22} weight="duotone" />
            <span>
              <small>{routeSection}</small>
              <strong>{routeTitle}</strong>
            </span>
          </div>

          <div className="topbar-actions">
            {roleQuickActions.length > 0 && (
              <button
                className="topbar-quick-action"
                type="button"
                aria-expanded={quickMenuOpen}
                onClick={openQuickMenu}
              >
                <Lightning size={18} weight="fill" />
                <span>Nueva acción</span>
                <Plus size={16} weight="bold" />
              </button>
            )}
            <NotificationCenter />
            <NavLink to="/perfil" className="topbar-user topbar-user-link" aria-label="Abrir mi perfil">
              <span>{initials}</span>
              <div>
                <strong>{user?.fullName}</strong>
                <small>{roleLabel}</small>
              </div>
            </NavLink>
          </div>
        </header>

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

function itemsForRole(items: NavItem[], user: ReturnType<typeof useAuth>["user"]) {
  if (user?.role === "TECNICO") {
    return items.filter((item) => item.to === "/" || item.to === "/ordenes-trabajo" || item.to === "/mi-jornada");
  }
  if (user?.role === "SUPERVISOR") {
    return items.filter((item) => item.to === "/" || item.to === "/ordenes-trabajo" || item.to === "/mi-jornada");
  }
  return items;
}
