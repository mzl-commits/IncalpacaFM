import { Plus, ArrowClockwise, FileXls, ClipboardText } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import { listMovimientos, listGruposSolicitud, descargarExcelMovimientos } from "@/modules/almacen/inventarioRepository";
import { useAuth } from "@/modules/accounts/AuthContext";
import type { TipoMovimiento } from "@/modules/almacen/types";

import { FilterDate, FilterSelect, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import {
  listCategorias,
  listSubcategorias,
  listMateriales,
  listPiezas,
} from "@/modules/almacen/catalogoRepository";
import { listUsuarios } from "@/modules/almacen/inspeccionRepository";

const FILTER_KEYS = [
  "q", "categoria", "subcategoria", "material", "pieza",
  "tipo", "responsable", "fecha_desde", "fecha_hasta",
] as const;

const TIPO_LABELS: Record<string, string> = {
  entrada: "Entradas / Devoluciones",
  salida: "Salidas",
  baja: "Bajas",
};

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Quita tildes y normaliza a minúsculas para que "crítico"/"critico" o
// "número"/"numero" siempre calcen, sin depender de listas hardcodeadas.
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Devuelve la fecha del movimiento sin importar qué campo exponga el backend.
function fechaMovimiento(mov: any): Date | null {
  const raw = mov.fecha ?? mov.creado_at ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangoHoy(): [string, string] {
  const hoy = fmt(new Date());
  return [hoy, hoy];
}

function rangoSemana(): [string, string] {
  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - hoy.getDay());
  return [fmt(inicio), fmt(hoy)];
}

function rangoMes(): [string, string] {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return [fmt(inicio), fmt(hoy)];
}

export function MovimientosPage() {
  const { almacenId } = useAlmacenActivo();
  const { user } = useAuth();
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);
  const [exportando, setExportando] = useState(false);

  const esAdmin = user?.role === "ADMINISTRADOR";

  async function handleExportarExcel() {
    setExportando(true);
    try {
      await descargarExcelMovimientos();
    } finally {
      setExportando(false);
    }
  }

  // ── Datos de apoyo para la cascada de filtros ──────────────────────────
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", almacenId],
    queryFn: () => listCategorias(almacenId),
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", almacenId, values.categoria],
    queryFn: () =>
      listSubcategorias(almacenId, values.categoria ? Number(values.categoria) : undefined),
  });

  const { data: materiales = [] } = useQuery({
    queryKey: ["materiales", almacenId, values.categoria, values.subcategoria],
    queryFn: () =>
      listMateriales(almacenId, {
        categoria: values.categoria ? Number(values.categoria) : undefined,
        subcategoria: values.subcategoria ? Number(values.subcategoria) : undefined,
      }),
  });

  const materialSeleccionado = materiales.find((m) => String(m.id) === values.material);

  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", values.material],
    queryFn: () => listPiezas({ material: Number(values.material) }),
    enabled: !!values.material && !!materialSeleccionado?.control_individual,
  });

  const { data: usuarios = [] } = useQuery({ queryKey: ["usuarios"], queryFn: listUsuarios });

  const tipoOptions = buildFilterOptions(["entrada", "salida", "baja"], TIPO_LABELS);
  const categoriaOptions = buildFilterOptions(
    categorias.map((c) => String(c.id)),
    Object.fromEntries(categorias.map((c) => [String(c.id), c.nombre ?? ""])),
  );
  const subcategoriaOptions = buildFilterOptions(
    subcategorias.map((s) => String(s.id)),
    Object.fromEntries(subcategorias.map((s) => [String(s.id), s.nombre ?? ""])),
  );
  const materialOptions = buildFilterOptions(
    materiales.map((m) => String(m.id)),
    Object.fromEntries(materiales.map((m) => [String(m.id), `${m.codigo ?? ""} — ${m.nombre ?? ""}`])),
  );
  const piezaOptions = buildFilterOptions(
    piezas.map((p) => String(p.id)),
    Object.fromEntries(piezas.map((p) => [String(p.id), p.codigo ?? ""])),
  );
  const responsableOptions = buildFilterOptions(
    usuarios.map((u) => String(u.id)),
    Object.fromEntries(usuarios.map((u) => [String(u.id), u.full_name ?? ""])),
  );

  // ── Movimientos (filtrado estructurado server-side) ─────────────────────
  const {
    data: movimientos,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["movimientos", almacenId, values],
    queryFn: () =>
      listMovimientos(almacenId, {
        tipo: (values.tipo || undefined) as TipoMovimiento | undefined,
        material: values.material ? Number(values.material) : undefined,
        pieza: values.pieza ? Number(values.pieza) : undefined,
        responsable: values.responsable ? Number(values.responsable) : undefined,
        fecha_desde: values.fecha_desde || undefined,
        fecha_hasta: values.fecha_hasta || undefined,
      }),
    enabled: !!almacenId,
  });

  const { data: gruposPendientes = [] } = useQuery({
    queryKey: ["grupos-solicitud", "pendiente"],
    queryFn: () => listGruposSolicitud({ estado: "pendiente" }),
    enabled: esAdmin,
  });

  // Búsqueda de texto libre sobre lo que ya trajo el filtro server-side:
  // código, material, ubicación, fecha (incluye nombres de mes en español),
  // cantidad, stock crítico, responsable y OT.
  const lista = useMemo(() => {
    const base = movimientos ?? [];
    const termRaw = values.q.trim();
    if (!termRaw) return base;

    const term = normalizar(termRaw);
    const esNumero = !isNaN(Number(termRaw));
    const numTerm = Number(termRaw);

    return base.filter((mov: any) => {
      const campos = [
        mov.material_codigo,
        mov.material_nombre,
        mov.material_ubicacion,
        mov.pieza_codigo,
        mov.pieza_nombre,
        mov.referencia_externa,
        mov.work_order_code,
        mov.responsable_nombre,
        mov.usuario_nombre,
        mov.observaciones,
      ];

      // Coincidencia textual en campos (normalizada, sin tildes)
      if (campos.some((campo) => campo && normalizar(String(campo)).includes(term))) {
        return true;
      }

      // Coincidencia en fecha (DD/MM/YYYY, D/M/YYYY, nombre de mes, año)
      const d = fechaMovimiento(mov);
      if (d) {
        const dia = d.getDate();
        const mes = d.getMonth() + 1;
        const anio = d.getFullYear();
        const diaStr = String(dia).padStart(2, "0");
        const mesStr = String(mes).padStart(2, "0");
        const nombreMes = MESES_ES[d.getMonth()] ?? "";

        const formatosFecha = [
          `${diaStr}/${mesStr}/${anio}`,
          `${dia}/${mes}/${anio}`,
          `${diaStr}/${mesStr}`,
          `${dia}/${mes}`,
          `${dia} de ${nombreMes}`,
          nombreMes,
          String(anio),
          d.toLocaleDateString("es-PE"),
        ];

        if (formatosFecha.some((f) => normalizar(f).includes(term))) {
          return true;
        }
      }

      // Coincidencia en cantidad
      if (
        mov.cantidad?.toString().includes(termRaw) ||
        mov.cantidad_cajas?.toString().includes(termRaw)
      ) {
        return true;
      }

      // Búsqueda por término de stock crítico / bajo (normalizado, sin tildes)
      if (
        ["critico", "stock critico", "bajo", "stock bajo"].includes(term)
      ) {
        if (
          mov.material_stock_minimo > 0 &&
          mov.material_cantidad_total <= mov.material_stock_minimo
        ) {
          return true;
        }
      }

      // Coincidencia numérica con cantidad o stock crítico
      if (
        esNumero &&
        (mov.cantidad === numTerm ||
          mov.material_stock_minimo === numTerm ||
          mov.material_cantidad_total === numTerm)
      ) {
        return true;
      }

      return false;
    });
  }, [movimientos, values.q]);

  // ── Filtros activos (chips) ─────────────────────────────────────────────
  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string; onRemove: () => void }[] = [];

    if (values.categoria) {
      const cat = categorias.find((c) => String(c.id) === values.categoria);
      filters.push({
        key: "categoria",
        label: "Categoría",
        value: cat?.nombre ?? values.categoria,
        onRemove: () => {
          setValue("categoria", "");
          setValue("subcategoria", "");
          setValue("material", "");
          setValue("pieza", "");
        },
      });
    }
    if (values.subcategoria) {
      const sub = subcategorias.find((s) => String(s.id) === values.subcategoria);
      filters.push({
        key: "subcategoria",
        label: "Subcategoría",
        value: sub?.nombre ?? values.subcategoria,
        onRemove: () => {
          setValue("subcategoria", "");
          setValue("material", "");
          setValue("pieza", "");
        },
      });
    }
    if (values.material) {
      filters.push({
        key: "material",
        label: "Material",
        value: materialSeleccionado ? `${materialSeleccionado.codigo ?? ""} — ${materialSeleccionado.nombre ?? ""}` : values.material,
        onRemove: () => {
          setValue("material", "");
          setValue("pieza", "");
        },
      });
    }
    if (values.pieza) {
      const pieza = piezas.find((p) => String(p.id) === values.pieza);
      filters.push({
        key: "pieza",
        label: "Pieza",
        value: pieza?.codigo ?? values.pieza,
        onRemove: () => setValue("pieza", ""),
      });
    }
    if (values.tipo) {
      filters.push({
        key: "tipo",
        label: "Tipo",
        value: TIPO_LABELS[values.tipo] ?? values.tipo,
        onRemove: () => setValue("tipo", ""),
      });
    }
    if (values.responsable) {
      const usuario = usuarios.find((u) => String(u.id) === values.responsable);
      filters.push({
        key: "responsable",
        label: "Responsable",
        value: usuario?.full_name ?? values.responsable,
        onRemove: () => setValue("responsable", ""),
      });
    }
    if (values.fecha_desde || values.fecha_hasta) {
      filters.push({
        key: "fecha",
        label: "Fecha",
        value: `${values.fecha_desde || "…"} → ${values.fecha_hasta || "…"}`,
        onRemove: () => {
          setValue("fecha_desde", "");
          setValue("fecha_hasta", "");
        },
      });
    }
    return filters;
  }, [values, categorias, subcategorias, materialSeleccionado, piezas, usuarios, setValue]);

  // ── Vistas rápidas de fecha (pills del ListFilterPanel) ─────────────────
  const [hoyDesde, hoyHasta] = rangoHoy();
  const [semanaDesde, semanaHasta] = rangoSemana();
  const [mesDesde, mesHasta] = rangoMes();

  const quickFilters = [
    {
      key: "hoy",
      label: "Hoy",
      active: values.fecha_desde === hoyDesde && values.fecha_hasta === hoyHasta,
      onSelect: () => { setValue("fecha_desde", hoyDesde); setValue("fecha_hasta", hoyHasta); },
    },
    {
      key: "semana",
      label: "Esta semana",
      active: values.fecha_desde === semanaDesde && values.fecha_hasta === semanaHasta,
      onSelect: () => { setValue("fecha_desde", semanaDesde); setValue("fecha_hasta", semanaHasta); },
    },
    {
      key: "mes",
      label: "Este mes",
      active: values.fecha_desde === mesDesde && values.fecha_hasta === mesHasta,
      onSelect: () => { setValue("fecha_desde", mesDesde); setValue("fecha_hasta", mesHasta); },
    },
  ];

  return (
    <div className="almacen-movimientos-view">
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Almacén / Movimientos</p>
          <h1>Historial de Movimientos</h1>
          <p>Entradas, salidas y bajas de materiales y piezas.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {esAdmin && (
            <>
              {gruposPendientes.length > 0 && (
                <Link
                  to={`/almacen/${almacenId}/movimientos/solicitudes`}
                  className="button button-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <ClipboardText size={17} />
                  Solicitudes
                  <span style={{ background: "#f59e0b", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 12, fontWeight: 700 }}>
                    {gruposPendientes.length}
                  </span>
                </Link>
              )}
              <button
                type="button"
                className="button button-secondary"
                onClick={handleExportarExcel}
                disabled={exportando}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <FileXls size={17} /> {exportando ? "Exportando…" : "Exportar Excel"}
              </button>
            </>
          )}
          <Link
            to={`/almacen/${almacenId}/movimientos/nuevo`}
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Plus size={18} weight="bold" /> Registrar movimiento
          </Link>
        </div>
      </header>

      <ListFilterPanel
        title="Buscar movimientos"
        description="Filtra por categoría, material, pieza, tipo, responsable o fecha."
        searchLabel="Buscar"
        searchPlaceholder="Buscar por código, material, ubicación, fecha, cantidad, stock crítico u OT..."
        searchValue={values.q}
        onSearchChange={(v) => setValue("q", v)}
        resultCount={lista.length}
        totalCount={movimientos?.length ?? 0}
        activeFilters={activeFilters}
        onClear={clearFilters}
        quickFilters={quickFilters}
      >
        <FilterSelect
          label="Categoría"
          value={values.categoria}
          onChange={(v) => { setValue("categoria", v); setValue("subcategoria", ""); setValue("material", ""); setValue("pieza", ""); }}
          options={categoriaOptions}
          allLabel="Todas las categorías"
        />
        <FilterSelect
          label="Subcategoría"
          value={values.subcategoria}
          onChange={(v) => { setValue("subcategoria", v); setValue("material", ""); setValue("pieza", ""); }}
          options={subcategoriaOptions}
          allLabel="Todas las subcategorías"
          disabled={!values.categoria}
        />
        <FilterSelect
          label="Material"
          value={values.material}
          onChange={(v) => { setValue("material", v); setValue("pieza", ""); }}
          options={materialOptions}
          allLabel="Todos los materiales"
        />
        {materialSeleccionado?.control_individual && (
          <FilterSelect
            label="Pieza"
            value={values.pieza}
            onChange={(v) => setValue("pieza", v)}
            options={piezaOptions}
            allLabel="Todas las piezas"
          />
        )}
        <FilterSelect
          label="Tipo"
          value={values.tipo}
          onChange={(v) => setValue("tipo", v)}
          options={tipoOptions}
          allLabel="Todos los tipos"
        />
        <FilterSelect
          label="Responsable"
          value={values.responsable}
          onChange={(v) => setValue("responsable", v)}
          options={responsableOptions}
          allLabel="Todos los responsables"
        />
        <FilterDate
          label="Desde"
          value={values.fecha_desde}
          onChange={(v) => setValue("fecha_desde", v)}
          max={values.fecha_hasta || undefined}
        />
        <FilterDate
          label="Hasta"
          value={values.fecha_hasta}
          onChange={(v) => setValue("fecha_hasta", v)}
          min={values.fecha_desde || undefined}
        />
      </ListFilterPanel>

      <div className="table-toolbar">
        <button type="button" className="button button-ghost" onClick={() => refetch()} title="Recargar datos">
          <ArrowClockwise size={16} className={isFetching ? "spin" : ""} /> Recargar
        </button>
      </div>

      {/* Tabla de Movimientos */}
      <div className="data-panel">
        {isLoading ? (
          <p className="empty-row">Cargando historial de movimientos…</p>
        ) : lista.length === 0 ? (
          <p className="empty-row">No se encontraron movimientos registrados con los filtros aplicados.</p>
        ) : (
          <div className="table-scroll">
            <table className="tabla-detalle-mobile">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Tipo</th>
                  <th>Material / Pieza</th>
                  <th>Cantidad</th>
                  <th>Responsable</th>
                  <th>Referencia / OT</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((mov: any) => {
                  const esEntrada = mov.tipo === "entrada";
                  const esSalida = mov.tipo === "salida";
                  const badgeColor = esEntrada ? "#dcfce7" : esSalida ? "#dbeafe" : "#fee2e2";
                  const textColor = esEntrada ? "#15803d" : esSalida ? "#1d4ed8" : "#b91c1c";
                  const fechaMov = fechaMovimiento(mov);

                  return (
                    <tr key={mov.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {fechaMov ? fechaMov.toLocaleString("es-PE") : "—"}
                      </td>
                      <td>
                        <span
                          style={{
                            background: badgeColor,
                            color: textColor,
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          {mov.tipo}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 13 }}>{mov.material_codigo || mov.pieza_codigo || "—"}</strong>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {mov.material_nombre || mov.pieza_nombre || "—"}
                        </div>
                        {mov.material_ubicacion && (
                          <div style={{ fontSize: 11, color: "var(--primary, #2563eb)", marginTop: 2 }}>
                            📍 {mov.material_ubicacion}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {mov.cantidad_cajas ? `${mov.cantidad_cajas} emp. (${mov.cantidad} u.)` : `${mov.cantidad ?? 1} u.`}
                      </td>
                      <td>{mov.responsable_nombre || mov.usuario_nombre || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {mov.referencia_externa || mov.work_order_code || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}