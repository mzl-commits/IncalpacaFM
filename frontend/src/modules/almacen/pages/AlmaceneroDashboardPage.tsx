import {
  ArrowCircleDown,
  ArrowCircleUp,
  ArrowRight,
  ClipboardText,
  ListChecks,
  ListDashes,
  Package,
  Trash,
  UserCircle,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/modules/accounts/AuthContext";
import { listMateriales } from "@/modules/almacen/catalogoRepository";
import { listChecklistPrestados, listMovimientos, listOrdenesTrabajoActivas, type WorkOrderActiva } from "@/modules/almacen/inventarioRepository";
import { STOCK_MINIMO } from "@/modules/almacen/types";

// Metadatos visuales por tipo de movimiento — reutiliza los mismos colores
// que ya existen en trimestre-badge / calendario-punto (verde/azul/rojo),
// no introduce paleta nueva.
const TIPO_META: Record<string, { color: string; bg: string; icon: typeof ArrowCircleDown }> = {
  entrada: { color: "#16a34a", bg: "#f0fdf4", icon: ArrowCircleDown },
  salida: { color: "#2563eb", bg: "#eff6ff", icon: ArrowCircleUp },
  baja: { color: "#dc2626", bg: "#fef2f2", icon: Trash },
};

function metaDeTipo(tipo: string) {
  return TIPO_META[tipo] ?? TIPO_META.salida;
}

// "Hoy" / "Ayer" / "24 de agosto" — agrupador de encabezado para el feed.
function etiquetaDia(fecha: Date): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === hoy.getTime()) return "Hoy";
  if (d.getTime() === ayer.getTime()) return "Ayer";
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
}

