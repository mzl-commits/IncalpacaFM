import { MapPin, QrCode, SquaresFour, Tag } from "@phosphor-icons/react";
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
        <SquaresFour size={19} weight="bold" />
        <span>Clasificaciones</span>
      </Link>
      <Link
        className={codesActive ? "is-active" : ""}
        to="/administracion/taxonomia/codigos"
        aria-current={codesActive ? "page" : undefined}
      >
        <QrCode size={19} weight="bold" />
        <span>Códigos FM</span>
      </Link>
      <Link
        className={mapActive ? "is-active" : ""}
        to="/administracion/taxonomia/mapa"
        aria-current={mapActive ? "page" : undefined}
      >
        <MapPin size={19} weight="bold" />
        <span>Mapa de bienes</span>
      </Link>
      <Link
        className={modelsActive ? "is-active" : ""}
        to="/administracion/modelos"
        aria-current={modelsActive ? "page" : undefined}
      >
        <Tag size={19} weight="bold" />
        <span>Modelos</span>
      </Link>
    </nav>
  );
}
