import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, Fragment } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { listProgramaciones } from "@/modules/almacen/planificacionRepository";
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

export function CalendarioPage() {
  const [mesVisible, setMesVisible] = useState(() => new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoCalculado | "todas">("todas");
  const [agruparPor, setAgruparPor] = useState<"equipo" | "clasificacion">("equipo");

  const grilla = useMemo(() => construirGrilla(mesVisible), [mesVisible]);
  const desde = toISODate(grilla[0]);
  const hasta = toISODate(grilla[grilla.length - 1]);

  const { data: programaciones = [], isLoading, error } = useQuery({
    queryKey: ["programaciones-inspeccion", desde, hasta],
    queryFn: () => listProgramaciones({ desde, hasta }),
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
    queryKey: ["programaciones-inspeccion-urgentes", hastaProximas],
    queryFn: () => listProgramaciones({ hasta: hastaProximas }),
  });

  const vencidasYProximas = useMemo(() => {
    return programacionesUrgentes
      .filter((p) => p.estado_calculado === "vencida" || p.estado_calculado === "proxima")
      .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));
  }, [programacionesUrgentes]);

  const gruposVencidasYProximas = useMemo(() => {
    const mapa = new Map<string, ProgramacionInspeccion[]>();
    for (const p of vencidasYProximas) {
      const clave = agruparPor === "clasificacion"
        ? (p.subcategoria_nombre ?? "Sin clasificación")
        : (p.pieza_codigo ?? p.material_codigo ?? "Sin código");
      const lista = mapa.get(clave) ?? [];
      lista.push(p);
      mapa.set(clave, lista);
    }
    return mapa;
  }, [vencidasYProximas, agruparPor]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Calendario</p>
          <h1>Calendario de inspecciones</h1>
          <p>Programaciones de inspección por fecha, según el plan anual vigente.</p>
        </div>
        <div className="flex-row">
          <button
            className="button button-secondary"
            onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label="Mes anterior"
          >
            <CaretLeft size={16} />
          </button>
          <button
            className="button button-secondary"
            onClick={() => setMesVisible(new Date())}
          >
            Hoy
          </button>
          <button
            className="button button-secondary"
            onClick={() => setMesVisible((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label="Mes siguiente"
          >
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

      <div className="data-panel mt-16">
        <div className="table-toolbar">
          <strong style={{ fontSize: 15 }}>Vencidas y próximas</strong>
          <div className="flex-row-wrap" style={{ alignItems: "center", gap: 12 }}>
            <span className="text-muted-sm">{vencidasYProximas.length} pendientes de atención (próximos 15 días o vencidas)</span>
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
        {vencidasYProximas.length === 0 ? (
          <p className="empty-row">No hay inspecciones vencidas ni próximas en este rango.</p>
        ) : (
          <div className="table-scroll">
            <table className="tabla-vencidas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {agruparPor === "clasificacion" && <th>Material / Pieza</th>}
                  <th>Estado</th>
                  <th>Periodicidad</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(gruposVencidasYProximas.entries()).map(([clave, items]) => (
                  <Fragment key={clave}>
                    <tr className="checklist-section-row">
                        <td colSpan={agruparPor === "clasificacion" ? 4 : 3} className="checklist-section-label">

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
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {diaSeleccionado && (
        <div className="data-panel mt-16">
          <div className="table-toolbar">
            <strong className="flex-row" style={{ fontSize: 15 }}>
              <CalendarBlank size={18} />
              {new Date(diaSeleccionado + "T00:00:00").toLocaleDateString("es-PE", { dateStyle: "long" })}
            </strong>
          </div>
          {listaDiaSeleccionado.length === 0 ? (
            <p className="empty-row">No hay inspecciones programadas este día.</p>
          ) : (
            <div className="table-scroll">
              <table className="tabla-vencidas">
                <thead>
                  <tr>
                    <th>Material / Pieza</th>
                    <th>Estado</th>
                    <th>Periodicidad</th>
                  </tr>
                </thead>
                <tbody>
                  {listaDiaSeleccionado.map((p) => (
                    <tr key={p.id}>
                      <td className="text-mono text-base">{p.pieza_codigo ?? p.material_codigo ?? "—"}</td>
                      <td><StatusBadge value={p.estado_calculado} label={estadoCalculadoLabels[p.estado_calculado]} /></td>
                      <td className="text-muted-sm col-periodicidad">cada {p.periodicidad_dias} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}