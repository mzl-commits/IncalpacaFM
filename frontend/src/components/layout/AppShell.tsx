import {
  ArrowRight,
  Barcode,
  CalendarBlank,
  CaretLeft,
  ChartBar,
  ChartLineUp,
  ClipboardText,
  Cube,
  CubeFocus,
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
  UserSwitch,
  UsersThree,
  WarningCircle,
  WarningDiamond,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/accounts/AuthContext";
import type { UserRole } from "@/modules/accounts/types";
import { RouteBreadcrumbs } from "@/components/navigation/RouteBreadcrumbs";
import { NotificationCenter } from "@/modules/notifications/components/NotificationCenter";
import { BrandLogo } from "@/components/shared/BrandLogo";

type NavItem = {
  to: string;
  label: string;
  icon: typeof House;
  end?: boolean;
  count?: string | number;
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
    id: "home",
    label: "Inicio",
    shortLabel: "Inicio",
    icon: House,
    paths: ["/"],
    items: [
      { to: "/", label: "Resumen ejecutivo", icon: House, end: true },
    ],
  },
  {
    id: "assets",
    label: "Activos y espacios",
    shortLabel: "Activos",
    icon: Package,
    paths: ["/bienes", "/asignaciones", "/mapa"],
    items: [
      { to: "/bienes/entradas", label: "Entradas", icon: Package },
      { to: "/asignaciones", label: "Asignaciones", icon: ClipboardText },
      { to: "/bienes/qr", label: "Códigos QR", icon: Barcode },
      { to: "/bienes/escanear", label: "Escanear bien", icon: Barcode },
      { to: "/mapa", label: "Mapa de activos", icon: MapTrifold },
      { to: "/bienes/ciclo-vida/bajas", label: "Ciclo de vida", icon: ShieldCheck },
      { to: "/bienes", label: "Inventario general", icon: ListDashes, end: true, count: "31" },
    ],
  },
  {
    id: "almacen",
    label: "Almacén",
    shortLabel: "Almacén",
    icon: Toolbox,
    paths: ["/almacen"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/almacen/catalogo", label: "Catálogo", icon: ListDashes, end: true, count: "10" },
      { to: "/almacen/movimientos", label: "Movimientos", icon: ArrowRight },
      { to: "/almacen/checklist", label: "Devolución", icon: ListChecks },
      { to: "/almacen/inspecciones", label: "Inspecciones", icon: ClipboardText },
    ],
  },
  {
    id: "operations",
    label: "Atención y mantenimiento",
    shortLabel: "Mantenimiento",
    icon: Wrench,
    paths: ["/incidencias", "/ordenes-trabajo", "/supervision", "/mi-jornada"],
    items: [
      { to: "/incidencias", label: "Bandeja de reportes", icon: ListChecks, count: "6" },
      { to: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Toolbox, count: "4" },
      { to: "/supervision", label: "Revisión de OT", icon: ShieldCheck },
      { to: "/mi-jornada", label: "Agenda semanal", icon: CalendarBlank },
    ],
  },
  {
    id: "qr",
    label: "Códigos QR",
    shortLabel: "QR",
    icon: Barcode,
    paths: ["/bienes/qr", "/bienes/escanear"],
    items: [
      { to: "/bienes/qr", label: "Imprimir QR", icon: Barcode },
      { to: "/bienes/escanear", label: "Escanear bien", icon: Barcode },
      { to: "/administracion/taxonomia/codigos", label: "Códigos FM", icon: Tag },
    ],
  },
  {
    id: "reports",
    label: "Reportes",
    shortLabel: "Reportes",
    icon: ChartBar,
    paths: ["/informes"],
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
      { to: "/administracion/tecnicos", label: "Técnicos y horarios", icon: UsersThree, count: "2" },
      { to: "/administracion/reportantes", label: "Historial de reportantes", icon: UserCircle },
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

const railItems = mobilePrimary;

interface QuickActionItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; color?: string; className?: string }>;
  color: string;
  type: string;
}

const quickActions: QuickActionItem[] = [
  {
    to: "/bienes/entradas/nueva",
    label: "Registrar un bien",
    icon: CubeFocus,
    color: "#2563EB",
    type: "bienes",
  },
  {
    to: "/asignaciones/nueva",
    label: "Crear una asignación",
    icon: UserSwitch,
    color: "#7C3AED",
    type: "asignaciones",
  },
  {
    to: "/incidencias/nueva",
    label: "Reportar una incidencia",
    icon: WarningDiamond,
    color: "#EA580C",
    type: "incidencias",
  },
  {
    to: "/informes",
    label: "Abrir informes",
    icon: ChartLineUp,
    color: "#059669",
    type: "informes",
  },
];

