import { CalendarBlank, CalendarCheck, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, Fragment } from "react";
import { createPortal } from "react-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { listProgramaciones, reprogramarInspeccion } from "@/modules/almacen/planificacionRepository";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import { estadoCalculadoLabels } from "@/modules/almacen/types";
import type { EstadoCalculado, ProgramacionInspeccion } from "@/modules/almacen/types";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ESTADOS: EstadoCalculado[] = ["vencida", "proxima", "pendiente", "realizada"];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Grilla de 42 celdas (6 semanas x 7 días) que cubre el mes, empezando en lunes. */
function construirGrilla(mesVisible: Date): Date[] {
  const primerDiaMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
  const offsetLunes = (primerDiaMes.getDay() + 6) % 7;
  const inicio = new Date(primerDiaMes);
  inicio.setDate(inicio.getDate() - offsetLunes);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}

/** Agrupa programaciones por equipo (código) o por clasificación (subcategoría). */
function agruparProgramaciones(
  items: ProgramacionInspeccion[],
  agruparPor: "equipo" | "clasificacion",
): Map<string, ProgramacionInspeccion[]> {
  const mapa = new Map<string, ProgramacionInspeccion[]>();
  for (const p of items) {
    const clave = agruparPor === "clasificacion"
      ? (p.subcategoria_nombre ?? "Sin clasificación")
      : (p.pieza_codigo ?? p.material_codigo ?? "Sin código");
    const lista = mapa.get(clave) ?? [];
    lista.push(p);
    mapa.set(clave, lista);
  }
  return mapa;
}

// ─── Modal de Reprogramación ──────────────────────────────────────────────────

