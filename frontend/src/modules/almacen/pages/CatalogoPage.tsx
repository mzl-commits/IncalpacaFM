import { Package, Plus, WarningCircle, MapPin, Image, FolderPlus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { FilterSelect, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { listMateriales, listCategorias, listSubcategorias } from "@/modules/almacen/catalogoRepository";
import type { Material } from "@/modules/almacen/types";
import { GestionCategoriasPanel } from "@/modules/almacen/components/GestionCategoriasPanel";
import { STOCK_MINIMO } from "@/modules/almacen/types";
import { CroquisCarrusel } from "@/modules/almacen/components/CroquisCarrusel";

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

  // Detectar si la búsqueda parece un código de pieza (alfanumérico corto, sin espacios)
  const busquedaPieza = !!(values.q && /^[A-Z0-9]{4,8}$/i.test(values.q.trim()));

  // Grilla plana (sin agrupar por subcategoría — un grupo podía crecer
  // mucho si hay muchos materiales en la misma subcategoría). Para acotar
  // con precisión, el usuario usa los filtros de Categoría/Subcategoría de
  // arriba, que ya filtran el listado. El orden sigue siendo por nombre y
  // luego marca, para que variantes del mismo tipo de herramienta (ej.
  // "Martillo" Stanley vs Truper) queden una junto a la otra.
  const materialesOrdenados = useMemo(() => {
    return [...materiales].sort(
      (a, b) => a.nombre.localeCompare(b.nombre) || a.marca.localeCompare(b.marca)
    );
  }, [materiales]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Catálogo</p>
          <h1>Catálogo de materiales</h1>
          <p>Ficha maestra de herramientas y materiales del almacén.</p>
        </div>
        <div className="page-heading-actions">
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
            title="Croquis del almacén"
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
              src="/croquis_almacen.png"
              alt="Croquis del almacén: plano en planta, vista isométrica y leyenda de inventario"
              style={{ width: "100%", maxHeight: 640, objectFit: "contain", display: "block" }}
            />
          </div>
        </div>
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

        <div className="catalogo-groups">
          {isLoading && (
            <p className="col-span-all text-center-empty">
              Cargando materiales…
            </p>
          )}
          {!isLoading && materiales.length === 0 && (
            <p className="col-span-all text-center-empty">
              No hay materiales con esos criterios.
            </p>
          )}
          {!isLoading &&
            materialesOrdenados.map((m) => (
              <MaterialCard key={m.id} m={m} busquedaPieza={busquedaPieza} q={values.q} />
            ))}
        </div>
      </div>
    </section>
  );
}

// ─── Card de material ────────────────────────────────────────────────────────

function MaterialCard({ m, busquedaPieza, q }: { m: Material; busquedaPieza: boolean; q: string }) {
  const stockAlerta = !m.control_individual && m.cantidad_total < STOCK_MINIMO;

  return (
    <Link
      to={`/almacen/catalogo/${m.id}`}
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