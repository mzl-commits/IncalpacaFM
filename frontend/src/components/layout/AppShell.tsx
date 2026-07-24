import {
  Archive,
  Bell,
  ClipboardText,
  FileText,
  House,
  ListChecks,
  ListDashes,
  SquaresFour,
  Package,
  QrCode,
  ShieldCheck,
  SignOut,
  Toolbox,
  UserCircle,
  Wrench,
} from "@phosphor-icons/react";
import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  { to: "/bienes/entradas", label: "Entrada de bienes", icon: Package },
  { to: "/bienes/qr", label: "Gestión de QR", icon: QrCode },
  { to: "/asignaciones", label: "Asignaciones", icon: ClipboardText },
  { to: "/mantenimiento", label: "Mantenimiento", icon: Wrench },
  { to: "/incidencias", label: "Incidencias", icon: ListChecks },
  { to: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Toolbox },
  { to: "/ciclo-vida", label: "Ciclo de vida", icon: Archive },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/auditoria", label: "Auditoría", icon: ShieldCheck },
];

export function AppShell() {
  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <span className="brand-mark">SG</span>
          <span>
            <strong>SGTB</strong>
            <small>Incalpaca</small>
          </span>
        </div>

        <nav className="nav-list">
          <NavLink to="/" className="nav-item">
            <House size={20} weight="duotone" />
            Inicio
          </NavLink>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={`${to}-${label}`}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? "is-active" : ""}`}
            >
              <Icon size={20} weight="duotone" />
              {label}
            </NavLink>
          ))}
        </nav>

        <button className="sidebar-account" type="button">
          <UserCircle size={34} weight="duotone" />
          <span>
            <strong>Facility Management</strong>
            <small>Administrador</small>
          </span>
          <SignOut size={18} />
        </button>
      </aside>

      <div className="content-frame">
        <header className="topbar">
          <div className="mobile-topbar-title"><SquaresFour size={22} /><p className="eyebrow">SGTB Incalpaca</p></div>
          <div className="topbar-actions"><button className="icon-button" type="button" aria-label="Notificaciones"><Bell size={20} /><span className="notification-dot" aria-label="3 notificaciones" /></button><UserCircle size={26} weight="duotone" /></div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
