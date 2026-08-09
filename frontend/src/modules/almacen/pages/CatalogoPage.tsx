import { Package, Plus, WarningCircle, CaretRight, CaretLeft, MapPin, FolderPlus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { FilterSelect, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { listMateriales, listCategorias, listSubcategorias } from "@/modules/almacen/catalogoRepository";
import { GestionCategoriasPanel } from "@/modules/almacen/components/GestionCategoriasPanel";
import { STOCK_MINIMO } from "@/modules/almacen/types";

const FILTER_KEYS = ["q", "categoria", "subcategoria", "control_individual"] as const;

export function CatalogoPage() {
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);
  const [mostrarCroquis, setMostrarCroquis] = useState(false);
  const [mostrarGestionCat, setMostrarGestionCat] = useState(false);

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

  // Filtros activos
  const activeFilters = useMemo(() => {
    const filters = [];
    if (values.q)
      filters.push({ key: "q", label: "Búsqueda", value: values.q, onRemove: () => setValue("q", "") });
    if (values.categoria) {
      const cat = categorias.find((c) => String(c.id) === values.categoria);
      filters.push({ key: "categoria", label: "Categoría", value: cat?.nombre ?? values.categoria, onRemove: () => { setValue("categoria", ""); setValue("subcategoria", ""); } });
    }
    if (values.subcategoria) {
      const sub = subcategorias.find((s) => String(s.id) === values.subcategoria);
      filters.push({ key: "subcategoria", label: "Subcategoría", value: sub?.nombre ?? values.subcategoria, onRemove: () => setValue("subcategoria", "") });
    }
    if (values.control_individual)
      filters.push({ key: "control_individual", label: "Tipo", value: values.control_individual === "true" ? "Con piezas individuales" : "Consumibles", onRemove: () => setValue("control_individual", "") });
    return filters;
  }, [values, categorias, subcategorias, setValue]);

  const categoriaOptions = buildFilterOptions(categorias.map((c) => ({ value: String(c.id), label: c.nombre })).map(o => o.value), Object.fromEntries(categorias.map((c) => [String(c.id), c.nombre])));
  const subcategoriaOptions = buildFilterOptions(subcategorias.map((s) => String(s.id)), Object.fromEntries(subcategorias.map((s) => [String(s.id), s.nombre])));

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Catálogo</p>
          <h1>Catálogo de materiales</h1>
          <p>Ficha maestra de herramientas y materiales del almacén.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="button button-secondary"
            onClick={() => setMostrarGestionCat((v) => !v)}
            title="Administrar categorías y subcategorías"
          >
            <FolderPlus size={16} />
            Categorías
          </button>
          <button
            className="button button-secondary"
            onClick={() => setMostrarCroquis((v) => !v)}
            title="Croquis del almacén (próximamente)"
          >
            <MapPin size={16} />
            Croquis del almacén
          </button>
          <Link className="button button-primary" to="/almacen/catalogo/nuevo">
            <Plus />
            Nuevo material
          </Link>
        </div>
      </div>

      {/* Panel interactivo de gestión CRUD de Categorías y Subcategorías */}
      {mostrarGestionCat && (
        <GestionCategoriasPanel onClose={() => setMostrarGestionCat(false)} />
      )}

      {/* Croquis del almacén — carrusel con imágenes de prueba */}
      {mostrarCroquis && (
        <CroquisCarrusel />
      )}

      {/* Stats */}
      <div className="almacen-stats">
        <StatCard icon={<Package size={20} />} value={totalActivos} label="Materiales activos" />
        <StatCard icon={<Package size={20} />} value={conControlIndividual} label="Con piezas individuales" />
        <StatCard icon={<Package size={20} />} value={consumibles} label="Consumibles" />
        <StatCard
          icon={<WarningCircle size={20} />}
          value={stockBajo}
          label="Stock bajo"
          sublabel={`Menos de ${STOCK_MINIMO} unidades`}
          variant={stockBajo > 0 ? "warning" : "default"}
        />
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Buscar materiales"
          description="Busca por nombre, código de material, marca, modelo o código de pieza."
          searchLabel="Buscar"
          searchPlaceholder="Ej: H0013, Bosch, GSB 550, 3WADV…"
          searchValue={values.q}
          onSearchChange={(v) => setValue("q", v)}
          resultCount={materiales.length}
          totalCount={materiales.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            {
              key: "ci",
              label: "Con piezas individuales",
              count: conControlIndividual,
              active: values.control_individual === "true",
              onSelect: () => setValue("control_individual", values.control_individual === "true" ? "" : "true"),
            },
            {
              key: "consumibles",
              label: "Consumibles",
              count: consumibles,
              active: values.control_individual === "false",
              onSelect: () => setValue("control_individual", values.control_individual === "false" ? "" : "false"),
            },
            {
              key: "bajo",
              label: "Stock bajo",
              count: stockBajo,
              active: false,
              onSelect: () => { setValue("control_individual", "false"); },
            },
          ]}
        >
          <FilterSelect
            label="Categoría"
            value={values.categoria}
            onChange={(v) => { setValue("categoria", v); setValue("subcategoria", ""); }}
            options={categoriaOptions}
            allLabel="Todas las categorías"
          />
          <FilterSelect
            label="Subcategoría"
            value={values.subcategoria}
            onChange={(v) => setValue("subcategoria", v)}
            options={subcategoriaOptions}
            allLabel="Todas las subcategorías"
            disabled={!values.categoria}
          />
        </ListFilterPanel>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Tipo</th>
                <th>Stock / Piezas</th>
                <th>Ubicación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="empty-row">Cargando materiales…</td>
                </tr>
              )}
              {!isLoading && materiales.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">No hay materiales con esos criterios.</td>
                </tr>
              )}
              {materiales.map((m) => {
                const stockAlerta = !m.control_individual && m.cantidad_total < STOCK_MINIMO;
                // Detectar si la búsqueda parece un código de pieza (alfanumérico corto, sin espacios)
                const busquedaPieza = values.q && /^[A-Z0-9]{4,8}$/i.test(values.q.trim());
                return (
                  <tr key={m.id} className={stockAlerta ? "stock-alert-row" : ""}>
                    <td>
                      <code className="pieza-code">{m.codigo}</code>
                    </td>
                    <td>
                      <strong>{m.nombre}</strong>
                      {m.marca && <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.marca} {m.modelo}</div>}
                      {busquedaPieza && (
                        <div style={{
                          fontSize: 11, color: "var(--primary, #2563eb)",
                          marginTop: 2, display: "flex", alignItems: "center", gap: 4,
                        }}>
                          <Package size={10} />
                          Contiene pieza: <code style={{ fontWeight: 600 }}>{values.q?.toUpperCase()}</code>
                        </div>
                      )}
                    </td>
                    <td>
                      {m.categoria_nombre}
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.subcategoria_nombre}</div>
                    </td>
                    <td>
                      <StatusBadge
                        value={m.control_individual ? "individual" : "consumible"}
                        label={m.control_individual ? "Piezas" : "Consumible"}
                      />
                    </td>
                    <td>
                      {m.control_individual ? (
                        <span>{m.cantidad_total} piezas</span>
                      ) : (
                        <span className={stockAlerta ? "stock-alert-badge" : ""}>
                          {stockAlerta && <WarningCircle size={13} />}
                          {m.cantidad_total} unid.
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {m.ubicacion_fisica || "—"}
                    </td>
                    <td>
                      <Link
                        to={`/almacen/catalogo/${m.id}`}
                        className="table-action"
                        aria-label={`Ver detalle de ${m.nombre}`}
                      >
                        <CaretRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── Croquis Carrusel ────────────────────────────────────────────────────────

const SLIDES = [
  {
    src: "/croquis_almacen_1.png",
    titulo: "Plano general del almac\u00e9n",
    desc: "Vista superior con todas las zonas de almacenamiento (A1\u2013A3, B1\u2013B3, C1\u2013C2).",
  },
  {
    src: "/croquis_almacen_2.png",
    titulo: "Vista isom\u00e9trica por zonas",
    desc: "Zona A = Herramientas Manuales \u00b7 Zona B = El\u00e9ctricas \u00b7 Zona C = Consumibles.",
  },
  {
    src: "/croquis_almacen_3.png",
    titulo: "Mapa de ubicaciones por c\u00f3digo",
    desc: "Referencia r\u00e1pida: c\u00f3digo de secci\u00f3n + tipo de herramienta almacenada.",
  },
];

function CroquisCarrusel() {
  const [slide, setSlide] = useState(0);
  const prev = () => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setSlide((s) => (s + 1) % SLIDES.length);
  const current = SLIDES[slide];

  return (
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
      {/* Cabecera */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={18} style={{ color: "var(--primary, #2563eb)" }} weight="fill" />
          <strong style={{ fontSize: 15 }}>Croquis del almac\u00e9n</strong>
          <span
            style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 20,
              background: "#fef3c7", color: "#92400e",
              border: "1px solid #fcd34d",
            }}
          >
            Im\u00e1genes de prueba
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {slide + 1} / {SLIDES.length}
        </span>
      </div>

      {/* Imagen */}
      <div style={{ position: "relative", background: "#f8fafc" }}>
        <img
          src={current.src}
          alt={current.titulo}
          style={{
            width: "100%",
            maxHeight: 480,
            objectFit: "contain",
            display: "block",
          }}
        />

        {/* Botones prev/next */}
        <button
          onClick={prev}
          style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,.9)", border: "1px solid var(--border, #d1d5db)",
            borderRadius: "50%", width: 36, height: 36, display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.1)",
          }}
          title="Anterior"
        >
          <CaretLeft size={18} />
        </button>
        <button
          onClick={next}
          style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,.9)", border: "1px solid var(--border, #d1d5db)",
            borderRadius: "50%", width: 36, height: 36, display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.1)",
          }}
          title="Siguiente"
        >
          <CaretRight size={18} />
        </button>
      </div>

      {/* Pie: t\u00edtulo + descripci\u00f3n + dots */}
      <div style={{ padding: "14px 20px" }}>
        <strong style={{ fontSize: 14, display: "block", marginBottom: 4 }}>
          {current.titulo}
        </strong>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          {current.desc}
        </p>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 22 : 8,
                height: 8,
                borderRadius: 4,
                background: i === slide ? "var(--primary, #2563eb)" : "var(--border, #d1d5db)",
                border: "none",
                cursor: "pointer",
                transition: "width .2s, background .2s",
                padding: 0,
              }}
              title={SLIDES[i].titulo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
