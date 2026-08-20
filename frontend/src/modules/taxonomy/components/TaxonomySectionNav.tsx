import { Buildings, QrCode, SquaresFour, Tag } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";

export function TaxonomySectionNav() {
  const { pathname } = useLocation();
  const spacesActive = pathname.startsWith("/administracion/espacios");
  const codesActive = pathname.startsWith("/administracion/taxonomia/codigos");
  const modelsActive = pathname.startsWith("/administracion/modelos");
  const classificationsActive =
    pathname.startsWith("/administracion/taxonomia") && !codesActive;

  return (
    <nav className="taxonomy-section-nav" aria-label="Estructuras y catálogos de administración">
      <Link
        className={spacesActive ? "is-active" : ""}
        to="/administracion/espacios"
        aria-current={spacesActive ? "page" : undefined}
      >
        <Buildings size={19} weight="bold" />
        <span>Espacios y ambientes</span>
      </Link>
      <Link
        className={classificationsActive ? "is-active" : ""}
        to="/administracion/taxonomia"
        aria-current={classificationsActive ? "page" : undefined}
      >
        <SquaresFour size={19} weight="bold" />
        <span>Estructura de clasificación</span>
      </Link>
      <Link
        className={codesActive ? "is-active" : ""}
        to="/administracion/taxonomia/codigos"
        aria-current={codesActive ? "page" : undefined}
      >
        <QrCode size={19} weight="bold" />
        <span>Directorio de espacios</span>
      </Link>
    </nav>
  );
}
