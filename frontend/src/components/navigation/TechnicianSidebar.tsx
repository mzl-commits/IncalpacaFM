import { SignOut } from "@phosphor-icons/react";
import { NavLink } from "react-router-dom";
import { BrandLogo } from "@/components/shared/BrandLogo";
import type { NavItem } from "@/components/navigation/navData";
import type { SystemUser } from "@/modules/accounts/types";

interface TechnicianSidebarProps {
  navigation: NavItem[];
  initials: string;
  user: SystemUser;
  onLogout: () => void;
}

/**
 * TechnicianSidebar
 * Sidebar vertical simple usado por roles TECNICO y USUARIO.
 * Muestra logo, links de navegación, perfil y botón de cierre de sesión.
 */
export function TechnicianSidebar({ navigation, initials, user, onLogout }: TechnicianSidebarProps) {
  const roleLabel = user.role === "USUARIO" ? "Mis solicitudes" : "Mi trabajo";
  const profileLabel = user.role === "USUARIO" ? "Usuario" : "Técnico";

  return (
    <aside className="technician-sidebar" aria-label="Navegación del técnico">
      <div className="technician-sidebar-brand">
        <BrandLogo size={36} variant="light" />
        <span>
          <strong>FM Incalpaca</strong>
          <small>{roleLabel}</small>
        </span>
      </div>

      <nav className="technician-sidebar-nav" aria-label={roleLabel}>
        {navigation.map(({ to, label, icon: Icon, end, count }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `technician-sidebar-link ${isActive ? "is-active" : ""}`}
          >
            <Icon size={20} weight="duotone" />
            <span>{label}</span>
            {count !== undefined && <small>{count}</small>}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/perfil" className="technician-sidebar-profile">
        <span>{initials}</span>
        <div>
          <strong>{user.fullName}</strong>
          <small>{profileLabel}</small>
        </div>
      </NavLink>

      <button className="technician-sidebar-logout" type="button" onClick={onLogout}>
        <SignOut size={18} />
        Cerrar sesión
      </button>
    </aside>
  );
}
