import {
  ArrowRight,
  Barcode,
  Buildings,
  CalendarBlank,
  CalendarPlus,
  CaretDown,
  CaretLeft,
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
  Warehouse,
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
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
    id: "work_orders",
    label: "Órdenes de trabajo",
    shortLabel: "OTs",
    icon: Wrench,
    paths: ["/", "/incidencias", "/ordenes-trabajo", "/mi-jornada", "/mantenimiento"],
    roles: ["ADMINISTRADOR", "TECNICO", "SOLICITANTE", "SUPERVISOR"],
    items: [
      { to: "/incidencias", label: "Bandeja de reportes", icon: ListChecks, end: true, roles: ["ADMINISTRADOR", "TECNICO"] },
      { to: "/mantenimiento/panel", label: "Panel operativo", icon: SquaresFour, roles: ["ADMINISTRADOR", "TECNICO"] },
      { to: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Toolbox, roles: ["ADMINISTRADOR", "TECNICO"] },
      { to: "/mi-jornada", label: "Mi jornada", icon: CalendarBlank, roles: ["TECNICO"] },
      
      { to: "/", label: "Inicio", icon: House, end: true, roles: ["SOLICITANTE"] },
      { to: "/incidencias/nueva", label: "Nueva solicitud", icon: WarningDiamond, roles: ["SOLICITANTE"] },
      { to: "/incidencias", label: "Mis solicitudes", icon: ListChecks, roles: ["SOLICITANTE"] },
      
      { to: "/", label: "Inicio", icon: SquaresFour, end: true, roles: ["SUPERVISOR"] },
    ],
  },
  {
    id: "assets",
    label: "Activos",
    shortLabel: "Activos",
    icon: Package,
    paths: ["/bienes", "/asignaciones", "/mapa"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/bienes/panel", label: "Panel de activos", icon: SquaresFour, end: true },
      { to: "/bienes/entradas", label: "Entradas", icon: Package },
      { to: "/asignaciones", label: "Asignaciones", icon: ClipboardText },
      { to: "/bienes/ciclo-vida/bajas", label: "Baja del bien", icon: ShieldCheck },
      { to: "/bienes", label: "Inventario general", icon: ListDashes, end: true },
      { to: "/mapa", label: "Mapa de activos", icon: MapTrifold },
      { to: "/bienes/qr", label: "Imprimir QR", icon: Barcode },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    shortLabel: "Gestión",
    icon: TreeStructure,
  Warehouse,
    paths: ["/administracion/taxonomia", "/administracion/espacios", "/administracion/usuarios", "/administracion/tecnicos"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/administracion/taxonomia", label: "Clasificación", icon: TreeStructure,
  Warehouse, end: true },
      { to: "/administracion/espacios", label: "Espacios y ambientes", icon: Buildings },
      { to: "/administracion/usuarios", label: "Usuarios", icon: UserCircle },
      { to: "/administracion/tecnicos", label: "Técnicos", icon: UsersThree },
      { to: "/administracion/taxonomia/codigos", label: "Directorio de espacios", icon: Tag },
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
    id: "reports",
    label: "Reportes",
    shortLabel: "Reportes",
    icon: ChartBar,
    paths: ["/informes"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/informes", label: "Panel ejecutivo", icon: ChartBar, end: true, roles: ["ADMINISTRADOR"] },
      { to: "/informes/ordenes-trabajo", label: "Informes de OT", icon: Toolbox, roles: ["ADMINISTRADOR"] },
      { to: "/informes/plantillas", label: "Plantillas", icon: Files, roles: ["ADMINISTRADOR"] },
    ],
  },
  {
    id: "administration",
    label: "Configuración",
    shortLabel: "Configuración",
    icon: GearSix,
    paths: ["/administracion/formularios", "/documentos", "/auditoria"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/administracion/formularios", label: "Formularios de inspección", icon: ListChecks },
      { to: "/documentos", label: "Documentos", icon: Files },
      { to: "/auditoria", label: "Auditoría", icon: ShieldCheck },
    ],
  },
];

