import { ArrowRight, ClipboardText, Plus, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { FilterSelect, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { listInspecciones, listVencidas } from "@/modules/almacen/inspeccionRepository";
import type { ResultadoInspeccion, TipoInspeccion } from "@/modules/almacen/types";


const FILTER_KEYS = ["q", "tipo", "resultado"] as const;

export function InspeccionesPage() {
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  const { data: inspecciones = [], isLoading } = useQuery({
    queryKey: ["inspecciones", values],
    queryFn: () =>
      listInspecciones({
        q: values.q || undefined,
        tipo: values.tipo ? (values.tipo as TipoInspeccion) : undefined,
        resultado: values.resultado ? (values.resultado as ResultadoInspeccion) : undefined,
      }),
  });

  const { data: vencidas = [] } = useQuery({
    queryKey: ["inspecciones-vencidas"],
    queryFn: listVencidas,
  });

  // Stats
  const aptas = inspecciones.filter((i) => i.resultado_general === "apta").length;
  const conReparacion = inspecciones.filter((i) => i.resultado_general === "requiere_reparacion").length;
  const fueraServicio = inspecciones.filter((i) => i.resultado_general === "fuera_servicio").length;

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

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Inspecciones</p>
          <h1>Inspecciones</h1>
          <p>Registro y control de calidad de herramientas y materiales.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/almacen/inspecciones/vencidas" className="button button-secondary">
            <WarningCircle size={16} /> Vencidas ({vencidas.length})
          </Link>
          <Link to="/almacen/inspecciones/nueva" className="button button-primary">
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
              <Link to="/almacen/inspecciones/vencidas" style={{ color: "inherit", fontWeight: 700 }}>
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

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Pieza</th>
                <th>Tipo</th>
                <th>Resultado</th>
                <th>Inspector</th>
                <th></th>
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
                  <td>
                    <Link to={`/almacen/inspecciones/${insp.id}`} className="table-action" aria-label="Ver inspección">
                      <ArrowRight size={15} />
                    </Link>
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