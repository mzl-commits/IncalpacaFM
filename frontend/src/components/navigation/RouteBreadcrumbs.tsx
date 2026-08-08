import { CaretRight, House } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";

type RouteCrumb = { label: string; to?: string };

const routeMap: Array<{ match: RegExp; crumbs: RouteCrumb[] }> = [
  { match: /^\/$/, crumbs: [{ label: "Inicio" }] },
  { match: /^\/bienes\/entradas\/nueva$/, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Entradas", to: "/bienes/entradas" }, { label: "Nueva entrada" }] },
  { match: /^\/bienes\/entradas$/, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Entradas" }] },
  { match: /^\/bienes\/qr$/, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Códigos QR" }] },
  { match: /^\/bienes\/ciclo-vida\/bajas\/nueva\//, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Ciclo de vida", to: "/bienes/ciclo-vida/bajas" }, { label: "Nueva solicitud de baja" }] },
  { match: /^\/bienes\/ciclo-vida\/bajas\/[^/]+\/disposicion$/, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Ciclo de vida", to: "/bienes/ciclo-vida/bajas" }, { label: "Disposición final" }] },
  { match: /^\/bienes\/ciclo-vida\/bajas\/[^/]+$/, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Ciclo de vida", to: "/bienes/ciclo-vida/bajas" }, { label: "Evaluación de baja" }] },
  { match: /^\/bienes\/ciclo-vida/, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Ciclo de vida" }] },
  { match: /^\/bienes\/[^/]+$/, crumbs: [{ label: "Bienes", to: "/bienes" }, { label: "Ficha del bien" }] },
  { match: /^\/bienes$/, crumbs: [{ label: "Bienes" }] },
  { match: /^\/mapa$/, crumbs: [{ label: "Mapa" }] },
  { match: /^\/asignaciones\/nueva$/, crumbs: [{ label: "Asignaciones", to: "/asignaciones" }, { label: "Nueva asignación" }] },
  { match: /^\/asignaciones\/[^/]+$/, crumbs: [{ label: "Asignaciones", to: "/asignaciones" }, { label: "Detalle" }] },
  { match: /^\/asignaciones$/, crumbs: [{ label: "Asignaciones" }] },
  { match: /^\/incidencias\/nueva$/, crumbs: [{ label: "Mantenimiento" }, { label: "Solicitudes", to: "/incidencias" }, { label: "Nueva solicitud" }] },
  { match: /^\/incidencias\/[^/]+$/, crumbs: [{ label: "Mantenimiento" }, { label: "Solicitudes", to: "/incidencias" }, { label: "Detalle" }] },
  { match: /^\/incidencias$/, crumbs: [{ label: "Mantenimiento" }, { label: "Solicitudes" }] },
  { match: /^\/ordenes-trabajo\/[^/]+\/diagnostico$/, crumbs: [{ label: "Mantenimiento" }, { label: "Órdenes de trabajo", to: "/ordenes-trabajo" }, { label: "Diagnóstico" }] },
  { match: /^\/ordenes-trabajo\/[^/]+\/ejecutar$/, crumbs: [{ label: "Mantenimiento" }, { label: "Órdenes de trabajo", to: "/ordenes-trabajo" }, { label: "Ejecución" }] },
  { match: /^\/ordenes-trabajo\/nueva\//, crumbs: [{ label: "Mantenimiento" }, { label: "Órdenes de trabajo", to: "/ordenes-trabajo" }, { label: "Nueva orden" }] },
  { match: /^\/ordenes-trabajo\/[^/]+$/, crumbs: [{ label: "Mantenimiento" }, { label: "Órdenes de trabajo", to: "/ordenes-trabajo" }, { label: "Detalle" }] },
  { match: /^\/ordenes-trabajo$/, crumbs: [{ label: "Mantenimiento" }, { label: "Órdenes de trabajo" }] },
  { match: /^\/informes$/, crumbs: [{ label: "Informes" }] },
  { match: /^\/documentos$/, crumbs: [{ label: "Administración" }, { label: "Documentos" }] },
  { match: /^\/auditoria$/, crumbs: [{ label: "Administración" }, { label: "Auditoría" }] },
  { match: /^\/administracion\/mapas-ambientes$/, crumbs: [{ label: "Administración" }, { label: "Mapas de ambientes" }] },
  { match: /^\/administracion\/taxonomia\/codigos\/nuevo$/, crumbs: [{ label: "Administración" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Códigos FM", to: "/administracion/taxonomia/codigos" }, { label: "Asignar código" }] },
  { match: /^\/administracion\/taxonomia\/codigos$/, crumbs: [{ label: "Administración" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Códigos FM" }] },
  { match: /^\/administracion\/taxonomia\/mapa$/, crumbs: [{ label: "Administración" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Plano importado" }] },
  { match: /^\/administracion\/taxonomia\/nueva$/, crumbs: [{ label: "Administración" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Nueva categoría" }] },
  { match: /^\/administracion\/taxonomia\/[^/]+\/editar$/, crumbs: [{ label: "Administración" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Editar categoría" }] },
  { match: /^\/administracion\/taxonomia$/, crumbs: [{ label: "Administración" }, { label: "Taxonomía" }] },
];

export function RouteBreadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = routeMap.find((route) => route.match.test(pathname))?.crumbs ?? [{ label: "FM Incalpaca" }];
  const entries: RouteCrumb[] = pathname === "/" ? crumbs : [{ label: "Inicio", to: "/" }, ...crumbs];

  return (
    <nav className="route-breadcrumbs" aria-label="Ruta de navegación">
      <ol>
        {entries.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`}>
            {index > 0 && <CaretRight aria-hidden="true" size={13} weight="bold" />}
            {crumb.to ? (
              <Link to={crumb.to}>{index === 0 && <House aria-hidden="true" size={14} />}<span>{crumb.label}</span></Link>
            ) : (
              <span aria-current="page">{index === 0 && <House aria-hidden="true" size={14} />}<span>{crumb.label}</span></span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