const mobilePrimary: NavItem[] = [
  { to: "/incidencias", label: "Órdenes", icon: ListChecks, end: false },
  { to: "/bienes", label: "Activos", icon: Package, end: false },
  { to: "/administracion/taxonomia", label: "Gestión", icon: TreeStructure, end: false },
  { to: "/almacen/catalogo", label: "Almacén", icon: Warehouse, end: false },
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
      (order) =>
        order.status === "PENDIENTE_DE_SUPERVISION" &&
        (order.supervisorId === user.id || order.supervisorName === user.fullName),
    ).length;
    return withBadge("/", reviewQueue);
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

function isGroupActive(pathname: string, paths: string[]) {
  if (pathname === "/" && paths.includes("/")) return true;
  if (pathname !== "/" && paths.includes("/")) return false;
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function compactSupervisorLabel(path: string, label: string) {
  if (path === "/") return "Inicio";
  if (path === "/incidencias") return "Reportes";
  if (path === "/ordenes-trabajo") return "Órdenes";
  if (path === "/mi-jornada") return "Jornada";
  return label;
}

function getRouteContext(pathname: string) {
  if (pathname === "/") return ["Órdenes de trabajo", "Panel operativo"];
  if (pathname.startsWith("/mi-perfil")) return ["Solicitante", "Inicio"];
  if (pathname.startsWith("/mi-jornada")) return ["Órdenes de trabajo", "Mi jornada"];
  if (pathname.startsWith("/incidencias")) return ["Órdenes de trabajo", "Bandeja de reportes"];
  if (pathname.startsWith("/supervision")) return ["Órdenes de trabajo", "Órdenes de trabajo"];
  if (pathname.startsWith("/ordenes-trabajo")) return ["Órdenes de trabajo", "Órdenes de trabajo"];
  if (pathname.startsWith("/bienes/qr")) return ["Activos", "Códigos QR"];
  if (pathname.startsWith("/mapa")) return ["Activos", "Mapa de ambientes"];
  if (pathname.startsWith("/bienes/entradas")) return ["Activos", "Entradas"];
  if (pathname.startsWith("/bienes/ciclo-vida")) return ["Activos", "Baja del bien"];
  if (pathname.startsWith("/bienes")) return ["Activos", "Inventario general"];
  if (pathname.startsWith("/asignaciones")) return ["Activos", "Asignaciones"];
  if (pathname.startsWith("/informes")) return ["Reportes", "Informes"];
  if (pathname.startsWith("/administracion/taxonomia/codigos")) return ["Gestión", "Directorio de espacios"];
  if (pathname.startsWith("/administracion/tecnicos")) return ["Gestión", "Técnicos"];
  if (pathname.startsWith("/administracion/usuarios")) return ["Gestión", "Usuarios"];
  if (pathname.startsWith("/administracion/reportantes")) return ["Gestión", "Reportantes"];
  if (pathname.startsWith("/administracion/espacios")) return ["Gestión", "Espacios y ambientes"];
  if (pathname.startsWith("/administracion/taxonomia")) return ["Gestión", "Clasificación"];
  if (pathname.startsWith("/almacen/catalogo")) return ["Almacén", "Catálogo"];
  if (pathname.startsWith("/almacen/movimientos")) return ["Almacén", "Movimientos"];
  if (pathname.startsWith("/almacen/checklist")) return ["Almacén", "Devolución"];
  if (pathname.startsWith("/almacen/inspecciones")) return ["Almacén", "Inspecciones"];
  if (pathname.startsWith("/almacen/calendario")) return ["Almacén", "Calendario"];
  if (pathname.startsWith("/almacen/plan-anual")) return ["Almacén", "Plan anual"];
  if (pathname.startsWith("/almacen/plantillas")) return ["Almacén", "Plantillas SST"];
  if (pathname.startsWith("/administracion/formularios")) return ["Configuración", "Formularios de inspección"];
  if (pathname.startsWith("/documentos")) return ["Configuración", "Documentos"];
  if (pathname.startsWith("/auditoria")) return ["Configuración", "Auditoría"];
  return ["Incalpaca FM", "Plataforma"];
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [baseRouteSection, baseRouteTitle] = getRouteContext(location.pathname);
  const [routeSection, routeTitle] =
    user?.role === "SOLICITANTE" && location.pathname.startsWith("/incidencias/nueva")
      ? ["Solicitudes", "Nueva solicitud"]
      : user?.role === "SOLICITANTE" && location.pathname.startsWith("/incidencias")
        ? ["Solicitudes", "Mis solicitudes"]
        : user?.role === "SOLICITANTE"
          ? ["Solicitante", "Inicio"]
          : [baseRouteSection, baseRouteTitle];
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
  }, [user]);

  const roleModules = modules
    .filter((mod) => !mod.roles || Boolean(user && mod.roles.includes(user.role)))
    .map((mod) => ({ ...mod, items: itemsForRole(mod.items, user).map((item) => ({ ...item, count: liveCounts[item.to] })) }))
    .filter((mod) => mod.items.length > 0);
  const roleQuickActions = user?.role === "ADMINISTRADOR" ? quickActions : [];
  const railModules = roleModules.filter((mod) => mod.id !== "administration");
  const configModule = roleModules.find((mod) => mod.id === "administration");
  const matchedModuleId = roleModules.find((mod) => isGroupActive(location.pathname, mod.paths))?.id ?? "dashboard";
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [activeFlyoutModuleId, setActiveFlyoutModuleId] = useState(matchedModuleId);
  const sidebarRef = useRef<HTMLElement>(null);
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
  const supervisorNavigation = roleModules.flatMap((mod) => mod.items);

  useEffect(() => {
    const matched = roleModules.find((mod) => isGroupActive(location.pathname, mod.paths));
    if (matched && !flyoutOpen) setActiveFlyoutModuleId(matched.id);
  }, [location.pathname, roleModules, flyoutOpen]);

  useEffect(() => {
    function closeWhenOutside(event: MouseEvent) {
      if (flyoutOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) setFlyoutOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setFlyoutOpen(false);
    }
    document.addEventListener("mousedown", closeWhenOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [flyoutOpen]);

  function toggleModule(module: ModuleGroup) {
    if (activeFlyoutModuleId === module.id && flyoutOpen) setFlyoutOpen(false);
    else {
      setActiveFlyoutModuleId(module.id);
      setFlyoutOpen(true);
    }
  }

  const activeFlyoutModule = roleModules.find((module) => module.id === activeFlyoutModuleId) ?? roleModules[0];

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
      {user?.role === "TECNICO" || user?.role === "SOLICITANTE" ? (
        <aside className="technician-sidebar" aria-label="Navegación del técnico">
          <div className="technician-sidebar-brand">
            <BrandLogo size={36} variant="light" />
            <span><strong>FM Incalpaca</strong><small>{user.role === "SOLICITANTE" ? "Mis solicitudes" : "Mi trabajo"}</small></span>
          </div>
          <nav className="technician-sidebar-nav" aria-label={user.role === "SOLICITANTE" ? "Mis solicitudes" : "Mi trabajo"}>
            {technicianNavigation.map(({ to, label, icon: Icon, end, count }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `technician-sidebar-link ${isActive ? "is-active" : ""}`}>
                <Icon size={20} weight="duotone" /><span>{label}</span>{count !== undefined && <small>{count}</small>}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/perfil" className="technician-sidebar-profile">
            <span>{initials}</span><div><strong>{user.fullName}</strong><small>{user.role === "SOLICITANTE" ? "Usuario solicitante" : "Técnico"}</small></div>
          </NavLink>
          <button className="technician-sidebar-logout" type="button" onClick={logout}><SignOut size={18} />Cerrar sesión</button>
        </aside>
      ) : user?.role === "SUPERVISOR" ? (
        <aside className="sidebar-rail-narrow supervisor-compact-rail" aria-label="Navegación del supervisor">
          <div className="rail-logo-wrap"><BrandLogo size={36} variant="light" /></div>
          <nav className="rail-vertical-nav">
            {supervisorNavigation.map(({ to, label, icon: Icon, end, count }) => (
              <NavLink key={to} to={to} end={end} title={label} className={({ isActive }) => `rail-circle-option ${isActive ? "is-active" : ""}`}>
                <span className="circle-btn"><Icon size={21} weight="duotone" /></span>
                <span className="circle-label">{compactSupervisorLabel(to, label)}</span>
                {count !== undefined && <small className="supervisor-rail-badge">{count}</small>}
              </NavLink>
            ))}
          </nav>
          <div className="rail-bottom-actions">
            <NavLink to="/perfil" title="Mi perfil" aria-label="Mi perfil" className="rail-circle-option supervisor-profile-option"><span className="circle-btn">{initials}</span><span className="circle-label">Perfil</span></NavLink>
            <button type="button" aria-label="Cerrar sesión" className="rail-circle-option logout-circle-option" onClick={logout} title="Cerrar sesión"><span className="circle-btn"><SignOut size={19} /></span><span className="circle-label">Salir</span></button>
          </div>
        </aside>
      ) : (
        <aside ref={sidebarRef} className="two-level-sidebar-overlay" aria-label="Navegación principal">
          <div className="sidebar-rail-narrow">
            <div className="rail-logo-wrap"><BrandLogo size={36} variant="light" /></div>
            <nav className="rail-vertical-nav">
              {railModules.map((module) => {
                const isActive = (flyoutOpen ? activeFlyoutModuleId : matchedModuleId) === module.id;
                const Icon = module.icon;
                return <button key={module.id} type="button" aria-label={module.label} className={`rail-circle-option ${isActive ? "is-active" : ""}`} onClick={() => toggleModule(module)} title={module.label}>
                  <div className="circle-btn"><Icon size={21} weight={isActive ? "bold" : "duotone"} /></div><span className="circle-label">{module.shortLabel}</span>
                </button>;
              })}
            </nav>
            <div className="rail-bottom-actions">
              {configModule && <button type="button" aria-label="Configuración" className={`rail-circle-option ${(flyoutOpen ? activeFlyoutModuleId : matchedModuleId) === "administration" ? "is-active" : ""}`} onClick={() => toggleModule(configModule)} title="Configuración"><div className="circle-btn"><GearSix size={21} weight="duotone" /></div><span className="circle-label">Configuración</span></button>}
              <button type="button" aria-label="Cerrar sesión" className="rail-circle-option logout-circle-option" onClick={logout} title="Cerrar sesión"><div className="circle-btn"><SignOut size={19} /></div><span className="circle-label">Salir</span></button>
            </div>
          </div>
          {flyoutOpen && activeFlyoutModule && <div className="sidebar-flyout-panel" role="region" aria-label={`Submenú ${activeFlyoutModule.label}`}>
            <header className="flyout-header"><div><span className="flyout-context-label">Módulo</span><h2 className="flyout-title">{activeFlyoutModule.label}</h2></div><button type="button" className="flyout-close-btn" onClick={() => setFlyoutOpen(false)} aria-label="Cerrar menú"><CaretLeft size={18} /></button></header>
            <nav className="flyout-nav-list">
              {activeFlyoutModule.items.map(({ to, label, icon: Icon, end, count }) => <NavLink key={to} to={to} end={end} onClick={() => setFlyoutOpen(false)} className={({ isActive }) => `flyout-item ${isActive ? "is-active" : ""}`}><Icon size={19} weight="duotone" /><span>{label}</span>{count !== undefined && <span className="flyout-badge">{count}</span>}</NavLink>)}
            </nav>
            <div className="flyout-footer"><div className="flyout-user-card"><div className="user-avatar-circle">{initials}</div><div className="user-meta"><strong>{user?.fullName}</strong><small>{roleLabel}</small></div><button type="button" className="user-logout-btn" onClick={logout} title="Cerrar sesión"><SignOut size={16} /></button></div></div>
          </div>}
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
      <div className={`content-frame-overlay ${user?.role === "TECNICO" || user?.role === "SOLICITANTE" ? "is-technician" : user?.role === "SUPERVISOR" ? "is-supervisor-rail" : ""}`}>
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
  const allowedItems = items.filter((item) => !item.roles || Boolean(user && item.roles.includes(user.role)));

  if (user?.role === "TECNICO") {
    return allowedItems.filter((item) => item.to === "/" || item.to === "/ordenes-trabajo" || item.to === "/mi-jornada");
  }
  if (user?.role === "SUPERVISOR") {
    return allowedItems.filter((item) => item.to === "/");
  }
  return allowedItems;
}
