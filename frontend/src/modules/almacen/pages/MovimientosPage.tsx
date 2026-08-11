import { Archive, ArrowDown, ArrowRight, ArrowUp, Handshake, Package, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { FilterSelect, FilterDate, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { listMovimientos, listChecklistPrestados } from "@/modules/almacen/inventarioRepository";

const FILTER_KEYS = ["material", "pieza", "tipo", "desde", "hasta"] as const;

export function MovimientosPage() {
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ["movimientos", values],
    queryFn: () =>
      listMovimientos({
        material: values.material ? Number(values.material) : undefined,
        pieza: values.pieza ? Number(values.pieza) : undefined,
        tipo: values.tipo || undefined,
      }),
  });

  // Checklist: piezas prestadas sin devolver (todos los días, no solo hoy)
  const { data: prestadas = [] } = useQuery({
    queryKey: ["checklist-prestados"],
    queryFn: () => listChecklistPrestados(),
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const prestadasAntiguas = prestadas.filter((p) => {
    const fechaMov = p.ultimo_movimiento?.fecha?.slice(0, 10);
    return fechaMov && fechaMov < hoy;
  });

  // Stats
  const totalSalidas = movimientos.filter((m) => m.tipo === "salida").length;
  const totalEntradas = movimientos.filter((m) => m.tipo === "entrada").length;
  const totalBajas = movimientos.filter((m) => m.tipo === "baja").length;

  // Filtrado local por fechas (las fechas no se mandan al backend aún)
  const filtrados = useMemo(() => {
    return movimientos.filter((m) => {
      const fecha = m.fecha.slice(0, 10);
      if (values.desde && fecha < values.desde) return false;
      if (values.hasta && fecha > values.hasta) return false;
      return true;
    });
  }, [movimientos, values.desde, values.hasta]);

  const tipoOptions = buildFilterOptions(["salida", "entrada", "baja"], {
    salida: "Salida",
    entrada: "Entrada",
    baja: "Baja",
  });

  const activeFilters = [];
  if (values.tipo)
    activeFilters.push({ key: "tipo", label: "Tipo", value: values.tipo === "salida" ? "Salida" : values.tipo === "entrada" ? "Entrada" : "Baja", onRemove: () => setValue("tipo", "") });
  if (values.desde)
    activeFilters.push({ key: "desde", label: "Desde", value: values.desde, onRemove: () => setValue("desde", "") });
  if (values.hasta)
    activeFilters.push({ key: "hasta", label: "Hasta", value: values.hasta, onRemove: () => setValue("hasta", "") });

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Movimientos</p>
          <h1>Movimientos de stock</h1>
          <p>Historial de salidas, entradas y bajas del almacén.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/almacen/checklist" className="button button-secondary">
            Checklist del día
          </Link>
          <Link to="/almacen/movimientos/nuevo" className="button button-primary">
            <ArrowRight size={16} /> Registrar movimiento
          </Link>
        </div>
      </div>

      {/* Alertas de piezas prestadas sin devolver */}
      {prestadasAntiguas.length > 0 && (
        <div className="alert-banner alert-banner-warning">
          <WarningCircle size={20} />
          <div>
            <strong>
              {prestadasAntiguas.length} pieza(s) prestadas de días anteriores sin devolver
            </strong>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              Revisa el checklist para registrar las devoluciones pendientes.{" "}
              <Link to="/almacen/checklist" style={{ color: "inherit", fontWeight: 700 }}>
                Ver checklist →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Indicadores de Movimientos de Stock */}
      <div className="stock-movements-strip">
        {/* 1. ENTRADAS */}
        <article className="stock-indicator-item">
          <header className="stock-indicator-header">
            <span className="stock-indicator-icon-combo">
              <Package size={22} weight="bold" />
              <ArrowDown size={13} weight="bold" className="indicator-arrow-sub" />
            </span>
            <span className="stock-indicator-title">ENTRADAS</span>
          </header>

          <strong className="stock-indicator-value">{totalEntradas}</strong>
          <small className="stock-indicator-unit">movimientos</small>
        </article>

        {/* 2. SALIDAS */}
        <article className="stock-indicator-item">
          <header className="stock-indicator-header">
            <span className="stock-indicator-icon-combo">
              <Package size={22} weight="bold" />
              <ArrowUp size={13} weight="bold" className="indicator-arrow-sub" />
            </span>
            <span className="stock-indicator-title">SALIDAS</span>
          </header>

          <strong className="stock-indicator-value">{totalSalidas}</strong>
          <small className="stock-indicator-unit">movimientos</small>
        </article>

        {/* 3. PRÉSTAMOS ACTIVOS */}
        <article className="stock-indicator-item">
          <header className="stock-indicator-header">
            <Handshake size={22} weight="bold" />
            <span className="stock-indicator-title">PRÉSTAMOS ACTIVOS</span>
          </header>

          <strong className="stock-indicator-value">{prestadas.length}</strong>
          <small className="stock-indicator-unit">activos</small>
        </article>

        {/* 4. BAJAS */}
        <article className="stock-indicator-item">
          <header className="stock-indicator-header">
            <Archive size={22} weight="bold" />
            <span className="stock-indicator-title">BAJAS</span>
          </header>

          <strong className="stock-indicator-value">{totalBajas}</strong>
          <small className="stock-indicator-unit">bienes</small>
        </article>
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Filtrar movimientos"
          description="Filtra por tipo, material o rango de fechas."
          searchLabel="Buscar"
          searchPlaceholder="Código de material o pieza"
          searchValue={values.material}
          onSearchChange={(v) => setValue("material", v)}
          resultCount={filtrados.length}
          totalCount={movimientos.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            { key: "salida", label: "Salidas", count: totalSalidas, active: values.tipo === "salida", onSelect: () => setValue("tipo", values.tipo === "salida" ? "" : "salida") },
            { key: "entrada", label: "Entradas", count: totalEntradas, active: values.tipo === "entrada", onSelect: () => setValue("tipo", values.tipo === "entrada" ? "" : "entrada") },
            { key: "baja", label: "Bajas", count: totalBajas, active: values.tipo === "baja", onSelect: () => setValue("tipo", values.tipo === "baja" ? "" : "baja") },
          ]}
        >
          <FilterSelect
            label="Tipo"
            value={values.tipo}
            onChange={(v) => setValue("tipo", v)}
            options={tipoOptions}
            allLabel="Todos los tipos"
          />
          <FilterDate label="Desde" value={values.desde} onChange={(v) => setValue("desde", v)} />
          <FilterDate label="Hasta" value={values.hasta} onChange={(v) => setValue("hasta", v)} max={hoy} />
        </ListFilterPanel>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Pieza / Cant.</th>
                <th>Tipo</th>
                <th>Responsable</th>
                <th>Referencia</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="empty-row">Cargando movimientos…</td></tr>
              )}
              {!isLoading && filtrados.length === 0 && (
                <tr><td colSpan={7} className="empty-row">No hay movimientos con esos criterios.</td></tr>
              )}
              {filtrados.map((mov) => (
                <tr key={mov.id}>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(mov.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td>
                    <strong style={{ fontSize: 13 }}>{mov.material_nombre}</strong>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{mov.material_codigo}</div>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                    {mov.pieza_codigo ?? `${mov.cantidad} u.`}
                  </td>
                  <td><StatusBadge value={mov.tipo} label={mov.tipo_display} /></td>
                  <td style={{ fontSize: 12 }}>{mov.responsable_nombre}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{mov.referencia_externa || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {mov.observaciones || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
