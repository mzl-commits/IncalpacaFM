import {
  ArrowRight,
  Barcode,
  CalendarBlank,
  CaretDown,
  ChartBar,
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
  SignOut,
  ShieldCheck,
  SquaresFour,
  TreeStructure,
  Tag,
  Toolbox,
  UserCircle,
  UsersThree,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/modules/accounts/AuthContext";
import type { UserRole } from "@/modules/accounts/types";
import { RouteBreadcrumbs } from "@/components/navigation/RouteBreadcrumbs";
import { NotificationCenter } from "@/modules/notifications/components/NotificationCenter";

type NavItem = {
  to: string;
  label: string;
  icon: typeof House;
  end?: boolean;
};

const groups: Array<{
  id: string;
  label: string;
  icon: typeof House;
  paths: string[];
  items: NavItem[];
  roles?: UserRole[];
}> = [
  {
    id: "technician",
    label: "Mi jornada",
    icon: CalendarBlank,
    paths: ["/mi-jornada"],
    roles: ["TECNICO"],
    items: [{ to: "/mi-jornada", label: "Agenda semanal", icon: CalendarBlank, end: true }],
  },
  {
    id: "assets",
    label: "Activos y espacios",
    icon: ListDashes,
    paths: ["/bienes", "/asignaciones", "/mapa"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/bienes", label: "Inventario", icon: ListDashes, end: true },
      { to: "/bienes/entradas", label: "Entradas", icon: Package },
      { to: "/asignaciones", label: "Asignaciones", icon: ClipboardText },
      { to: "/bienes/qr", label: "Códigos QR", icon: Barcode },
      { to: "/bienes/escanear", label: "Escanear bien", icon: Barcode },
      { to: "/mapa", label: "Mapa de activos", icon: MapTrifold },
      { to: "/bienes/ciclo-vida/bajas", label: "Ciclo de vida", icon: ShieldCheck },
    ],
  },
  {
    id: "almacen",
    label: "Almacén",
    icon: Toolbox,
    paths: ["/almacen"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/almacen/catalogo", label: "Catálogo", icon: ListDashes, end: true },
      { to: "/almacen/movimientos", label: "Movimientos", icon: ArrowRight },
      { to: "/almacen/checklist", label: "Devolución", icon: ListChecks },
      { to: "/almacen/inspecciones", label: "Inspecciones", icon: ClipboardText },
    ],
  },
  {
    id: "operations",
    label: "Atención y mantenimiento",
    icon: Wrench,
    paths: ["/incidencias", "/ordenes-trabajo"],
    items: [
      { to: "/incidencias", label: "Bandeja de reportes", icon: ListChecks },
      { to: "/ordenes-trabajo/recomendaciones", label: "Asignación recomendada", icon: Lightning },
      {
        to: "/ordenes-trabajo",
        label: "Órdenes operativas",
        icon: Toolbox,
      },
      { to: "/supervision", label: "Revisión de OT", icon: ShieldCheck },
    ],
  },
  {
    id: "team",
    label: "Equipo",
    icon: UsersThree,
    paths: ["/administracion/tecnicos", "/administracion/reportantes"],
    roles: ["ADMINISTRADOR"],
    items: [{ to: "/administracion/tecnicos", label: "Técnicos y horarios", icon: UsersThree }, { to: "/administracion/reportantes", label: "Historial de reportantes", icon: UserCircle }],
  },
  {
    id: "reports",
    label: "Control e informes",
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
    icon: GearSix,
    paths: ["/administracion/taxonomia", "/administracion/mapas-ambientes", "/documentos", "/auditoria"],
    roles: ["ADMINISTRADOR"],
    items: [
      {
        to: "/administracion/taxonomia",
        label: "Taxonomía",
        icon: TreeStructure,
      },
      {
        to: "/administracion/taxonomia/codigos",
        label: "Códigos FM",
        icon: Barcode,
      },
      {
        to: "/administracion/modelos",
        label: "Modelos de Bienes",
        icon: Tag,
      },
      {
        to: "/administracion/mapas-ambientes",
        label: "Mapas de ambientes",
        icon: MapTrifold,
      },
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
  {
    to: "/bienes/entradas/nueva",
    label: "Registrar un bien",
    icon: Package,
  },
  {
    to: "/asignaciones/nueva",
    label: "Crear una asignación",
    icon: ClipboardText,
  },
  {
    to: "/incidencias/nueva",
    label: "Reportar una incidencia",
    icon: ListChecks,
  },
  {
    to: "/informes",
    label: "Abrir informes",
    icon: ChartBar,
  },
];

function isGroupActive(pathname: string, paths: string[]) {
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
  const activeGroup = groups.find((group) => isGroupActive(location.pathname, group.paths))?.id;
  const [openGroup, setOpenGroup] = useState(activeGroup ?? "assets");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);
  const quickMenuRef = useRef<HTMLDialogElement>(null);
  const [routeSection, routeTitle] = getRouteContext(location.pathname);
  const roleLabel = user?.role === "TECNICO" ? "Técnico" : user?.role === "SUPERVISOR" ? "Supervisor" : "Administrador / Planner";
  const initials =
    user?.fullName
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "SG";
  const technicianMode = user?.role === "TECNICO";
  const supervisorMode = user?.role === "SUPERVISOR";
  const roleGroups = groups.filter(
    (group) => !group.roles || Boolean(user && group.roles.includes(user.role)),
  );
  const visibleGroups = supervisorMode
    ? roleGroups.filter((group) => group.id === "operations").map((group) => ({ ...group, items: group.items.filter((item) => item.to === "/supervision") }))
    : technicianMode
      ? roleGroups
          .filter((group) => group.id === "technician" || group.id === "operations")
          .map((group) => ({
            ...group,
            items: group.items.filter(
              (item) =>
                !item.to.startsWith("/asignaciones") &&
                !item.to.startsWith("/incidencias") &&
                !item.to.startsWith("/ordenes-trabajo/recomendaciones") &&
                !item.to.startsWith("/supervision"),
            ),
          }))
      : roleGroups;
  const visibleMobilePrimary = technicianMode
    ? mobilePrimary.filter((item) => item.to === "/")
    : supervisorMode
      ? []
      : mobilePrimary;
  const visibleMobileSecondary = visibleGroups
    .flatMap((group) => group.items)
    .filter((item) => !visibleMobilePrimary.some((primary) => primary.to === item.to));
  const visibleQuickActions = technicianMode
    ? quickActions.filter((item) => item.to === "/incidencias/nueva")
    : supervisorMode
      ? []
      : quickActions;

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
    mobileMenuRef.current?.close();
    quickMenuRef.current?.close();
  }, [location.pathname, activeGroup]);

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
    <div className="app-frame">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <img src="/logo-incalpaca.png" alt="Incalpaca Logo" style={{ maxHeight: "32px", width: "auto" }} />
          <span className="brand-copy">
            <strong style={{ fontFamily: "var(--font-heading)" }}>FM Incalpaca</strong>
            <small>Facility Management</small>
          </span>
        </div>

        <nav className="desktop-navigation">
          {!supervisorMode && (
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item home-nav ${isActive ? "is-active" : ""}`}
          >
            <House size={20} weight="duotone" />
            <span>Inicio</span>
          </NavLink>
          )}

          <div className="nav-groups">
            {visibleGroups.map((group) => {
              const expanded = openGroup === group.id;
              const active = isGroupActive(location.pathname, group.paths);
              const Icon = group.icon;
              const primary = group.items[0];
              const secondary = group.items.slice(1);

              return (
                <section className={`nav-group ${active ? "is-active" : ""}`} key={group.id}>
                  <div className="nav-group-header">
                    <NavLink
                      className="nav-group-primary"
                      to={primary.to}
                      end={primary.end}
                      title={group.label}
                    >
                      <Icon size={20} weight="duotone" />
                      <span>{group.label}</span>
                    </NavLink>

                    {!!secondary.length && (
                      <button
                        className="nav-group-toggle"
                        type="button"
                        aria-label={`${expanded ? "Contraer" : "Expandir"} ${group.label}`}
                        aria-expanded={expanded}
                        aria-controls={`nav-group-${group.id}`}
                        onClick={() => setOpenGroup(expanded ? "" : group.id)}
                      >
                        <CaretDown className="nav-group-caret" size={15} />
                      </button>
                    )}
                  </div>

                  {!!secondary.length && (
                    <div
                      className={`nav-submenu-wrap ${expanded ? "is-open" : ""}`}
                      aria-hidden={!expanded}
                    >
                      <div className="nav-submenu" id={`nav-group-${group.id}`}>
                        {secondary.map(({ to, label, icon: ItemIcon, end }) => (
                          <NavLink
                            key={to}
                            to={to}
                            end={end}
                            tabIndex={expanded ? undefined : -1}
                            className={({ isActive }) =>
                              `nav-subitem ${isActive ? "is-active" : ""}`
                            }
                          >
                            <ItemIcon size={17} weight="duotone" />
                            <span>{label}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </nav>

        <nav className="mobile-navigation" aria-label="Accesos rápidos">
          {visibleMobilePrimary.map(({ to, label, icon: Icon, end }) => (
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

        <div className="sidebar-account">
          <UserCircle size={34} weight="duotone" />
          <span>
            <strong>{user?.fullName}</strong>
            <small>{roleLabel}</small>
          </span>
          <button type="button" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <SignOut size={18} />
          </button>
        </div>
      </aside>

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
            {visibleGroups.map((group) => {
              const groupItems = group.items.filter(
                (item) => !visibleMobilePrimary.some((primary) => primary.to === item.to)
              );
              if (groupItems.length === 0) return null;

              return (
                <div key={group.id} className="mobile-more-group">
                  <h3>{group.label}</h3>
                  <div className="mobile-more-items">
                    {groupItems.map(({ to, label, icon: Icon }) => (
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
              );
            })}
          </div>
        </section>
      </dialog>

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
            {visibleQuickActions.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={closeQuickMenu}>
                <Icon size={22} weight="duotone" />
                <span>{label}</span>
                <ArrowRight size={18} />
              </NavLink>
            ))}
          </nav>
        </section>
      </dialog>

      <div className="content-frame">
        <header className="topbar">
          <div className="topbar-context">
            <SquaresFour size={22} weight="duotone" />
            <span>
              <small>{routeSection}</small>
              <strong>{routeTitle}</strong>
            </span>
          </div>

          <div className="topbar-actions">
            {visibleQuickActions.length > 0 && (
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
