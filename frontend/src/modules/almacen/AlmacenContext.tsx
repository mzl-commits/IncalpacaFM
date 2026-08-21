import { createContext, useContext } from "react";
import { useParams, Navigate, Outlet, NavLink, Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarBlank,
  CalendarPlus,
  CaretLeft,
  ClipboardText,
  Files,
  ListChecks,
  ListDashes,
} from "@phosphor-icons/react";

import { useAuth } from "@/modules/accounts/AuthContext";
import type { UserRole } from "@/modules/accounts/types";
import { getAlmacen } from "@/modules/almacen/catalogoRepository";
import type { Almacen } from "@/modules/almacen/types";
import { useQuery } from "@tanstack/react-query";

interface AlmacenContextValue {
  almacenId: number;
  almacen: Almacen | undefined;
  puedeEditarCroquis: boolean;
}

const AlmacenContext = createContext<AlmacenContextValue | null>(null);

export function useAlmacenActivo(): AlmacenContextValue {
  const ctx = useContext(AlmacenContext);
  if (!ctx) {
    throw new Error("useAlmacenActivo debe usarse dentro de AlmacenLayout");
  }
  return ctx;
}

type SubNavItem = {
  to: string;
  label: string;
  icon: typeof ListDashes;
  end?: boolean;
  itemRoles?: UserRole[];
};

/* Mismo criterio de roles que tenía el grupo "almacen" en AppShell.tsx,
   ahora vive acá porque la navegación entre secciones es *dentro* de un
   almacén activo, no un menú lateral global. */
function buildSubNavItems(almacenId: number): SubNavItem[] {
  const base = `/almacen/${almacenId}`;
  return [
    { to: `${base}/catalogo`, label: "Catálogo", icon: ListDashes, end: true },
    { to: `${base}/movimientos`, label: "Movimientos", icon: ArrowRight, itemRoles: ["ADMINISTRADOR", "ALMACENERO"] },
    { to: `${base}/checklist`, label: "Devolución", icon: ListChecks, itemRoles: ["ADMINISTRADOR", "ALMACENERO"] },
    { to: `${base}/inspecciones`, label: "Inspecciones", icon: ClipboardText, itemRoles: ["ADMINISTRADOR", "INSPECTOR"] },
    { to: `${base}/plantillas`, label: "Plantillas SST", icon: Files, itemRoles: ["ADMINISTRADOR", "INSPECTOR"] },
    { to: `${base}/calendario`, label: "Calendario", icon: CalendarBlank, itemRoles: ["ADMINISTRADOR", "INSPECTOR"] },
    { to: `${base}/plan-anual`, label: "Plan anual", icon: CalendarPlus, itemRoles: ["ADMINISTRADOR", "INSPECTOR"] },
  ];
}

function AlmacenSubNav({ almacenId }: { almacenId: number }) {
  const { user } = useAuth();
  const items = buildSubNavItems(almacenId).filter(
    (item) => !item.itemRoles || (user && item.itemRoles.includes(user.role)),
  );

  return (
    <nav className="almacen-subnav" aria-label="Navegación del almacén">
      <Link to="/almacen" className="almacen-subnav-back" title="Volver a Almacenes">
        <CaretLeft size={16} />
      </Link>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `almacen-subnav-item ${isActive ? "is-active" : ""}`}
        >
          <Icon size={17} weight="duotone" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Layout de ruta: lee :almacenId de la URL, lo valida, lo expone via contexto
 * a todas las páginas hijas (Catálogo, Movimientos, Inspecciones, etc.) y
 * renderiza el submenú de navegación entre esas secciones. */

export function AlmacenLayout() {
  const { almacenId } = useParams<{ almacenId: string }>();
  const id = Number(almacenId);
  const { user } = useAuth();

  const { data: almacen } = useQuery({
    queryKey: ["almacen-detalle", id],
    queryFn: () => getAlmacen(id),
    enabled: !Number.isNaN(id),
  });

  if (!almacenId || Number.isNaN(id)) {
    return <Navigate to="/almacen" replace />;
  }

  const puedeEditarCroquis =
    user?.role === "ADMINISTRADOR" ||
    (user?.role === "ALMACENERO" && user.almacenId === id);

  return (
    <AlmacenContext.Provider value={{ almacenId: id, almacen, puedeEditarCroquis }}>
      <AlmacenSubNav almacenId={id} />
      <Outlet key={id} />
    </AlmacenContext.Provider>
  );
}