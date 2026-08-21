import { CaretRight, House } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";

type RouteCrumb = { label: string; to?: string };

const routeMap: Array<{ match: RegExp; crumbs: RouteCrumb[] }> = [
  { match: /^\/$/, crumbs: [{ label: "Inicio" }] },
  { match: /^\/bienes\/entradas\/nueva$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Entradas", to: "/bienes/entradas" }, { label: "Nueva entrada" }] },
  { match: /^\/bienes\/entradas$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Entradas" }] },
  { match: /^\/bienes\/qr$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Códigos QR" }] },
  { match: /^\/bienes\/ciclo-vida\/bajas\/nueva\//, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Ciclo de vida", to: "/bienes/ciclo-vida/bajas" }, { label: "Nueva solicitud de baja" }] },
  { match: /^\/bienes\/ciclo-vida\/bajas\/[^/]+\/disposicion$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Ciclo de vida", to: "/bienes/ciclo-vida/bajas" }, { label: "Disposición final" }] },
  { match: /^\/bienes\/ciclo-vida\/bajas\/[^/]+$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Ciclo de vida", to: "/bienes/ciclo-vida/bajas" }, { label: "Evaluación de baja" }] },
  { match: /^\/bienes\/ciclo-vida/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Ciclo de vida" }] },
  { match: /^\/bienes\/[^/]+$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Ficha del bien" }] },
  { match: /^\/bienes$/, crumbs: [{ label: "Activos" }] },
  { match: /^\/mapa$/, crumbs: [{ label: "Mapa" }] },
  { match: /^\/asignaciones\/nueva$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Asignaciones", to: "/asignaciones" }, { label: "Nueva asignación" }] },
  { match: /^\/asignaciones\/[^/]+$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Asignaciones", to: "/asignaciones" }, { label: "Detalle" }] },
  { match: /^\/asignaciones$/, crumbs: [{ label: "Activos", to: "/bienes" }, { label: "Asignaciones" }] },
  { match: /^\/incidencias\/nueva$/, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Solicitudes", to: "/incidencias" }, { label: "Nueva solicitud" }] },
  { match: /^\/incidencias\/[^/]+$/, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Solicitudes", to: "/incidencias" }, { label: "Detalle" }] },
  { match: /^\/incidencias$/, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Solicitudes" }] },
  { match: /^\/ordenes-trabajo\/[^/]+\/diagnostico$/, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Órdenes operativas", to: "/ordenes-trabajo" }, { label: "Diagnóstico" }] },
  { match: /^\/ordenes-trabajo\/[^/]+\/ejecutar$/, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Órdenes operativas", to: "/ordenes-trabajo" }, { label: "Ejecución" }] },
  { match: /^\/ordenes-trabajo\/nueva\//, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Órdenes operativas", to: "/ordenes-trabajo" }, { label: "Nueva orden" }] },
  { match: /^\/ordenes-trabajo\/[^/]+$/, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Órdenes operativas", to: "/ordenes-trabajo" }, { label: "Detalle" }] },
  { match: /^\/ordenes-trabajo$/, crumbs: [{ label: "Órdenes de trabajo" }, { label: "Órdenes operativas" }] },
  { match: /^\/informes$/, crumbs: [{ label: "Informes" }] },
  { match: /^\/documentos$/, crumbs: [{ label: "Gestión" }, { label: "Documentos" }] },
  { match: /^\/auditoria$/, crumbs: [{ label: "Gestión" }, { label: "Auditoría" }] },
  { match: /^\/administracion\/mapas-ambientes$/, crumbs: [{ label: "Gestión" }, { label: "Mapas de ambientes" }] },
  { match: /^\/administracion\/espacios\/nuevo$/, crumbs: [{ label: "Gestión" }, { label: "Espacios y ambientes", to: "/administracion/espacios" }, { label: "Nuevo" }] },
  { match: /^\/administracion\/espacios\/[^/]+\/editar$/, crumbs: [{ label: "Gestión" }, { label: "Espacios y ambientes", to: "/administracion/espacios" }, { label: "Editar" }] },
  { match: /^\/administracion\/espacios\/[^/]+$/, crumbs: [{ label: "Gestión" }, { label: "Espacios y ambientes", to: "/administracion/espacios" }, { label: "Detalle" }] },
  { match: /^\/administracion\/espacios$/, crumbs: [{ label: "Gestión" }, { label: "Espacios y ambientes" }] },
  { match: /^\/administracion\/taxonomia\/codigos\/nuevo$/, crumbs: [{ label: "Gestión" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Códigos FM", to: "/administracion/taxonomia/codigos" }, { label: "Asignar código" }] },
  { match: /^\/administracion\/taxonomia\/codigos$/, crumbs: [{ label: "Gestión" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Códigos FM" }] },
  { match: /^\/administracion\/taxonomia\/mapa$/, crumbs: [{ label: "Gestión" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Plano importado" }] },
  { match: /^\/administracion\/taxonomia\/nueva$/, crumbs: [{ label: "Gestión" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Nueva categoría" }] },
  { match: /^\/administracion\/taxonomia\/[^/]+\/editar$/, crumbs: [{ label: "Gestión" }, { label: "Taxonomía", to: "/administracion/taxonomia" }, { label: "Editar categoría" }] },
  { match: /^\/administracion\/taxonomia$/, crumbs: [{ label: "Gestión" }, { label: "Taxonomía" }] },
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
