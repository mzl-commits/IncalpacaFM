import { CaretLeft, GearSix, SignOut, Toolbox } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { isGroupActive, type ModuleGroup } from "@/components/navigation/navData";
import type { SystemUser } from "@/modules/accounts/types";

interface AdminSidebarProps {
  /** Módulos visibles para el rol actual (ya filtrados) */
  roleModules: ModuleGroup[];
  /** Módulo de configuración (GearSix), mostrado en la parte inferior del rail */
  configModule: ModuleGroup | undefined;
  /** ID del módulo activo según la ruta actual */
  matchedModuleId: string;
  /** Iniciales del usuario para el avatar */
  initials: string;
  /** Etiqueta de rol para mostrar en el footer del flyout */
  roleLabel: string;
  user: SystemUser;
  onLogout: () => void;
}

/**
 * AdminSidebar
 * Rail de dos niveles con flyout para el rol ADMINISTRADOR (y similares).
 * Gestiona internamente su propio estado de flyout (abierto/cerrado, módulo activo).
 * Se cierra automáticamente al hacer click fuera o presionar Escape.
 */
export function AdminSidebar({
  roleModules,
  configModule,
  matchedModuleId,
  initials,
  roleLabel,
  user,
  onLogout,
}: AdminSidebarProps) {
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);

  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [activeFlyoutModuleId, setActiveFlyoutModuleId] = useState(matchedModuleId);

  const railModules = roleModules.filter((mod) => mod.id !== "administration");
  const activeFlyoutModule =
    roleModules.find((mod) => mod.id === activeFlyoutModuleId) ?? roleModules[0];

  // Sync active module when route changes (and flyout is closed)
  useEffect(() => {
    const matched = roleModules.find((mod) => isGroupActive(location.pathname, mod.paths));
    if (matched && !flyoutOpen) setActiveFlyoutModuleId(matched.id);
  }, [location.pathname, roleModules, flyoutOpen]);

  // Close flyout when clicking outside the sidebar
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (flyoutOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setFlyoutOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setFlyoutOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [flyoutOpen]);

  function toggleModule(module: ModuleGroup) {
    if (activeFlyoutModuleId === module.id && flyoutOpen) {
      setFlyoutOpen(false);
    } else {
      setActiveFlyoutModuleId(module.id);
      setFlyoutOpen(true);
    }
  }

  const activeRailId = flyoutOpen ? activeFlyoutModuleId : matchedModuleId;

  return (
    <aside ref={sidebarRef} className="two-level-sidebar-overlay" aria-label="Navegación principal">
      {/* ── LEVEL 1: Narrow icon rail ─────────────────────────────────────── */}
      <div className="sidebar-rail-narrow">
        <div className="rail-logo-wrap">
          <BrandLogo size={36} variant="light" />
        </div>

        <nav className="rail-vertical-nav">
          {railModules.map((module) => {
            const isActive = activeRailId === module.id;
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                type="button"
                aria-label={module.label}
                title={module.label}
                className={`rail-circle-option ${isActive ? "is-active" : ""}`}
                onClick={() => toggleModule(module)}
              >
                <div className="circle-btn">
                  <Icon size={21} weight={isActive ? "bold" : "duotone"} />
                </div>
                <span className="circle-label">{module.shortLabel}</span>
              </button>
            );
          })}

          {/* Almacén — link directo (no flyout) */}
          {(["ADMINISTRADOR", "ALMACENERO", "INSPECTOR"] as const).includes(
            user.role as "ADMINISTRADOR" | "ALMACENERO" | "INSPECTOR",
          ) && (
            <NavLink
              to="/almacen"
              title="Almacén"
              aria-label="Almacén de herramientas"
              className={({ isActive }) =>
                `rail-circle-option ${isActive || location.pathname.startsWith("/almacen") ? "is-active" : ""}`
              }
              onClick={() => setFlyoutOpen(false)}
            >
              <div className="circle-btn">
                <Toolbox
                  size={21}
                  weight={location.pathname.startsWith("/almacen") ? "bold" : "duotone"}
                />
              </div>
              <span className="circle-label">Almacén</span>
            </NavLink>
          )}
        </nav>

        <div className="rail-bottom-actions">
          {configModule && (
            <button
              type="button"
              aria-label="Configuración"
              title="Configuración"
              className={`rail-circle-option ${activeRailId === "administration" ? "is-active" : ""}`}
              onClick={() => toggleModule(configModule)}
            >
              <div className="circle-btn">
                <GearSix size={21} weight="duotone" />
              </div>
              <span className="circle-label">Configuración</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="rail-circle-option logout-circle-option"
            onClick={onLogout}
          >
            <div className="circle-btn">
              <SignOut size={19} />
            </div>
            <span className="circle-label">Salir</span>
          </button>
        </div>
      </div>

      {/* ── LEVEL 2: Flyout panel ─────────────────────────────────────────── */}
      {flyoutOpen && activeFlyoutModule && (
        <div
          className="sidebar-flyout-panel"
          role="region"
          aria-label={`Submenú ${activeFlyoutModule.label}`}
        >
          <header className="flyout-header">
            <div>
              <span className="flyout-context-label">Módulo</span>
              <h2 className="flyout-title">{activeFlyoutModule.label}</h2>
            </div>
            <button
              type="button"
              className="flyout-close-btn"
              onClick={() => setFlyoutOpen(false)}
              aria-label="Cerrar menú"
            >
              <CaretLeft size={18} />
            </button>
          </header>

          <nav className="flyout-nav-list">
            {activeFlyoutModule.items.map(({ to, label, icon: Icon, end, count }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setFlyoutOpen(false)}
                className={({ isActive }) => `flyout-item ${isActive ? "is-active" : ""}`}
              >
                <Icon size={19} weight="duotone" />
                <span>{label}</span>
                {count !== undefined && <span className="flyout-badge">{count}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="flyout-footer">
            <div className="flyout-user-card">
              <div className="user-avatar-circle">{initials}</div>
              <div className="user-meta">
                <strong>{user.fullName}</strong>
                <small>{roleLabel}</small>
              </div>
              <button
                type="button"
                className="user-logout-btn"
                onClick={onLogout}
                title="Cerrar sesión"
              >
                <SignOut size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
