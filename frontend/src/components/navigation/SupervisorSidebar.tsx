import { SignOut } from "@phosphor-icons/react";
import { NavLink } from "react-router-dom";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { compactSupervisorLabel, type NavItem } from "@/components/navigation/navData";

interface SupervisorSidebarProps {
  navigation: NavItem[];
  initials: string;
  onLogout: () => void;
}

/**
 * SupervisorSidebar
 * Rail compacto de iconos usado por el rol SUPERVISOR.
 * Sin flyout — muestra iconos con etiqueta corta.
 */
export function SupervisorSidebar({ navigation, initials, onLogout }: SupervisorSidebarProps) {
  return (
    <aside
      className="sidebar-rail-narrow supervisor-compact-rail"
      aria-label="Navegación del supervisor"
    >
      <div className="rail-logo-wrap">
        <BrandLogo size={36} variant="light" />
      </div>

      <nav className="rail-vertical-nav">
        {navigation.map(({ to, label, icon: Icon, end, count }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) => `rail-circle-option ${isActive ? "is-active" : ""}`}
          >
            <span className="circle-btn">
              <Icon size={21} weight="duotone" />
            </span>
            <span className="circle-label">{compactSupervisorLabel(to, label)}</span>
            {count !== undefined && <small className="supervisor-rail-badge">{count}</small>}
          </NavLink>
        ))}
      </nav>

      <div className="rail-bottom-actions">
        <NavLink
          to="/perfil"
          title="Mi perfil"
          aria-label="Mi perfil"
          className="rail-circle-option supervisor-profile-option"
        >
          <span className="circle-btn">{initials}</span>
          <span className="circle-label">Perfil</span>
        </NavLink>

        <button
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="rail-circle-option logout-circle-option"
          onClick={onLogout}
        >
          <span className="circle-btn">
            <SignOut size={19} />
          </span>
          <span className="circle-label">Salir</span>
        </button>
      </div>
    </aside>
  );
}
