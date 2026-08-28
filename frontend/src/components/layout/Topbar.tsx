import { Lightning, Plus, SquaresFour } from "@phosphor-icons/react";
import { NavLink } from "react-router-dom";
import { NotificationCenter } from "@/modules/notifications/components/NotificationCenter";

interface TopbarProps {
  routeSection: string;
  routeTitle: string;
  initials: string;
  fullName: string | undefined;
  roleLabel: string;
  hasQuickActions: boolean;
  onOpenQuickMenu: () => void;
}

/**
 * Topbar
 * Barra superior sticky que muestra el contexto de ruta actual,
 * acciones rápidas, notificaciones y acceso al perfil de usuario.
 */
export function Topbar({
  routeSection,
  routeTitle,
  initials,
  fullName,
  roleLabel,
  hasQuickActions,
  onOpenQuickMenu,
}: TopbarProps) {
  return (
    <header className="topbar">
      {/* Contexto de ruta actual */}
      <div className="topbar-context">
        <SquaresFour size={22} weight="duotone" />
        <span>
          <small>{routeSection}</small>
          <strong>{routeTitle}</strong>
        </span>
      </div>

      {/* Acciones a la derecha */}
      <div className="topbar-actions">
        {hasQuickActions && (
          <button
            className="topbar-quick-action"
            type="button"
            onClick={onOpenQuickMenu}
          >
            <Lightning size={18} weight="fill" />
            <span>Nueva acción</span>
            <Plus size={16} weight="bold" />
          </button>
        )}

        <NotificationCenter />

        <NavLink
          to="/perfil"
          className="topbar-user topbar-user-link"
          aria-label="Abrir mi perfil"
        >
          <span>{initials}</span>
          <div>
            <strong>{fullName}</strong>
            <small>{roleLabel}</small>
          </div>
        </NavLink>
      </div>
    </header>
  );
}
