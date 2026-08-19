import {
  CaretRight,
  Check,
  Copy,
  Cube,
  FolderPlus,
  Funnel,
  House,
  Image,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Minus,
  Package,
  Plus,
  Ruler,
  ShoppingCart,
  Stack,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";

import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  listCategorias,
  listMateriales,
  listSubcategorias,
} from "@/modules/almacen/catalogoRepository";

import { CroquisUploader } from "@/modules/almacen/components/CroquisUploader";

import { GestionCategoriasPanel } from "@/modules/almacen/components/GestionCategoriasPanel";
import { GestionUnidadesPanel } from "@/modules/almacen/components/GestionUnidadesPanel";
import { useAuth } from "@/modules/accounts/AuthContext";
import { STOCK_MINIMO } from "@/modules/almacen/types";
import type { Material } from "@/modules/almacen/types";

const FILTER_KEYS = ["q", "categoria", "subcategoria", "control_individual"] as const;

export function CatalogoPage() {
  const { almacenId, almacen, puedeEditarCroquis } = useAlmacenActivo();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isTechnician = user?.role === "TECNICO";
  const isInspector = user?.role === "INSPECTOR";
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);
  const [mostrarCroquis, setMostrarCroquis] = useState(false);
  const [croquisActual, setCroquisActual] = useState<string | null | undefined>(undefined);
  const [mostrarGestionCat, setMostrarGestionCat] = useState(false);
  const [mostrarGestionUnidades, setMostrarGestionUnidades] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [basket, setBasket] = useState<Record<number, number>>({});
  const [copiedBasket, setCopiedBasket] = useState(false);

  const { data: materiales = [], isLoading } = useQuery({
    queryKey: ["materiales", almacenId, values],
    queryFn: () =>
      listMateriales(almacenId, {
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
    queryKey: ["categorias", almacenId],
    queryFn: () => listCategorias(almacenId),
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", almacenId, values.categoria],
    queryFn: () =>
      listSubcategorias(almacenId, values.categoria ? Number(values.categoria) : undefined),
  });

  // Stats
  const totalActivos = materiales.filter((m) => m.activo).length;
  const conControlIndividual = materiales.filter((m) => m.control_individual).length;
  const consumibles = materiales.filter((m) => !m.control_individual).length;
  const stockBajo = materiales.filter(
    (m) => !m.control_individual && m.cantidad_total < STOCK_MINIMO,
  ).length;

  const basketItems = materiales.filter((material) => (basket[material.id] ?? 0) > 0);
  const basketUnits = basketItems.reduce((total, material) => total + (basket[material.id] ?? 0), 0);

  function setBasketQuantity(material: Material, quantity: number) {
    const next = Math.max(0, Math.min(quantity, Math.max(0, material.cantidad_total)));
    setBasket((current) => {
      const updated = { ...current };
      if (next === 0) delete updated[material.id];
      else updated[material.id] = next;
      return updated;
    });
    setCopiedBasket(false);
  }

  async function copyBasket() {
    const lines = basketItems.map((material) => `${material.codigo} — ${material.nombre} x${basket[material.id]}`);
    if (!lines.length) return;
    try {
      await navigator.clipboard.writeText(`Materiales solicitados\n${lines.join("\n")}`);
      setCopiedBasket(true);
      window.setTimeout(() => setCopiedBasket(false), 2200);
    } catch {
      setCopiedBasket(false);
    }
  }

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
          {!isTechnician && (
            <>
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
                onClick={() => setMostrarGestionUnidades((v) => !v)}
                title="Administrar unidades de medida y tipos de manejo de stock"
              >
                <Ruler size={18} />
                <span>Unidades</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMostrarCroquis((v) => !v)}
            title="Croquis del almacén"
          >
            <MapTrifold size={18} />
            <span>Croquis del almacén</span>
          </button>
          {!isTechnician && !isInspector && (
            <Link className="btn-primary" to={`/almacen/${almacenId}/catalogo/nuevo`}>
              <Plus size={18} weight="bold" />
              <span>Nuevo material</span>
            </Link>
          )}
        </div>
      </header>

      {/* PANEL INTERACTIVO DE GESTIÓN CRUD DE CATEGORÍAS */}
      {mostrarGestionCat && (
        <GestionCategoriasPanel onClose={() => setMostrarGestionCat(false)} />
      )}

      {/* PANEL INTERACTIVO DE GESTIÓN CRUD DE UNIDADES DE MEDIDA / MANEJO DE STOCK */}
      {mostrarGestionUnidades && (
        <GestionUnidadesPanel onClose={() => setMostrarGestionUnidades(false)} />
      )}

      {/* Croquis del almacén — imagen fija */}
      {mostrarCroquis && (
        <div
          style={{
            background: "var(--surface, #fff)",
            borderRadius: 12,
            border: "1px solid var(--border, #e5e7eb)",
            overflow: "hidden",
            marginBottom: 8,
            boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border, #e5e7eb)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <MapPin size={18} style={{ color: "var(--primary, #2563eb)" }} weight="fill" />
            <strong style={{ fontSize: 15 }}>Croquis del almacén</strong>
          </div>
          <div style={{ background: "#f8fafc" }}>
            <img
              src={(croquisActual !== undefined ? croquisActual : almacen?.croquis) || "/croquis_almacen.png"}
              alt={`Croquis del almacén ${almacen?.nombre ?? ""}`}
              style={{ width: "100%", maxHeight: 640, objectFit: "contain", display: "block" }}
            />
            {puedeEditarCroquis && (
              <CroquisUploader
                almacen={{
                  ...almacen,
                  croquis: croquisActual !== undefined ? croquisActual : almacen?.croquis,
                } as typeof almacen}
                almacenId={almacenId}
                onUpdated={(nuevoAlmacen) => {
                  setCroquisActual(nuevoAlmacen?.croquis ?? null);
                  queryClient.invalidateQueries({ queryKey: ["almacen-detalle", almacenId] });
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* COMPACT KPI CARDS */}
      <section className="kpi-grid" aria-label="Indicadores del catálogo">
        <article className="kpi-card" aria-label={`Materiales activos: ${totalActivos}`}>
          <div className="kpi-card-top">
            <Cube size={20} className="kpi-icon" />
          </div>
          <div>
            <div className="kpi-number">{totalActivos}</div>
            <div className="kpi-label">Total de Materiales</div>
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
              placeholder="Buscar por código, nombre, ubicación, cantidad o stock crítico..."
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

        {isTechnician ? (
          <TechnicianMaterialShelf
            materiales={materiales}
            isLoading={isLoading}
            basket={basket}
            basketUnits={basketUnits}
            copiedBasket={copiedBasket}
            onSetQuantity={setBasketQuantity}
            onCopyBasket={copyBasket}
            onClearBasket={() => setBasket({})}
          />
        ) : (
          <div className="catalogo-groups">
            {isLoading && (
              <div className="text-center-empty col-span-all">Cargando materiales…</div>
            )}
            {!isLoading && materiales.length === 0 && (
              <div className="text-center-empty col-span-all">
                No hay materiales que coincidan con los criterios de búsqueda.
              </div>
            )}
            {materiales.map((m) => {
              const busquedaPieza = !!values.q && /^[A-Z0-9]{4,8}$/i.test(values.q.trim());
              return (
                <MaterialCard
                  key={m.id}
                  m={m}
                  busquedaPieza={busquedaPieza}
                  q={values.q ?? ""}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

type TechnicianMaterialShelfProps = {
  materiales: Material[];
  isLoading: boolean;
  basket: Record<number, number>;
  basketUnits: number;
  copiedBasket: boolean;
  onSetQuantity: (material: Material, quantity: number) => void;
  onCopyBasket: () => void;
  onClearBasket: () => void;
};

function TechnicianMaterialShelf({ materiales, isLoading, basket, basketUnits, copiedBasket, onSetQuantity, onCopyBasket, onClearBasket }: TechnicianMaterialShelfProps) {
  return (
    <div className="technician-material-workspace">
      <div className="technician-material-list">
        <div className="technician-material-intro">
          <div><span className="technician-material-kicker">Selección de jornada</span><h2>Materiales disponibles</h2><p>Agrega herramientas o consumibles a tu lista. La cantidad se ajusta al stock disponible.</p></div>
          <span className="technician-material-count">{materiales.length} opciones</span>
        </div>
        {isLoading ? <div className="technician-material-empty">Cargando materiales…</div> : materiales.length === 0 ? <div className="technician-material-empty">No encontramos materiales con estos filtros.</div> : (
          <div className="technician-material-grid">
            {materiales.map((material) => {
              const selected = basket[material.id] ?? 0;
              const outOfStock = material.cantidad_total <= 0;
              const lowStock = !material.control_individual && material.cantidad_total < STOCK_MINIMO;
              return <article className={`technician-material-card${selected ? " is-selected" : ""}`} key={material.id}>
                <div className="technician-material-visual">{material.foto ? <img src={material.foto} alt="" loading="lazy" /> : <Package size={28} aria-hidden="true" />}<span className={`technician-stock-pill${outOfStock ? " is-empty" : lowStock ? " is-low" : ""}`}>{outOfStock ? "Agotado" : `${material.cantidad_total} disponibles`}</span></div>
                <div className="technician-material-content"><span className="technician-material-code">{material.codigo}</span><h3>{material.nombre}</h3><p>{material.marca ? `${material.marca}${material.modelo ? ` · ${material.modelo}` : ""}` : material.categoria_nombre}</p><span className="technician-material-location">{material.ubicacion_fisica || "Ubicación por confirmar"}</span></div>
                <div className="technician-material-card-footer"><span className="technician-material-type">{material.control_individual ? "Pieza individual" : "Consumible"}</span>{selected ? <div className="technician-quantity-control" aria-label={`Cantidad de ${material.nombre}`}><button type="button" onClick={() => onSetQuantity(material, selected - 1)} aria-label="Quitar una unidad"><Minus size={15} /></button><strong>{selected}</strong><button type="button" onClick={() => onSetQuantity(material, selected + 1)} disabled={selected >= material.cantidad_total} aria-label="Agregar una unidad"><Plus size={15} /></button></div> : <button type="button" className="technician-add-material" onClick={() => onSetQuantity(material, 1)} disabled={outOfStock}><ShoppingCart size={16} /> Agregar</button>}</div>
              </article>;
            })}
          </div>
        )}
      </div>
      <aside className="technician-material-cart" aria-label="Lista de materiales seleccionados">
        <div className="technician-cart-heading"><div><span className="technician-material-kicker">Tu lista</span><h2><ShoppingCart size={20} /> Materiales seleccionados</h2></div><span className="technician-cart-total">{basketUnits}</span></div>
        {basketUnits === 0 ? <div className="technician-cart-empty"><ShoppingCart size={28} /><strong>Aún no has agregado materiales</strong><span>Selecciona una tarjeta para preparar tu solicitud.</span></div> : <><div className="technician-cart-items">{materiales.filter((material) => basket[material.id]).map((material) => <div className="technician-cart-item" key={material.id}><div><strong>{material.nombre}</strong><span>{material.codigo} · {basket[material.id]} ud.</span></div><button type="button" onClick={() => onSetQuantity(material, 0)} aria-label={`Quitar ${material.nombre}`}><Trash size={16} /></button></div>)}</div><div className="technician-cart-actions"><button type="button" className="technician-cart-copy" onClick={onCopyBasket}>{copiedBasket ? <Check size={17} /> : <Copy size={17} />}{copiedBasket ? "Lista copiada" : "Copiar lista"}</button><button type="button" className="technician-cart-clear" onClick={onClearBasket}>Vaciar</button></div></>}
      </aside>
    </div>
  );
}

// ─── Card de material ────────────────────────────────────────────────────────

function MaterialCard({ m, busquedaPieza, q }: { m: Material; busquedaPieza: boolean; q: string }) {
  const { almacenId } = useAlmacenActivo();
  const stockAlerta = !m.control_individual && m.cantidad_total < STOCK_MINIMO;

  return (
    <Link
      to={`/almacen/${almacenId}/catalogo/${m.id}`}
      aria-label={`Ver detalle de ${m.nombre}`}
      className="material-card"
    >
      {/* Foto: siempre presente, con placeholder si el material no tiene una */}
      <div className="material-card-photo">
        {m.foto ? (
          <img src={m.foto} alt={m.nombre} />
        ) : (
          <Image size={30} className="text-muted" />
        )}
        {stockAlerta && (
          <span className="material-card-stock-alert">
            <WarningCircle size={12} /> Stock bajo
          </span>
        )}
      </div>

      {/* Datos: sin sobrecargar — código, nombre, marca/modelo y stock son
          lo principal; ubicación y categoría quedan como detalle chico. */}
      <div className="material-card-body">
        <code className="pieza-code text-xs" style={{ alignSelf: "flex-start" }}>
          {m.codigo}
        </code>
        <strong style={{ fontSize: 13.5, lineHeight: 1.3 }}>{m.nombre}</strong>
        {m.marca && (
          <span className="text-muted-sm">
            {m.marca}
            {m.modelo ? ` · ${m.modelo}` : ""}
          </span>
        )}
        {m.ubicacion_fisica && (
          <span className="text-muted-xs">Ubicación: {m.ubicacion_fisica}</span>
        )}
        {busquedaPieza && (
          <span className="material-card-pieza-tag">
            <Package size={10} /> Pieza: <code style={{ fontWeight: 600 }}>{q.toUpperCase()}</code>
          </span>
        )}

        <div className="material-card-footer">
          <StatusBadge
            value={m.control_individual ? "individual" : "consumible"}
            label={m.control_individual ? "Piezas" : "Consumible"}
          />
          <span className={`material-card-stock ${stockAlerta ? "is-alert" : ""}`}>
            {m.cantidad_total} {m.control_individual ? "pzs" : "unid."}
          </span>
        </div>
      </div>
    </Link>
  );
}