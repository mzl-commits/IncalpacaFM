import { CalendarPlus, CaretDown, CaretRight, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  generarPlanAnual,
  listPlanesAnuales,
  listProgramaciones,
} from "@/modules/almacen/planificacionRepository";
import { estadoCalculadoLabels, estadoPlanAnualLabels } from "@/modules/almacen/types";
import type { EstadoCalculado, ProgramacionInspeccion } from "@/modules/almacen/types";
import { getApiErrorMessage } from "@/utils/httpError";

const ESTADOS: EstadoCalculado[] = ["vencida", "proxima", "pendiente", "realizada"];

export function PlanAnualPage() {
  const queryClient = useQueryClient();
  const [anioInput, setAnioInput] = useState(() => new Date().getFullYear());
  const [forzar, setForzar] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);
  const [planExpandido, setPlanExpandido] = useState<number | null>(null);

  const { data: planes = [], isLoading: cargandoPlanes } = useQuery({
    queryKey: ["planes-anuales"],
    queryFn: () => listPlanesAnuales(),
  });

  // Sin filtro de fecha: trae todas las programaciones para poder contar por plan
  // y también para mostrar el detalle del plan expandido, sin pedir de nuevo al backend.
  const { data: programaciones = [], isLoading: cargandoProgramaciones } = useQuery({
    queryKey: ["programaciones-inspeccion-todas"],
    queryFn: () => listProgramaciones(),
  });

  const conteosPorPlan = useMemo(() => {
    const mapa = new Map<number, Record<EstadoCalculado, number>>();
    for (const p of programaciones) {
      const actual = mapa.get(p.plan) ?? { vencida: 0, proxima: 0, pendiente: 0, realizada: 0 };
      actual[p.estado_calculado] += 1;
      mapa.set(p.plan, actual);
    }
    return mapa;
  }, [programaciones]);

  // Detalle del plan expandido, agrupado por subcategoría — mismo patrón que
  // "Vencidas y próximas" en CalendarioPage, para que se sienta consistente.
  const gruposPlanExpandido = useMemo(() => {
    if (planExpandido == null) return new Map<string, ProgramacionInspeccion[]>();
    const mapa = new Map<string, ProgramacionInspeccion[]>();
    const delPlan = programaciones
      .filter((p) => p.plan === planExpandido)
      .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));
    for (const p of delPlan) {
      const clave = p.subcategoria_nombre ?? "Sin clasificación";
      const lista = mapa.get(clave) ?? [];
      lista.push(p);
      mapa.set(clave, lista);
    }
    return mapa;
  }, [programaciones, planExpandido]);

  const mutacionGenerar = useMutation({
    mutationFn: generarPlanAnual,
    onSuccess: () => {
      setErrorGenerar(null);
      queryClient.invalidateQueries({ queryKey: ["planes-anuales"] });
      queryClient.invalidateQueries({ queryKey: ["programaciones-inspeccion-todas"] });
    },
    onError: (err: unknown) => {
      setErrorGenerar(getApiErrorMessage(err, "No se pudo generar el plan. Intenta nuevamente."));
    },
  });

  function handleGenerar() {
    setErrorGenerar(null);
    mutacionGenerar.mutate({ anio: anioInput, forzar });
  }

  function toggleExpandir(planId: number) {
    setPlanExpandido((actual) => (actual === planId ? null : planId));
  }

  const cargando = cargandoPlanes || cargandoProgramaciones;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Plan anual</p>
          <h1>Plan de inspección anual</h1>
          <p>
            Cada plan agrupa las inspecciones programadas de un año. Al generarlo, se
            calcula una fecha de inspección por cada material inspeccionable, según su
            frecuencia configurada. Haz clic en un plan para ver el detalle.
          </p>
        </div>
      </div>

      <div className="data-panel mb-16">
        <div className="table-toolbar">
          <strong style={{ fontSize: 15 }}>Generar plan</strong>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16, padding: 16 }}>
          <label className="field" style={{ maxWidth: 140 }}>
            <span>Año</span>
            <input
              type="number"
              value={anioInput}
              onChange={(e) => setAnioInput(Number(e.target.value))}
              min={2020}
              max={2100}
            />
          </label>

          <label className="switch-row" style={{ paddingBottom: 10 }}>
            <input
              type="checkbox"
              checked={forzar}
              onChange={(e) => setForzar(e.target.checked)}
            />
            <span>
              Forzar regeneración
              <small>Si el año ya tiene programaciones, se reemplazan las que aún están pendientes (las inspecciones ya realizadas nunca se borran).</small>
            </span>
          </label>

          <button
            className="button button-primary"
            onClick={handleGenerar}
            disabled={mutacionGenerar.isPending}
            style={{ marginBottom: 2 }}
          >
            <CalendarPlus size={18} weight="bold" />
            {mutacionGenerar.isPending ? "Generando..." : `Generar plan ${anioInput}`}
          </button>
        </div>

        {errorGenerar && (
          <div className="error-box" style={{ margin: "0 16px 16px" }}>
            <WarningCircle size={16} style={{ marginRight: 6, verticalAlign: "-3px" }} />
            {errorGenerar}
          </div>
        )}

        {mutacionGenerar.isSuccess && !errorGenerar && (
          <div className="info-box is-plain" style={{ margin: "0 16px 16px" }}>
            Plan {mutacionGenerar.data?.plan.anio}: {mutacionGenerar.data?.programaciones_creadas} programaciones creadas.
          </div>
        )}
      </div>

      <div className="data-panel">
        <div className="table-toolbar">
          <strong style={{ fontSize: 15 }}>Planes existentes</strong>
          <span className="text-muted-sm">{planes.length} plan(es)</span>
        </div>

        {cargando ? (
          <p className="empty-row">Cargando...</p>
        ) : planes.length === 0 ? (
          <p className="empty-row">No hay planes anuales generados todavía.</p>
        ) : (
          <div className="table-scroll">
            <table className="tabla-vencidas">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>Año</th>
                  <th>Estado</th>
                  <th>Vigencia</th>
                  {ESTADOS.map((estado) => (
                    <th key={estado}>{estadoCalculadoLabels[estado]}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {planes.map((plan) => {
                  const conteos = conteosPorPlan.get(plan.id) ?? {
                    vencida: 0, proxima: 0, pendiente: 0, realizada: 0,
                  };
                  const total = conteos.vencida + conteos.proxima + conteos.pendiente + conteos.realizada;
                  const expandido = planExpandido === plan.id;

                  return (
                    <Fragment key={plan.id}>
                      <tr
                        onClick={() => toggleExpandir(plan.id)}
                        style={{ cursor: "pointer" }}
                        className={expandido ? "is-seleccionada" : undefined}
                      >
                        <td>
                          {expandido ? <CaretDown size={14} /> : <CaretRight size={14} />}
                        </td>
                        <td className="text-base" style={{ fontWeight: 700 }}>{plan.anio}</td>
                        <td>
                          <span className={`trimestre-badge trimestre-q${
                            plan.estado === "borrador" ? 1 : plan.estado === "aprobado" ? 2 : 4
                          }`}>
                            {estadoPlanAnualLabels[plan.estado]}
                          </span>
                        </td>
                        <td className="text-muted-sm">
                          {new Date(plan.fecha_inicio + "T00:00:00").toLocaleDateString("es-PE", { dateStyle: "medium" })}
                          {" – "}
                          {new Date(plan.fecha_fin + "T00:00:00").toLocaleDateString("es-PE", { dateStyle: "medium" })}
                        </td>
                        {ESTADOS.map((estado) => (
                          <td key={estado}>
                            {conteos[estado] > 0 ? (
                              <StatusBadge value={estado} label={String(conteos[estado])} />
                            ) : (
                              <span className="text-muted-sm">0</span>
                            )}
                          </td>
                        ))}
                        <td className="text-base" style={{ fontWeight: 700 }}>{total}</td>
                      </tr>

                      {expandido && (
                        <tr>
                          <td colSpan={4 + ESTADOS.length + 1} style={{ padding: 0, background: "var(--surface-muted, #f9fafb)" }}>
                            {total === 0 ? (
                              <p className="empty-row">Este plan no tiene programaciones generadas.</p>
                            ) : (
                              <div style={{ padding: "8px 16px 16px" }}>
                                <table className="tabla-vencidas">
                                  <thead>
                                    <tr>
                                      <th>Material / Pieza</th>
                                      <th>Fecha</th>
                                      <th>Estado</th>
                                      <th>Periodicidad</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from(gruposPlanExpandido.entries()).map(([clave, items]) => (
                                      <Fragment key={clave}>
                                        <tr className="checklist-section-row">
                                          <td colSpan={4} className="checklist-section-label">
                                            {clave} <span className="text-muted-xs">({items.length})</span>
                                          </td>
                                        </tr>
                                        {items.map((p) => (
                                          <tr key={p.id}>
                                            <td className="text-base">
                                              <span className="text-mono">{p.pieza_codigo ?? p.material_codigo ?? "—"}</span>
                                              {p.objeto_nombre && (
                                                <span className="text-muted-xs" style={{ display: "block" }}>{p.objeto_nombre}</span>
                                              )}
                                            </td>
                                            <td className="text-base">
                                              {new Date(p.fecha_programada + "T00:00:00").toLocaleDateString("es-PE", { dateStyle: "medium" })}
                                            </td>
                                            <td><StatusBadge value={p.estado_calculado} label={estadoCalculadoLabels[p.estado_calculado]} /></td>
                                            <td className="text-muted-sm col-periodicidad">cada {p.periodicidad_dias} días</td>
                                          </tr>
                                        ))}
                                      </Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
