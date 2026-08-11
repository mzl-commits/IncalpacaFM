import { Barcode, MapTrifold, Tag, TreeStructure } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";

export function TaxonomySectionNav() {
  const { pathname } = useLocation();
  const codesActive = pathname.startsWith("/administracion/taxonomia/codigos");
  const mapActive = pathname.startsWith("/administracion/taxonomia/mapa");
  const modelsActive = pathname.startsWith("/administracion/modelos");
  const classificationsActive = !codesActive && !mapActive && !modelsActive;

  return (
    <nav className="taxonomy-section-nav" aria-label="Secciones de taxonomía">
      <Link
        className={classificationsActive ? "is-active" : ""}
        to="/administracion/taxonomia"
        aria-current={classificationsActive ? "page" : undefined}
      >
        <TreeStructure size={19} weight="duotone" />
        <span>
          <strong>Clasificaciones</strong>
          <small>Prefijos y reglas</small>
        </span>
      </Link>
      <Link
        className={codesActive ? "is-active" : ""}
        to="/administracion/taxonomia/codigos"
        aria-current={codesActive ? "page" : undefined}
      >
        <Barcode size={19} weight="duotone" />
        <span>
          <strong>Códigos FM</strong>
          <small>Emisión y consulta</small>
        </span>
      </Link>
      <Link
        className={mapActive ? "is-active" : ""}
        to="/administracion/taxonomia/mapa"
        aria-current={mapActive ? "page" : undefined}
      >
        <MapTrifold size={19} weight="duotone" />
        <span>
          <strong>Mapa de bienes</strong>
          <small>Plano y conciliación</small>
        </span>
      </Link>
      <Link
        className={modelsActive ? "is-active" : ""}
        to="/administracion/modelos"
        aria-current={modelsActive ? "page" : undefined}
      >
        <Tag size={19} weight="duotone" />
        <span>
          <strong>Modelos</strong>
          <small>Marcas y referencias</small>
        </span>
      </Link>
    </nav>
  );
}