export default function AlmaceneroDashboardPage() {
  const { user } = useAuth();
  const almacenId = user?.almacenId ?? null;

  const { data: materiales = [], isLoading: loadingMateriales } = useQuery({
    queryKey: ["materiales", almacenId],
    queryFn: () => listMateriales(almacenId!),
    enabled: !!almacenId,
  });

  const { data: movimientos = [], isLoading: loadingMovimientos } = useQuery({
    queryKey: ["movimientos", almacenId],
    queryFn: () => listMovimientos(almacenId!),
    enabled: !!almacenId,
  });

  const { data: prestadas = [] } = useQuery({
    queryKey: ["checklist-prestados", almacenId],
    queryFn: () => listChecklistPrestados(almacenId!),
    enabled: !!almacenId,
  });

  const { data: otsActivas = [], isLoading: loadingOTs } = useQuery<WorkOrderActiva[]>({
    queryKey: ["ots-activas"],
    queryFn: listOrdenesTrabajoActivas,
    enabled: !!almacenId,
  });

  const loading = loadingMateriales || loadingMovimientos;
  const stockCritico = materiales.filter((m) => !m.control_individual && m.cantidad_total < STOCK_MINIMO);

  const movimientosRecientes = useMemo(
    () =>
      [...movimientos]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 8),
    [movimientos],
  );

  // Agrupa los movimientos recientes por día conservando el orden (más reciente primero).
  const actividadPorDia = useMemo(() => {
    const grupos = new Map<string, typeof movimientosRecientes>();
    for (const mov of movimientosRecientes) {
      const label = etiquetaDia(new Date(mov.fecha));
      if (!grupos.has(label)) grupos.set(label, []);
      grupos.get(label)!.push(mov);
    }
    return Array.from(grupos.entries());
  }, [movimientosRecientes]);

  // Ordena por severidad (más cerca de 0 = más urgente) y calcula el % del mínimo.
  const stockUrgencia = useMemo(
    () =>
      [...stockCritico]
        .map((m) => ({
          ...m,
          ratio: STOCK_MINIMO > 0 ? Math.min(100, Math.round((m.cantidad_total / STOCK_MINIMO) * 100)) : 0,
        }))
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 6),
    [stockCritico],
  );

  if (!almacenId) {
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">Almacén / Inicio</p>
            <h1>Hola, {user?.fullName?.split(" ")[0] || "Almacenero"}</h1>
            <p>Tu cuenta no tiene un almacén asignado todavía. Contacta al administrador.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Almacén / Inicio</p>
          <h1>Hola, {user?.fullName?.split(" ")[0] || "Almacenero"}</h1>
          <p>Gestión de stock, despacho a técnicos y materiales del almacén.</p>
        </div>
      </div>

      <div
        className="stat-cards-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard icon={<Package size={20} />} value={loading ? "…" : materiales.length} label="Materiales en catálogo" />
        <StatCard
          icon={<WarningCircle size={20} />}
          value={loading ? "…" : stockCritico.length}
          label="Con stock bajo"
          variant={stockCritico.length > 0 ? "error" : "default"}
        />
        <StatCard icon={<Wrench size={20} />} value={loadingOTs ? "…" : otsActivas.length} label="OTs para despacho" />
        <StatCard icon={<ListChecks size={20} />} value={prestadas.length} label="Piezas prestadas" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <Link to={`/almacen/${almacenId}/catalogo`} className="button button-secondary">
          <ListDashes size={16} /> Ver catálogo
        </Link>
        <Link to={`/almacen/${almacenId}/movimientos/nuevo`} className="button button-primary">
          <ArrowRight size={16} /> Registrar movimiento
        </Link>
        <Link to={`/almacen/${almacenId}/movimientos/solicitudes`} className="button button-secondary">
          <ClipboardText size={16} /> Solicitudes
        </Link>
        <Link to={`/almacen/${almacenId}/checklist`} className="button button-secondary">
          <ListChecks size={16} /> Devolución
        </Link>
      </div>

      {/* Cola de despacho — antes era una tabla, ahora fichas accionables */}
      {otsActivas.length > 0 && (
        <div className="data-panel" style={{ marginBottom: 20 }}>
          <div className="table-toolbar">
            <div>
              <strong style={{ fontSize: 15 }}>Órdenes de Trabajo asignadas a este almacén</strong>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--muted)" }}>
                Despacha directamente los materiales y herramientas a los técnicos responsables.
              </p>
            </div>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {otsActivas.length} {otsActivas.length === 1 ? "orden activa" : "órdenes activas"}
            </span>
          </div>

          <div className="dispatch-queue">
            {otsActivas.map((ot) => (
              <div className="dispatch-card" key={ot.id}>
                <div className="dispatch-card-top">
                  <span className="dispatch-card-code">{ot.code}</span>
                  <StatusBadge value={ot.status} label={ot.status_display} />
                </div>
                <div className="dispatch-card-tech">
                  <UserCircle size={16} />
                  {ot.technician_name}
                </div>
                <Link
                  to={`/almacen/${almacenId}/movimientos/nuevo?tipo=salida&ot=${ot.id}`}
                  className="button button-primary button-sm dispatch-card-btn"
                >
                  <Package size={14} /> Despachar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-split">
        {/* Alertas de stock — barras de urgencia en vez de filas planas */}
        <div className="data-panel">
          <div className="table-toolbar">
            <strong style={{ fontSize: 15 }}>Alertas de stock</strong>
            <Link to={`/almacen/${almacenId}/catalogo`} className="table-action" style={{ fontSize: 13 }}>
              Ver catálogo
            </Link>
          </div>
          {loading ? (
            <p className="empty-row">Cargando…</p>
          ) : stockUrgencia.length === 0 ? (
            <p className="empty-row">Todos los materiales tienen stock suficiente.</p>
          ) : (
            <div className="stock-urgency-list">
              {stockUrgencia.map((m) => (
                <Link to={`/almacen/${almacenId}/catalogo/${m.id}`} className="stock-urgency-row" key={m.id}>
                  <div className="stock-urgency-row-top">
                    <span className="stock-urgency-nombre">{m.nombre}</span>
                    <span className="stock-urgency-codigo">{m.codigo}</span>
                  </div>
                  <div className="stock-urgency-bar-track">
                    <div className="stock-urgency-bar-fill" style={{ width: `${m.ratio}%` }} />
                  </div>
                  <div className="stock-urgency-bar-labels">
                    <span>{m.cantidad_total} en stock</span>
                    <span>mínimo {STOCK_MINIMO}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actividad reciente — línea de tiempo agrupada por día */}
        <div className="data-panel">
          <div className="table-toolbar">
            <strong style={{ fontSize: 15 }}>Actividad reciente</strong>
            <Link to={`/almacen/${almacenId}/movimientos`} className="table-action" style={{ fontSize: 13 }}>
              Ver todos
            </Link>
          </div>
          {loading ? (
            <p className="empty-row">Cargando…</p>
          ) : actividadPorDia.length === 0 ? (
            <p className="empty-row">No hay movimientos registrados aún.</p>
          ) : (
            <div className="activity-feed">
              {actividadPorDia.map(([label, items]) => (
                <div className="activity-day-group" key={label}>
                  <div className="activity-day-label">{label}</div>
                  <div className="activity-day-items">
                    {items.map((mov) => {
                      const meta = metaDeTipo(mov.tipo);
                      const Icon = meta.icon;
                      return (
                        <div className="activity-item" key={mov.id}>
                          <span className="activity-item-icon" style={{ color: meta.color, background: meta.bg }}>
                            <Icon size={14} weight="fill" />
                          </span>
                          <div className="activity-item-body">
                            <div className="activity-item-top">
                              <span className="activity-item-title">{mov.pieza_codigo ?? mov.material_nombre}</span>
                              <span className="activity-item-time">
                                {new Date(mov.fecha).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="activity-item-meta">
                              <span style={{ color: meta.color, fontWeight: 600, textTransform: "capitalize" }}>
                                {mov.tipo_display ?? mov.tipo}
                              </span>
                              {" · "}
                              {mov.cantidad} {mov.cantidad === 1 ? "unidad" : "unidades"}
                              {mov.responsable_nombre ? ` · ${mov.responsable_nombre}` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}