interface ModalReprogramarProps {
  programacion: ProgramacionInspeccion;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalReprogramar({ programacion, onClose, onSuccess }: ModalReprogramarProps) {
  const hoy = toISODate(new Date());
  const [nuevaFecha, setNuevaFecha] = useState(programacion.fecha_programada);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => reprogramarInspeccion(programacion.id, nuevaFecha),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Error al reprogramar la inspección.";
      setError(msg);
    },
  });

  const nombre = programacion.objeto_nombre
    ? `${programacion.pieza_codigo ?? programacion.material_codigo ?? "—"} · ${programacion.objeto_nombre}`
    : (programacion.pieza_codigo ?? programacion.material_codigo ?? "—");

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reprogramar inspección"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          borderRadius: 12,
          padding: "28px 32px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <CalendarCheck size={22} weight="bold" />
          <h2 style={{ margin: 0, fontSize: 17 }}>Reprogramar inspección</h2>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
          <strong>{nombre}</strong>
        </p>

        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
          Nueva fecha de inspección
        </label>
        <input
          type="date"
          min={hoy}
          value={nuevaFecha}
          onChange={(e) => { setNuevaFecha(e.target.value); setError(null); }}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "8px 12px", fontSize: 14,
            border: "1px solid var(--border, #d1d5db)",
            borderRadius: 8, background: "var(--bg, #f9fafb)",
          }}
        />

        {error && (
          <p style={{ marginTop: 10, fontSize: 13, color: "var(--error, #dc2626)" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button type="button" className="button button-secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => mutate()}
            disabled={isPending || !nuevaFecha}
          >
            {isPending ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Tabla agrupada con botón Reprogramar ─────────────────────────────────────

/** Tabla reutilizable: misma vista para "Vencidas", "Próximas" y el panel del día seleccionado. */
function TablaAgrupada({
  grupos,
  agruparPor,
  onReprogramar,
}: {
  grupos: Map<string, ProgramacionInspeccion[]>;
  agruparPor: "equipo" | "clasificacion";
  onReprogramar?: (p: ProgramacionInspeccion) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="tabla-vencidas">
        <thead>
          <tr>
            <th>Fecha</th>
            {agruparPor === "clasificacion" && <th>Material / Pieza</th>}
            <th>Estado</th>
            <th>Periodicidad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.from(grupos.entries()).map(([clave, items]) => (
            <Fragment key={clave}>
              <tr className="checklist-section-row">
                <td colSpan={agruparPor === "clasificacion" ? 5 : 4} className="checklist-section-label">
                  {agruparPor === "equipo" && items[0]?.objeto_nombre
                    ? `${clave} · ${items[0].objeto_nombre}`
                    : clave}{" "}
                  <span className="text-muted-xs">({items.length})</span>
                </td>
              </tr>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="text-base">
                    {new Date(p.fecha_programada + "T00:00:00").toLocaleDateString("es-PE", { dateStyle: "medium" })}
                  </td>
                  {agruparPor === "clasificacion" && (
                    <td className="text-base">
                      <span className="text-mono">{p.pieza_codigo ?? p.material_codigo ?? "—"}</span>
                      {p.objeto_nombre && <span className="text-muted-xs" style={{ display: "block" }}>{p.objeto_nombre}</span>}
                    </td>
                  )}
                  <td><StatusBadge value={p.estado_calculado} label={estadoCalculadoLabels[p.estado_calculado]} /></td>
                  <td className="text-muted-sm">cada {p.periodicidad_dias} días</td>
                  <td>
                    {p.estado === "pendiente" && onReprogramar && (
                      <button
                        type="button"
                        className="button button-sm button-secondary"
                        title="Cambiar la fecha programada de esta inspección"
                        onClick={() => onReprogramar(p)}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        <CalendarBlank size={13} weight="bold" />
                        Reprogramar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export function CalendarioPage() {
  const { almacenId } = useAlmacenActivo();
  const almacenActivo = almacenId;
  const queryClient = useQueryClient();

  const [mesVisible, setMesVisible] = useState(() => new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoCalculado | "todas">("todas");
  const [agruparPor, setAgruparPor] = useState<"equipo" | "clasificacion">("equipo");
  const [verVencidas, setVerVencidas] = useState(false);
  const [programacionAReprogramar, setProgramacionAReprogramar] = useState<ProgramacionInspeccion | null>(null);

  const grilla = useMemo(() => construirGrilla(mesVisible), [mesVisible]);
  const desde = toISODate(grilla[0]);
  const hasta = toISODate(grilla[grilla.length - 1]);

  const { data: programaciones = [], isLoading, error } = useQuery({
    queryKey: ["programaciones-inspeccion", desde, hasta, almacenActivo],
    queryFn: () => listProgramaciones({ desde, hasta, almacen: almacenActivo ?? undefined }),
    enabled: almacenActivo != null,
  });

  const porDia = useMemo(() => {
    const mapa = new Map<string, ProgramacionInspeccion[]>();
    for (const p of programaciones) {
      if (filtroEstado !== "todas" && p.estado_calculado !== filtroEstado) continue;
      const lista = mapa.get(p.fecha_programada) ?? [];
      lista.push(p);
      mapa.set(p.fecha_programada, lista);
    }
    return mapa;
  }, [programaciones, filtroEstado]);

  const hoyISO = toISODate(new Date());
  const mesActualIndice = mesVisible.getMonth();
  const listaDiaSeleccionado = diaSeleccionado ? porDia.get(diaSeleccionado) ?? [] : [];

  // Independiente del mes que se esté navegando en el calendario: siempre trae
  // TODO lo vencido (sin límite hacia atrás) + lo próximo (15 días desde hoy),
  // para que la lista no "pierda" vencidas al cambiar de mes.
  const hastaProximas = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return toISODate(d);
  }, []);

  const { data: programacionesUrgentes = [] } = useQuery({
    queryKey: ["programaciones-inspeccion-urgentes", hastaProximas, almacenActivo],
    queryFn: () => listProgramaciones({ hasta: hastaProximas, almacen: almacenActivo ?? undefined }),
    enabled: almacenActivo != null,
  });

  const vencidas = useMemo(() => {
    return programacionesUrgentes
      .filter((p) => p.estado_calculado === "vencida")
      .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));
  }, [programacionesUrgentes]);

  const proximas = useMemo(() => {
    return programacionesUrgentes
      .filter((p) => p.estado_calculado === "proxima")
      .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));
  }, [programacionesUrgentes]);

  const gruposVencidas = useMemo(() => agruparProgramaciones(vencidas, agruparPor), [vencidas, agruparPor]);
  const gruposProximas = useMemo(() => agruparProgramaciones(proximas, agruparPor), [proximas, agruparPor]);
  const gruposDia = useMemo(
    () => agruparProgramaciones(listaDiaSeleccionado, agruparPor),
    [listaDiaSeleccionado, agruparPor],
  );

  function handleRefrescar() {
    void queryClient.invalidateQueries({ queryKey: ["programaciones-inspeccion"] });
    void queryClient.invalidateQueries({ queryKey: ["programaciones-inspeccion-urgentes"] });
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Calendario</p>
          <h1>Calendario de inspecciones</h1>
          <p>Programaciones de inspección por fecha, según el plan anual vigente.</p>
        </div>
        <div className="flex-row">
          <button className="button button-secondary" onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Mes anterior">
            <CaretLeft size={16} />
          </button>
          <button className="button button-secondary" onClick={() => setMesVisible(new Date())}>Hoy</button>
          <button className="button button-secondary" onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Mes siguiente">
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-row-between mb-16">
        <h2 style={{ margin: 0, fontSize: 18 }}>
          {MESES[mesActualIndice]} {mesVisible.getFullYear()}
        </h2>
        <div className="flex-row-wrap">
          <button
            className={`button button-sm ${filtroEstado === "todas" ? "button-primary" : "button-secondary"}`}
            onClick={() => setFiltroEstado("todas")}
          >
            Todas
          </button>
          {ESTADOS.map((estado) => (
            <button
              key={estado}
              className={`button button-sm ${filtroEstado === estado ? "button-primary" : "button-secondary"}`}
              onClick={() => setFiltroEstado(estado)}
            >
              <span className={`calendario-punto calendario-punto--${estado}`} aria-hidden="true" />
              {estadoCalculadoLabels[estado]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-box mb-16">No se pudo cargar el calendario.</div>
      )}

      <div className="data-panel">
        <div className="calendario-dias-semana">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="calendario-dia-semana-label">{d}</div>
          ))}
        </div>

        <div className={`calendario-grid ${isLoading ? "is-loading" : ""}`}>
          {grilla.map((fecha) => {
            const iso = toISODate(fecha);
            const items = porDia.get(iso) ?? [];
            const esMesActual = fecha.getMonth() === mesActualIndice;
            const esHoy = iso === hoyISO;
            const visibles = items.slice(0, 3);
            const restantes = items.length - visibles.length;

            return (
              <button
                key={iso}
                className={[
                  "calendario-celda",
                  !esMesActual && "is-fuera-mes",
                  esHoy && "is-hoy",
                  diaSeleccionado === iso && "is-seleccionada",
                ].filter(Boolean).join(" ")}
                onClick={() => setDiaSeleccionado(iso === diaSeleccionado ? null : iso)}
              >
                <span className="calendario-numero-dia">{fecha.getDate()}</span>
                <div className="calendario-puntos">
                  {visibles.map((p) => (
                    <span
                      key={p.id}
                      className={`calendario-punto calendario-punto--${p.estado_calculado}`}
                      title={p.pieza_codigo ?? p.material_codigo ?? undefined}
                    />
                  ))}
                  {restantes > 0 && <span className="text-muted-xs">+{restantes}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Vencidas: colapsada por defecto para no tapar las próximas ── */}
      <div className="data-panel mt-16">
        <div className="table-toolbar">
          <strong style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="calendario-punto calendario-punto--vencida" aria-hidden="true" />
            Vencidas
          </strong>
          <div className="flex-row-wrap" style={{ alignItems: "center", gap: 12 }}>
            <span className="text-muted-sm">{vencidas.length} sin atender</span>
            {vencidas.length > 0 && (
              <button
                className="button button-sm button-secondary"
                onClick={() => setVerVencidas((v) => !v)}
              >
                {verVencidas ? "Ocultar" : "Ver detalle"}
              </button>
            )}
          </div>
        </div>
        {vencidas.length === 0 ? (
          <p className="empty-row">No hay inspecciones vencidas.</p>
        ) : verVencidas ? (
          <TablaAgrupada grupos={gruposVencidas} agruparPor={agruparPor} onReprogramar={setProgramacionAReprogramar} />
        ) : (
          <p className="empty-row">
            Hay <strong>{vencidas.length}</strong> inspección{vencidas.length !== 1 ? "es" : ""} vencida
            {vencidas.length !== 1 ? "s" : ""}. Haz clic en "Ver detalle" para revisarlas.
          </p>
        )}
      </div>

      {/* ── Próximas: siempre visible, es lo que el inspector necesita ver primero ── */}
      <div className="data-panel mt-16">
        <div className="table-toolbar">
          <strong style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="calendario-punto calendario-punto--proxima" aria-hidden="true" />
            Próximas (15 días)
          </strong>
          <div className="flex-row-wrap" style={{ alignItems: "center", gap: 12 }}>
            <span className="text-muted-sm">{proximas.length} por venir</span>
            <div className="flex-row" style={{ gap: 4 }}>
              <button
                className={`button button-sm ${agruparPor === "equipo" ? "button-primary" : "button-secondary"}`}
                onClick={() => setAgruparPor("equipo")}
              >
                Por equipo
              </button>
              <button
                className={`button button-sm ${agruparPor === "clasificacion" ? "button-primary" : "button-secondary"}`}
                onClick={() => setAgruparPor("clasificacion")}
              >
                Por clasificación
              </button>
            </div>
          </div>
        </div>
        {proximas.length === 0 ? (
          <p className="empty-row">No hay inspecciones próximas en los siguientes 15 días.</p>
        ) : (
          <TablaAgrupada grupos={gruposProximas} agruparPor={agruparPor} onReprogramar={setProgramacionAReprogramar} />
        )}
      </div>

      {/* ── Día seleccionado: ahora usa el mismo agrupador (equipo/clasificación) ── */}
      {diaSeleccionado && (
        <div className="data-panel mt-16">
          <div className="table-toolbar">
            <strong className="flex-row" style={{ fontSize: 15 }}>
              <CalendarBlank size={18} />
              {new Date(diaSeleccionado + "T00:00:00").toLocaleDateString("es-PE", { dateStyle: "long" })}
            </strong>
            <span className="text-muted-sm">{listaDiaSeleccionado.length} programada{listaDiaSeleccionado.length !== 1 ? "s" : ""}</span>
          </div>
          {listaDiaSeleccionado.length === 0 ? (
            <p className="empty-row">No hay inspecciones programadas este día.</p>
          ) : (
            <TablaAgrupada grupos={gruposDia} agruparPor={agruparPor} onReprogramar={setProgramacionAReprogramar} />
          )}
        </div>
      )}

      {/* Modal interactivo de reprogramación */}
      {programacionAReprogramar && (
        <ModalReprogramar
          programacion={programacionAReprogramar}
          onClose={() => setProgramacionAReprogramar(null)}
          onSuccess={handleRefrescar}
        />
      )}
    </section>
  );
}