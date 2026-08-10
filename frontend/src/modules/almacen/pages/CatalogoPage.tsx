import {
  CaretLeft,
  CaretRight,
  Cube,
  FolderPlus,
  Funnel,
  House,
  MagnifyingGlass,
  MapTrifold,
  Package,
  Plus,
  Stack,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { listCategorias, listMateriales, listSubcategorias } from "@/modules/almacen/catalogoRepository";
import { GestionCategoriasPanel } from "@/modules/almacen/components/GestionCategoriasPanel";
import { STOCK_MINIMO } from "@/modules/almacen/types";

const FILTER_KEYS = ["q", "categoria", "subcategoria", "control_individual"] as const;

export function CatalogoPage() {
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);
  const [mostrarCroquis, setMostrarCroquis] = useState(false);
  const [mostrarGestionCat, setMostrarGestionCat] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const { data: materiales = [], isLoading } = useQuery({
    queryKey: ["materiales", values],
    queryFn: () =>
      listMateriales({
        q: values.q || undefined,
        categoria: values.categoria ? Number(values.categoria) : undefined,
        subcategoria: values.subcategoria ? Number(values.subcategoria) : undefined,
        control_individual:
          values.control_individual === "true"
            ? true
            : values.control_individual === "false"
              ? false
              : undefined,
      }),
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: listCategorias,
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", values.categoria],
    queryFn: () =>
      listSubcategorias(values.categoria ? Number(values.categoria) : undefined),
  });

  // Stats
  const totalActivos = materiales.filter((m) => m.activo).length;
  const conControlIndividual = materiales.filter((m) => m.control_individual).length;
  const consumibles = materiales.filter((m) => !m.control_individual).length;
  const stockBajo = materiales.filter(
    (m) => !m.control_individual && m.cantidad_total < STOCK_MINIMO,
  ).length;

  // Active filters list
  const activeFilters = useMemo(() => {
    const filters = [];
    if (values.q)
      filters.push({ key: "q", label: "Búsqueda", value: values.q, onRemove: () => setValue("q", "") });
    if (values.categoria) {
      const cat = categorias.find((c) => String(c.id) === values.categoria);
      filters.push({
        key: "categoria",
        label: "Categoría",
        value: cat?.nombre ?? values.categoria,
        onRemove: () => {
          setValue("categoria", "");
          setValue("subcategoria", "");
        },
      });
    }
    if (values.subcategoria) {
      const sub = subcategorias.find((s) => String(s.id) === values.subcategoria);
      filters.push({ key: "subcategoria", label: "Subcategoría", value: sub?.nombre ?? values.subcategoria, onRemove: () => setValue("subcategoria", "") });
    }
    if (values.control_individual)
      filters.push({
        key: "control_individual",
        label: "Tipo",
        value: values.control_individual === "true" ? "Con piezas individuales" : "Consumibles",
        onRemove: () => setValue("control_individual", ""),
      });
    return filters;
  }, [values, categorias, subcategorias, setValue]);

  const categoriaOptions = buildFilterOptions(
    categorias.map((c) => ({ value: String(c.id), label: c.nombre })).map((o) => o.value),
    Object.fromEntries(categorias.map((c) => [String(c.id), c.nombre])),
  );
  const subcategoriaOptions = buildFilterOptions(
    subcategorias.map((s) => String(s.id)),
    Object.fromEntries(subcategorias.map((s) => [String(s.id), s.nombre])),
  );

  return (
    <div className="almacen-catalogo-view">
      {/* BREADCRUMB & HEADER */}
      <nav className="breadcrumb-nav" aria-label="Miga de pan">
        <Link to="/" title="Inicio">
          <House size={15} />
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span>Almacén</span>
        <span className="breadcrumb-separator">/</span>
        <strong>Catálogo</strong>
      </nav>

      <header className="page-header-row">
        <div>
          <h1 className="page-title">Catálogo de materiales</h1>
          <p className="page-description">Ficha maestra de herramientas y materiales del almacén.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMostrarGestionCat((v) => !v)}
            title="Administrar categorías y subcategorías"
          >
            <FolderPlus size={18} />
            <span>Categorías</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMostrarCroquis((v) => !v)}
            title="Croquis del almacén"
          >
            <MapTrifold size={18} />
            <span>Croquis del almacén</span>
          </button>
          <Link className="btn-primary" to="/almacen/catalogo/nuevo">
            <Plus size={18} weight="bold" />
            <span>Nuevo material</span>
          </Link>
        </div>
      </header>

      {/* PANEL INTERACTIVO DE GESTIÓN CRUD DE CATEGORÍAS */}
      {mostrarGestionCat && (
        <GestionCategoriasPanel onClose={() => setMostrarGestionCat(false)} />
      )}

      {/* CROQUIS DEL ALMACÉN - CARRUSEL */}
      {mostrarCroquis && <CroquisCarrusel />}

      {/* COMPACT KPI CARDS */}
      <section className="kpi-grid" aria-label="Indicadores del catálogo">
        <article className="kpi-card" aria-label={`Materiales activos: ${totalActivos}`}>
          <div className="kpi-card-top">
            <Cube size={20} className="kpi-icon" />
          </div>
          <div>
            <div className="kpi-number">{totalActivos}</div>
            <div className="kpi-label">Materiales activos</div>
          </div>
        </article>

        <article className="kpi-card" aria-label={`Con piezas individuales: ${conControlIndividual}`}>
          <div className="kpi-card-top">
            <Stack size={20} className="kpi-icon" />
          </div>
          <div>
            <div className="kpi-number">{conControlIndividual}</div>
            <div className="kpi-label">Con piezas individuales</div>
          </div>
        </article>

        <article className="kpi-card" aria-label={`Consumibles: ${consumibles}`}>
          <div className="kpi-card-top">
            <Package size={20} className="kpi-icon" />
          </div>
          <div>
            <div className="kpi-number">{consumibles}</div>
            <div className="kpi-label">Consumibles</div>
          </div>
        </article>

        <article className="kpi-card" aria-label={`Stock bajo: ${stockBajo}`}>
          <div className="kpi-card-top">
            <WarningCircle size={20} className="kpi-icon" />
          </div>
          <div>
            <div className="kpi-number">{stockBajo}</div>
            <div className="kpi-label">Stock bajo</div>
            <div className="kpi-sublabel">Menos de {STOCK_MINIMO} unidades</div>
          </div>
        </article>
      </section>

      {/* WORKSPACE DATA PANEL */}
      <section className="catalog-data-panel" aria-label="Listado de catálogo">
        <div className="panel-toolbar-header">
          <div className="panel-toolbar-title">
            <Funnel size={18} />
            <span>Buscar materiales</span>
          </div>
          <div className="panel-toolbar-count">
            <strong>{materiales.length}</strong> de {materiales.length} resultados
          </div>
        </div>

        <form className="panel-search-bar" onSubmit={(e) => e.preventDefault()} role="search">
          <div className="search-input-wrapper">
            <MagnifyingGlass size={18} className="search-input-icon" />
            <input
              type="search"
              className="search-input"
              value={values.q}
              onChange={(e) => setValue("q", e.target.value)}
              placeholder="Buscar por código, nombre, marca o categoría"
            />
          </div>
          <button
            type="button"
            className="btn-filter-toggle"
            onClick={() => setFiltrosAbiertos((v) => !v)}
            aria-expanded={filtrosAbiertos}
          >
            <Funnel size={18} />
            <span>Filtros</span>
            {activeFilters.length > 0 && <span>({activeFilters.length})</span>}
          </button>
        </form>

        {filtrosAbiertos && (
          <div className="advanced-filters-panel">
            <div className="filter-select-group">
              <div className="filter-select-field">
                <label htmlFor="cat-select">Categoría</label>
                <select
                  id="cat-select"
                  value={values.categoria}
                  onChange={(e) => {
                    setValue("categoria", e.target.value);
                    setValue("subcategoria", "");
                  }}
                >
                  <option value="">Todas las categorías</option>
                  {categoriaOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-select-field">
                <label htmlFor="subcat-select">Subcategoría</label>
                <select
                  id="subcat-select"
                  value={values.subcategoria}
                  onChange={(e) => setValue("subcategoria", e.target.value)}
                  disabled={!values.categoria}
                >
                  <option value="">Todas las subcategorías</option>
                  {subcategoriaOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-select-field">
                <label htmlFor="tipo-select">Tipo de control</label>
                <select
                  id="tipo-select"
                  value={values.control_individual}
                  onChange={(e) => setValue("control_individual", e.target.value)}
                >
                  <option value="">Todos los tipos</option>
                  <option value="true">Con piezas individuales</option>
                  <option value="false">Consumibles</option>
                </select>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Filtros activos:</span>
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={f.onRemove}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #000000",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>{f.label}: <strong>{f.value}</strong></span>
                    <X size={12} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    background: "transparent",
                    border: 0,
                    textDecoration: "underline",
                    fontSize: 12,
                    cursor: "pointer",
                    marginLeft: "auto",
                  }}
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="catalog-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th style={{ width: 140 }}>Tipo</th>
                <th style={{ width: 150 }}>Stock / Piezas</th>
                <th style={{ width: 160 }}>Ubicación</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px 0" }}>
                    Cargando materiales…
                  </td>
                </tr>
              )}
              {!isLoading && materiales.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px 0" }}>
                    No hay materiales que coincidan con los criterios de búsqueda.
                  </td>
                </tr>
              )}
              {materiales.map((m) => {
                const stockAlerta = !m.control_individual && m.cantidad_total < STOCK_MINIMO;
                const busquedaPieza = values.q && /^[A-Z0-9]{4,8}$/i.test(values.q.trim());
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="code-cell">{m.codigo}</span>
                    </td>
                    <td>
                      <div className="name-title">{m.nombre}</div>
                      {m.marca && (
                        <div className="name-subtitle">
                          {m.marca} {m.modelo}
                        </div>
                      )}
                      {busquedaPieza && (
                        <div style={{ fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                          <Package size={10} />
                          Contiene pieza: <strong>{values.q?.toUpperCase()}</strong>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="category-title">{m.categoria_nombre}</div>
                      {m.subcategoria_nombre && (
                        <div className="category-subtitle">{m.subcategoria_nombre}</div>
                      )}
                    </td>
                    <td>
                      <span className="type-badge">
                        {m.control_individual ? "Piezas" : "Consumible"}
                      </span>
                    </td>
                    <td>
                      {m.control_individual ? (
                        <span className="stock-text">{m.cantidad_total} piezas</span>
                      ) : (
                        <span className={`stock-text ${stockAlerta ? "stock-alert-text" : ""}`}>
                          {stockAlerta && <WarningCircle size={14} />}
                          {m.cantidad_total} unid.
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{m.ubicacion_fisica || "—"}</td>
                    <td>
                      <Link
                        to={`/almacen/catalogo/${m.id}`}
                        className="row-action-btn"
                        aria-label={`Ver detalle de ${m.nombre}`}
                        title="Ver detalle"
                      >
                        <CaretRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Croquis Carrusel ────────────────────────────────────────────────────────

const SLIDES = [
  {
    src: "/croquis_almacen_1.png",
    titulo: "Plano general del almacén",
    desc: "Vista superior con todas las zonas de almacenamiento (A1–A3, B1–B3, C1–C2).",
  },
  {
    src: "/croquis_almacen_2.png",
    titulo: "Vista isométrica por zonas",
    desc: "Zona A = Herramientas Manuales · Zona B = Eléctricas · Zona C = Consumibles.",
  },
  {
    src: "/croquis_almacen_3.png",
    titulo: "Mapa de ubicaciones por código",
    desc: "Referencia rápida: código de sección + tipo de herramienta almacenada.",
  },
];

function CroquisCarrusel() {
  const [slide, setSlide] = useState(0);
  const prev = () => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setSlide((s) => (s + 1) % SLIDES.length);
  const current = SLIDES[slide];

  return (
    <div className="croquis-carrusel-card">
      <div className="croquis-header">
        <div className="croquis-header-title">
          <MapTrifold size={18} />
          <strong>Croquis del almacén</strong>
        </div>
        <span className="croquis-counter">
          {slide + 1} / {SLIDES.length}
        </span>
      </div>

      <div className="croquis-body">
        <img src={current.src} alt={current.titulo} className="croquis-img" />

        <button type="button" onClick={prev} className="croquis-nav-btn btn-prev" title="Anterior">
          <CaretLeft size={18} />
        </button>
        <button type="button" onClick={next} className="croquis-nav-btn btn-next" title="Siguiente">
          <CaretRight size={18} />
        </button>
      </div>

      <div className="croquis-footer">
        <strong className="croquis-footer-title">{current.titulo}</strong>
        <p className="croquis-footer-desc">{current.desc}</p>
        <div className="croquis-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              className={`croquis-dot ${i === slide ? "is-active" : ""}`}
              title={SLIDES[i].titulo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
