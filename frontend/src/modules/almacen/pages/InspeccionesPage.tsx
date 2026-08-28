import { ArrowRight, CaretDown, ClipboardText, FileXls, PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { FilterSelect, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { Modal } from "@/components/shared/Modal";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { deleteInspeccion, exportarExcelGeneral, listInspecciones, listVencidas } from "@/modules/almacen/inspeccionRepository";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import type { Inspeccion, ResultadoInspeccion, TipoInspeccion } from "@/modules/almacen/types";

const FILTER_KEYS = ["q", "tipo", "resultado"] as const;

export function InspeccionesPage() {
  const qc = useQueryClient();
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);
  const { almacenId } = useAlmacenActivo();
  const [exportando, setExportando] = useState(false);
  const [inspeccionAEliminar, setInspeccionAEliminar] = useState<Inspeccion | null>(null);

  const { data: inspecciones = [], isLoading } = useQuery({
    queryKey: ["inspecciones", almacenId, values],
    queryFn: () =>
      listInspecciones(almacenId, {
        q: values.q || undefined,
        tipo: values.tipo ? (values.tipo as TipoInspeccion) : undefined,
        resultado: values.resultado ? (values.resultado as ResultadoInspeccion) : undefined,
      }),
  });

  const { data: vencidas = [] } = useQuery({
    queryKey: ["inspecciones-vencidas", almacenId],
    queryFn: () => listVencidas(almacenId),
  });

  const eliminarMut = useMutation({
    mutationFn: (id: number) => deleteInspeccion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecciones"] });
      qc.invalidateQueries({ queryKey: ["inspecciones-vencidas"] });
      setInspeccionAEliminar(null);
    },
  });

  // Stats
  const aptas = inspecciones.filter((i) => i.resultado_general === "apta").length;
  const conReparacion = inspecciones.filter((i) => i.resultado_general === "requiere_reparacion").length;
  const fueraServicio = inspecciones.filter((i) => i.resultado_general === "fuera_servicio").length;
  const [inspExpandido, setInspExpandido] = useState<number | null>(null);
  const tipoOptions = buildFilterOptions(["individual", "grupal"], { individual: "Individual", grupal: "Grupal" });
  const resultadoOptions = buildFilterOptions(["apta", "requiere_reparacion", "fuera_servicio"], {
    apta: "Apta",
    requiere_reparacion: "Requiere reparación",
    fuera_servicio: "Fuera de servicio",
  });

  const activeFilters = useMemo(() => {
    const f = [];
    if (values.tipo) f.push({ key: "tipo", label: "Tipo", value: values.tipo === "individual" ? "Individual" : "Grupal", onRemove: () => setValue("tipo", "") });
    if (values.resultado) f.push({ key: "resultado", label: "Resultado", value: values.resultado, onRemove: () => setValue("resultado", "") });
    return f;
  }, [values, setValue]);

  async function handleExportarExcel() {
    if (!almacenId || exportando) return;
    setExportando(true);
    try {
      await exportarExcelGeneral(almacenId);
    } catch {
      // noop: el usuario verá que no descargó nada
    } finally {
      setExportando(false);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Almacén / Inspecciones</p>
          <h1>Control de calidad</h1>
        </div>
        <div className="page-heading-actions" style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void handleExportarExcel()}
            disabled={exportando || !almacenId}
            title="Descargar reporte consolidado de inspecciones"
          >
            <FileXls size={16} />
            {exportando ? "Descargando…" : "Exportar Excel"}
          </button>
          <Link to={`/almacen/${almacenId}/inspecciones/nueva`} className="button button-primary">
            <Plus size={16} /> Nueva inspección
          </Link>
        </div>
      </div>

      <div className="almacen-stats">
        <StatCard icon={<ClipboardText size={20} />} value={inspecciones.length} label="Total inspecciones" />
        <StatCard icon={<ClipboardText size={20} />} value={aptas} label="Aptas" variant="default" />
        <StatCard icon={<WarningCircle size={20} />} value={conReparacion} label="Requieren reparación" variant={conReparacion > 0 ? "warning" : "default"} />
        <StatCard icon={<WarningCircle size={20} />} value={fueraServicio} label="Fuera de servicio" variant={fueraServicio > 0 ? "error" : "default"} />
      </div>

      {vencidas.length > 0 && (
        <div className="alert-banner alert-banner-warning" style={{ marginBottom: 20 }}>
          <WarningCircle size={20} />
          <div>
            <strong>{vencidas.length} materiales con inspecciones vencidas (+90 días o nunca inspeccionados)</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              <Link to={`/almacen/${almacenId}/inspecciones/vencidas`} style={{ color: "inherit", fontWeight: 700 }}>
                Ver materiales vencidos →
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="data-panel">
        <ListFilterPanel
          title="Filtrar inspecciones"
          description="Busca por tipo o resultado."
          searchLabel="Buscar"
          searchPlaceholder="Material o inspector"
          searchValue={values.q}
          onSearchChange={(v) => setValue("q", v)}
          resultCount={inspecciones.length}
          totalCount={inspecciones.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
        >
          <FilterSelect label="Tipo" value={values.tipo} onChange={(v) => setValue("tipo", v)} options={tipoOptions} allLabel="Todos los tipos" />
          <FilterSelect label="Resultado" value={values.resultado} onChange={(v) => setValue("resultado", v)} options={resultadoOptions} allLabel="Todos los resultados" />
        </ListFilterPanel>

        <div className="table-scroll inspecciones-table-desktop">
          <table className="tabla-detalle-mobile">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Pieza</th>
                <th>Tipo</th>
                <th>Resultado</th>
                <th>Inspector</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="empty-row">Cargando inspecciones…</td></tr>}
              {!isLoading && inspecciones.length === 0 && <tr><td colSpan={7} className="empty-row">Sin inspecciones registradas.</td></tr>}
              {inspecciones.map((insp) => (
                <tr key={insp.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {new Date(insp.fecha).toLocaleDateString("es-PE")}
                      <TrimestreBadge fecha={insp.fecha} periodicidadDias={insp.material_periodicidad_inspeccion_dias ?? 0} />
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13 }}>{insp.material_nombre}</strong>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{insp.material_codigo}</div>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                    {insp.pieza_codigo ?? (insp.piezas_lote.length > 0 ? `${insp.piezas_lote.length} piezas` : "—")}
                  </td>
                  <td style={{ fontSize: 12 }}>{insp.tipo === "individual" ? "Individual" : "Grupal"}</td>
                  <td><StatusBadge value={insp.resultado_general} /></td>
                  <td style={{ fontSize: 12 }}>{insp.inspector_nombre}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Link
                        to={`/almacen/${almacenId}/inspecciones/${insp.id}`}
                        className="table-action"
                        title="Ver detalle de inspección"
                        aria-label="Ver inspección"
                      >
                        <ArrowRight size={15} />
                      </Link>
                      <Link
                        to={`/almacen/${almacenId}/inspecciones/${insp.id}/editar`}
                        className="table-action"
                        title="Editar inspección"
                        aria-label="Editar inspección"
                        style={{ color: "#2563eb" }}
                      >
                        <PencilSimple size={15} />
                      </Link>
                      <button
                        type="button"
                        className="table-action"
                        title="Eliminar inspección"
                        aria-label="Eliminar inspección"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}
                        onClick={() => setInspeccionAEliminar(insp)}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="inspecciones-cards-mobile">
          {isLoading && <p className="empty-row">Cargando inspecciones…</p>}
          {!isLoading && inspecciones.length === 0 && <p className="empty-row">Sin inspecciones registradas.</p>}
          {inspecciones.map((insp) => {
            const abierto = inspExpandido === insp.id;
            return (
              <div key={insp.id} className={`insp-card ${abierto ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="insp-card-summary"
                  aria-expanded={abierto}
                  onClick={() => setInspExpandido(abierto ? null : insp.id)}
                >
                  <div className="insp-card-top">
                    <StatusBadge value={insp.resultado_general} />
                    <span className="insp-card-fecha">
                      {new Date(insp.fecha).toLocaleDateString("es-PE")}
                      <TrimestreBadge fecha={insp.fecha} periodicidadDias={insp.material_periodicidad_inspeccion_dias ?? 0} />
                    </span>
                  </div>
                  <div className="insp-card-nombre-row">
                    <span className="insp-card-nombre">{insp.material_nombre}</span>
                    <CaretDown size={14} className={`insp-card-caret ${abierto ? "is-open" : ""}`} />
                  </div>
                </button>

                {abierto && (
                  <div className="insp-card-detalle">
                    <div className="insp-card-field">
                      <span className="insp-card-label">Código</span>
                      <span className="insp-card-value pieza-code">{insp.material_codigo}</span>
                    </div>
                    <div className="insp-card-field">
                      <span className="insp-card-label">Pieza</span>
                      <span className="insp-card-value">
                        {insp.pieza_codigo ?? (insp.piezas_lote.length > 0 ? `${insp.piezas_lote.length} piezas` : "—")}
                      </span>
                    </div>
                    <div className="insp-card-field">
                      <span className="insp-card-label">Tipo</span>
                      <span className="insp-card-value">{insp.tipo === "individual" ? "Individual" : "Grupal"}</span>
                    </div>
                    <div className="insp-card-field">
                      <span className="insp-card-label">Inspector</span>
                      <span className="insp-card-value">{insp.inspector_nombre}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <Link to={`/almacen/${almacenId}/inspecciones/${insp.id}`} className="button button-sm button-secondary" style={{ flex: 1 }}>
                        <ArrowRight size={14} /> Ver
                      </Link>
                      <Link to={`/almacen/${almacenId}/inspecciones/${insp.id}/editar`} className="button button-sm button-secondary" style={{ color: "#2563eb" }}>
                        <PencilSimple size={14} /> Editar
                      </Link>
                      <button
                        type="button"
                        className="button button-sm button-secondary"
                        style={{ color: "#dc2626" }}
                        onClick={() => setInspeccionAEliminar(insp)}
                      >
                        <Trash size={14} /> Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!inspeccionAEliminar}
        onClose={() => !eliminarMut.isPending && setInspeccionAEliminar(null)}
        title="Eliminar inspección"
        maxWidth={460}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#334155" }}>
            ¿Estás seguro de que deseas eliminar la inspección de{" "}
            <strong>{inspeccionAEliminar?.material_nombre}</strong>
            {inspeccionAEliminar?.pieza_codigo ? ` (Pieza: ${inspeccionAEliminar.pieza_codigo})` : ""}?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Esta acción eliminará de forma permanente el registro de la inspección, sus respuestas de criterios y documentos asociados.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setInspeccionAEliminar(null)}
              disabled={eliminarMut.isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button button-primary"
              style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
              onClick={() => inspeccionAEliminar && eliminarMut.mutate(inspeccionAEliminar.id)}
              disabled={eliminarMut.isPending}
            >
              {eliminarMut.isPending ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}