function isGroupActive(pathname: string, paths: string[]) {
  if (pathname === "/" && paths.includes("/")) return true;
  if (pathname !== "/" && paths.includes("/")) return false;
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getRouteContext(pathname: string) {
  if (pathname === "/") return ["Panel ejecutivo", "Inicio"];
  if (pathname.startsWith("/mi-jornada")) return ["Mi trabajo", "Agenda semanal"];
  if (pathname.startsWith("/bienes/qr")) return ["Bienes", "Códigos QR"];
  if (pathname.startsWith("/mapa")) return ["Activos y espacios", "Mapa de activos"];
  if (pathname.startsWith("/bienes/entradas")) return ["Activos y espacios", "Entradas"];
  if (pathname.startsWith("/bienes")) return ["Activos y espacios", "Inventario"];
  if (pathname.startsWith("/asignaciones")) return ["Activos y espacios", "Asignaciones"];
  if (pathname.startsWith("/incidencias")) return ["Atención y mantenimiento", "Reportes"];
  if (pathname.startsWith("/supervision")) return ["Supervisión", "Revisión de OT"];
  if (pathname.startsWith("/ordenes-trabajo")) return ["Atención y mantenimiento", "Órdenes operativas"];
  if (pathname.startsWith("/bienes/ciclo-vida")) return ["Bienes", "Ciclo de vida"];
  if (pathname.startsWith("/informes")) return ["Inteligencia", "Informes"];
  if (pathname.startsWith("/administracion/taxonomia/codigos")) return ["Taxonomía", "Códigos FM"];
  if (pathname.startsWith("/administracion/tecnicos")) return ["Administración", "Técnicos"];
  if (pathname.startsWith("/administracion/reportantes")) return ["Administración", "Reportantes"];
  if (pathname.startsWith("/administracion/mapas-ambientes")) return ["Administración", "Mapas de ambientes"];
  if (pathname.startsWith("/administracion/taxonomia")) return ["Administración", "Taxonomía"];
  if (pathname.startsWith("/documentos")) return ["Administración", "Documentos"];
  if (pathname.startsWith("/auditoria")) return ["Administración", "Auditoría"];
  if (pathname.startsWith("/almacen/catalogo")) return ["Almacén", "Catálogo"];
  if (pathname.startsWith("/almacen/movimientos")) return ["Almacén", "Movimientos"];
  if (pathname.startsWith("/almacen/checklist")) return ["Almacén", "Devolución"];
  if (pathname.startsWith("/almacen/inspecciones")) return ["Almacén", "Inspecciones"];
  if (pathname.startsWith("/almacen")) return ["Almacén", "Almacén de herramientas"];
  return ["FM Incalpaca", "Facility Management"];
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [routeSection, routeTitle] = getRouteContext(location.pathname);

  const roleModules = modules.filter(
    (mod) => !mod.roles || Boolean(user && mod.roles.includes(user.role)),
  );
  const railModules = roleModules.filter((mod) => mod.id !== "administration");
  const configModule = roleModules.find((m) => m.id === "administration");

  const matchedModuleId =
    roleModules.find((mod) => isGroupActive(location.pathname, mod.paths))?.id ?? "assets";

  // Flyout Panel State: CLOSED BY DEFAULT
  const [flyoutOpen, setFlyoutOpen] = useState<boolean>(false);
  const [activeFlyoutModuleId, setActiveFlyoutModuleId] = useState<string>(matchedModuleId);

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

  useEffect(() => {
    const matched = roleModules.find((mod) => isGroupActive(location.pathname, mod.paths));
    if (matched && matched.id !== activeFlyoutModuleId && !flyoutOpen) {
      setActiveFlyoutModuleId(matched.id);
    }
  }, [location.pathname]);

  // Click Outside Listener (Case 5) & Escape Key Listener (Case 6)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        flyoutOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setFlyoutOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && flyoutOpen) {
        setFlyoutOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [flyoutOpen]);

  // Handle clicking a module on the rail
  function handleRailClick(mod: ModuleGroup) {
    if (mod.id === "home") {
      setFlyoutOpen(false);
      navigate("/");
      return;
    }

    if (flyoutOpen && activeFlyoutModuleId === mod.id) {
      setFlyoutOpen(false);
    } else {
      setActiveFlyoutModuleId(mod.id);
      setFlyoutOpen(true);
    }
  }

  const activeFlyoutModule =
    roleModules.find((mod) => mod.id === activeFlyoutModuleId) ?? roleModules[0] ?? modules[1];

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
      {/* 2-LEVEL SIDEBAR: FIXED NARROW RAIL + OVERLAY FLYOUT PANEL */}
      <aside ref={sidebarRef} className="two-level-sidebar-overlay" aria-label="Navegación principal">
        {/* LEVEL 1: NARROW RAIL (Fixed 92px, White background) */}
        <div className="sidebar-rail-narrow">
          <div className="rail-logo-wrap">
            <BrandLogo size={36} variant="light" />
          </div>

          <nav className="rail-vertical-nav">
            {railModules.map((mod) => {
              const activeModuleId = flyoutOpen ? activeFlyoutModuleId : matchedModuleId;
              const isSelected = activeModuleId === mod.id;
              const Icon = mod.icon;

              return (
                <button
                  key={mod.id}
                  type="button"
                  aria-label={mod.label}
                  className={`rail-circle-option ${isSelected ? "is-active" : ""}`}
                  onClick={() => handleRailClick(mod)}
                  title={mod.label}
                >
                  <div className="circle-btn">
                    <Icon size={21} weight={isSelected ? "bold" : "duotone"} />
                  </div>
                  <span className="circle-label">{mod.shortLabel}</span>
                </button>
              );
            })}
          </nav>

          <div className="rail-bottom-actions">
            {configModule && (
              <button
                type="button"
                aria-label="Configuración"
                className={`rail-circle-option ${(flyoutOpen ? activeFlyoutModuleId : matchedModuleId) === "administration" ? "is-active" : ""}`}
                onClick={() => handleRailClick(configModule)}
                title="Configuración"
              >
                <div className="circle-btn">
                  <GearSix size={21} weight={matchedModuleId === "administration" ? "bold" : "duotone"} />
                </div>
                <span className="circle-label">Configuración</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Cerrar sesión"
              className="rail-circle-option logout-circle-option"
              onClick={logout}
              title="Cerrar sesión"
            >
              <div className="circle-btn">
                <SignOut size={19} />
              </div>
              <span className="circle-label">Salir</span>
            </button>
          </div>
        </div>

        {/* LEVEL 2: OVERLAY FLYOUT PANEL (Fixed 275px Floating Panel over Content) */}
        {flyoutOpen && (
          <div className="sidebar-flyout-panel" role="region" aria-label={`Submenú ${activeFlyoutModule.label}`}>
            <header className="flyout-header">
              <div>
                <span className="flyout-context-label">Módulo</span>
                <h2 className="flyout-title">{activeFlyoutModule.label}</h2>
              </div>
              <button
                type="button"
                className="flyout-close-btn"
                onClick={() => setFlyoutOpen(false)}
                title="Cerrar menú"
                aria-label="Cerrar menú"
              >
                <CaretLeft size={18} />
              </button>
            </header>

            <nav className="flyout-nav-list">
              {activeFlyoutModule.items.map(({ to, label, icon: ItemIcon, end, count }, idx) => {
                const isSubActive =
                  location.pathname === to ||
                  (!end && to !== "/" && location.pathname.startsWith(`${to}/`));
                const hasAnyActive = activeFlyoutModule.items.some(
                  (it) =>
                    location.pathname === it.to ||
                    (!it.end && it.to !== "/" && location.pathname.startsWith(`${it.to}/`)),
                );
                const isHighlighted = isSubActive || (!hasAnyActive && idx === 0);

                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setFlyoutOpen(false)}
                    className={`flyout-item ${isHighlighted ? "is-active" : ""}`}
                  >
                    <ItemIcon size={19} weight="duotone" />
                    <span>{label}</span>
                    {count !== undefined && <span className="flyout-badge">{count}</span>}
                  </NavLink>
                );
              })}
            </nav>

            <div className="flyout-footer">
              <div className="flyout-user-card">
                <div className="user-avatar-circle">{initials}</div>
                <div className="user-meta">
                  <strong>{user?.fullName}</strong>
                  <small>{roleLabel}</small>
                </div>
                <button
                  type="button"
                  className="user-logout-btn"
                  onClick={logout}
                  title="Cerrar sesión"
                >
                  <SignOut size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

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
                  {mod.items.map(({ to, label, icon: Icon }) => (
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
          <header className="quick-actions-header">
            <div>
              <h2 id="quick-actions-title">Nueva acción</h2>
              <p>Selecciona una tarea para continuar.</p>
            </div>
            <button type="button" aria-label="Cerrar" onClick={closeQuickMenu}>
              <X size={20} />
            </button>
          </header>

          <nav className="quick-actions-matrix" aria-label="Acciones globales">
            {quickActions.map(({ to, label, icon: Icon, type, color }, index) => (
              <NavLink
                key={to}
                to={to}
                className={`quick-action-card action-type-${type}`}
                onClick={closeQuickMenu}
                style={{ "--action-color": color, "--stagger-delay": `${(index + 1) * 30}ms` } as React.CSSProperties}
              >
                <span className="quick-action-top-accent" />
                <div className="quick-action-icon-box">
                  <Icon size={32} weight="duotone" color={color} />
                </div>
                <span className="quick-action-label">{label}</span>
                <ArrowRight size={20} className="quick-action-arrow" />
              </NavLink>
            ))}
          </nav>
        </section>
      </dialog>

      {/* MAIN CONTENT FRAME: Starts immediately after rail (margin-left: 92px) */}
      <div className="content-frame-overlay">
        <header className="topbar">
          <div className="topbar-context">
            <SquaresFour size={22} weight="duotone" />
            <span>
              <small>{routeSection}</small>
              <strong>{routeTitle}</strong>
            </span>
          </div>

          <div className="topbar-actions">
            {quickActions.length > 0 && (
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
            <div className="topbar-user" aria-label="Usuario actual">
              <span>{initials}</span>
              <div>
                <strong>{user?.fullName}</strong>
                <small>{roleLabel}</small>
              </div>
            </div>
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
