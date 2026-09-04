/**
 * navData.ts
 * Pure navigation data and helper functions — no React, no side-effects.
 * Import from here in any component that needs menu structure or route helpers.
 */

import type { SystemUser, UserRole } from "@/modules/accounts/types";
import type { WorkRequest } from "@/modules/incidents/types";
import type { WorkOrder } from "@/modules/workorders/types";
import {
  Barcode,
  Buildings,
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  ClipboardText,
  Files,
  GearSix,
  House,
  ListChecks,
  ListDashes,
  MapTrifold,
  Package,
  ShieldCheck,
  SquaresFour,
  Tag,
  Toolbox,
  TreeStructure,
  UserCircle,
  UserPlus,
  UsersThree,
  WarningDiamond,
  Warehouse,
  Wrench,
} from "@phosphor-icons/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavItem = {
  to: string;
  label: string;
  icon: typeof House;
  end?: boolean;
  count?: string | number;
  roles?: UserRole[];
};

export type ModuleGroup = {
  id: string;
  label: string;
  shortLabel: string;
  icon: typeof House;
  paths: string[];
  roles?: UserRole[];
  items: NavItem[];
};

export type MenuCounts = Partial<Record<string, number>>;

// ─── Navigation data ──────────────────────────────────────────────────────────

export const modules: ModuleGroup[] = [
  {
    id: "work_orders",
    label: "Órdenes de trabajo",
    shortLabel: "OTs",
    icon: Wrench,
    paths: ["/", "/incidencias", "/ordenes-trabajo", "/mi-jornada", "/mantenimiento"],
    roles: ["ADMINISTRADOR", "TECNICO", "USUARIO", "SUPERVISOR"],
    items: [
      { to: "/incidencias", label: "Bandeja de reportes", icon: ListChecks, end: true, roles: ["ADMINISTRADOR", "TECNICO"] },
      { to: "/mantenimiento/panel", label: "Panel operativo", icon: SquaresFour, roles: ["ADMINISTRADOR", "TECNICO"] },
      { to: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Toolbox, roles: ["ADMINISTRADOR", "TECNICO"] },
      { to: "/mi-jornada", label: "Mi jornada", icon: CalendarBlank, roles: ["TECNICO"] },

      { to: "/", label: "Inicio", icon: House, end: true, roles: ["USUARIO"] },
      
      { to: "/incidencias", label: "Mis solicitudes", icon: ListChecks, roles: ["USUARIO"] },

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
    paths: ["/administracion/taxonomia", "/administracion/espacios", "/administracion/usuarios", "/administracion/tecnicos"],
    roles: ["ADMINISTRADOR"],
    items: [
      { to: "/administracion/taxonomia", label: "Clasificación", icon: TreeStructure, end: true },
      { to: "/administracion/espacios", label: "Espacios y ambientes", icon: Buildings },
      { to: "/administracion/usuarios", label: "Usuarios", icon: UserCircle },
      { to: "/administracion/tecnicos", label: "Técnicos", icon: UsersThree },
      { to: "/administracion/taxonomia/codigos", label: "Directorio de espacios", icon: Tag },
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

export const mobilePrimary: NavItem[] = [
  { to: "/incidencias", label: "Órdenes", icon: ListChecks, end: false },
  { to: "/bienes", label: "Activos", icon: Package, end: false },
  { to: "/administracion/taxonomia", label: "Gestión", icon: TreeStructure, end: false },
  { to: "/almacen/catalogo", label: "Almacén", icon: Warehouse, end: false },
];

export const quickActions: NavItem[] = [
  { to: "/bienes/entradas/nueva", label: "Registrar un bien", icon: Package },
  { to: "/asignaciones/nueva", label: "Crear una asignación", icon: UserPlus },
  
  { to: "/informes", label: "Abrir informes", icon: ChartLineUp },
];

// ─── Pure helper functions ────────────────────────────────────────────────────

export function isGroupActive(pathname: string, paths: string[]): boolean {
  if (pathname === "/" && paths.includes("/")) return true;
  if (pathname !== "/" && paths.includes("/")) return false;
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function compactSupervisorLabel(path: string, label: string): string {
  if (path === "/") return "Inicio";
  if (path === "/incidencias") return "Reportes";
  if (path === "/ordenes-trabajo") return "Órdenes";
  if (path === "/mi-jornada") return "Jornada";
  return label;
}

export function getRouteContext(pathname: string): [string, string] {
  if (pathname === "/") return ["Órdenes de trabajo", "Panel operativo"];
  if (pathname.startsWith("/mi-perfil")) return ["Usuario", "Inicio"];
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

export function countMenuActions(
  user: SystemUser,
  requests: WorkRequest[],
  orders: WorkOrder[],
): MenuCounts {
  const withBadge = (path: string, count: number): MenuCounts =>
    count > 0 ? { [path]: count } : {};

  if (user.role === "ADMINISTRADOR") {
    const pendingRequests = requests.filter((r) => r.status === "PENDIENTE").length;
    const adminOrders = orders.filter((o) =>
      ["PENDIENTE_REPROGRAMACION", "PENDIENTE_DE_VALIDACION"].includes(o.status),
    ).length;
    return { ...withBadge("/incidencias", pendingRequests), ...withBadge("/ordenes-trabajo", adminOrders) };
  }

  if (user.role === "SUPERVISOR") {
    const reviewQueue = orders.filter(
      (o) =>
        o.status === "PENDIENTE_DE_SUPERVISION" &&
        (o.supervisorId === user.id || o.supervisorName === user.fullName),
    ).length;
    return withBadge("/", reviewQueue);
  }

  if (user.role === "TECNICO") {
    const activeWork = orders.filter(
      (o) =>
        o.operatorId === user.id &&
        ["PROGRAMADA", "ASIGNADA", "EN_PROCESO", "DEVUELTA", "REPROCESO"].includes(o.status),
    ).length;
    return withBadge("/ordenes-trabajo", activeWork);
  }

  return {};
}

export function itemsForRole(
  items: NavItem[],
  user: SystemUser | null | undefined,
): NavItem[] {
  const allowed = items.filter((item) => !item.roles || Boolean(user && item.roles.includes(user.role)));
  if (user?.role === "TECNICO") {
    return allowed.filter((item) => ["/", "/ordenes-trabajo", "/mi-jornada"].includes(item.to));
  }
  if (user?.role === "SUPERVISOR") {
    return allowed.filter((item) => item.to === "/");
  }
  return allowed;
}

export function getRoleLabel(role: UserRole | undefined): string {
  switch (role) {
    case "TECNICO": return "Técnico";
    case "SUPERVISOR": return "Supervisor";
    case "ALMACENERO": return "Almacenero";
    case "INSPECTOR": return "Inspector";
    case "USUARIO": return "Usuario";
    default: return "Administrador / Planner";
  }
}

export function getInitials(fullName: string | undefined): string {
  if (!fullName) return "SG";
  return fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
