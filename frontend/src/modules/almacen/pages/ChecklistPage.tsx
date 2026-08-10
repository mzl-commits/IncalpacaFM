import { CheckCircle, Package, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { labelPieza } from "@/utils/pieza";

import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  listChecklistPrestados,
  registrarEntradaPieza,
} from "@/modules/almacen/inventarioRepository";
import { listUsuarios } from "@/modules/almacen/inspeccionRepository";
import type { PiezaPrestada } from "@/modules/almacen/types";

export function ChecklistPage() {
  const qc = useQueryClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [responsableId, setResponsableId] = useState<number>(0);
  const [devueltas, setDevueltas] = useState<Set<number>>(new Set());
  const [pendientes, setPendientes] = useState<Set<number>>(new Set());

  const { data: prestadas = [], isLoading } = useQuery({
    queryKey: ["checklist-prestados"],
    queryFn: () => listChecklistPrestados(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });

  const hoyPiezas = prestadas.filter(
    (p) => p.ultimo_movimiento?.fecha?.slice(0, 10) === hoy,
  );
  const anteriorPiezas = prestadas.filter(
    (p) => p.ultimo_movimiento?.fecha?.slice(0, 10) !== hoy,
  );

  // Identificar estuches incompletos: piezas que son padre de otras piezas prestadas
  const padreIdsConHijasPrestadas = new Set(
    prestadas.filter((p) => p.padre !== null).map((p) => p.padre!)
  );

  const devolverMut = useMutation({
    mutationFn: (pieza: PiezaPrestada) =>
      registrarEntradaPieza({
        pieza_id: pieza.id,
        responsable_id: responsableId || pieza.id, // fallback temporal
        observaciones: "Devolución registrada desde checklist diario.",
      }),
    onMutate: (pieza) => {
      setPendientes((prev) => new Set([...prev, pieza.id]));
    },
    onSuccess: (_, pieza) => {
      setDevueltas((prev) => new Set([...prev, pieza.id]));
      setPendientes((prev) => { const s = new Set(prev); s.delete(pieza.id); return s; });
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    },
    onError: (_, pieza) => {
      setPendientes((prev) => { const s = new Set(prev); s.delete(pieza.id); return s; });
    },
  });

  function handleCheck(pieza: PiezaPrestada, checked: boolean) {
    if (!checked) return;
    if (!responsableId) {
      alert("Selecciona un responsable antes de registrar devoluciones.");
      return;
    }
    devolverMut.mutate(pieza);
  }

  if (isLoading) return <div className="loading-panel">Cargando checklist…</div>;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Almacén / Checklist del día</p>
          <h1>Checklist de préstamos</h1>
          <p>Marca las piezas devueltas para registrar la entrada automáticamente.</p>
        </div>
        <Link to="/almacen/movimientos" className="button button-secondary">
          ← Movimientos
        </Link>
      </div>

      {/* Selector de responsable global */}
      <div className="form-panel" style={{ marginBottom: 20 }}>
        <label className="field">
          <span>Responsable de las devoluciones <b>*</b></span>
          <select
            value={responsableId || ""}
            onChange={(e) => setResponsableId(Number(e.target.value))}
          >
            <option value="">Seleccionar responsable…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role_display})
              </option>
            ))}
          </select>
        </label>
      </div>

      {prestadas.length === 0 && (
        <div className="data-panel">
          <p className="empty-row">No hay piezas prestadas actualmente. ✓</p>
        </div>
      )}

      {/* Piezas de días anteriores — alerta */}
      {anteriorPiezas.length > 0 && (
        <div className="data-panel" style={{ marginBottom: 16 }}>
          <div className="alert-banner alert-banner-warning" style={{ margin: "12px 16px 0", borderRadius: 6 }}>
            <WarningCircle size={18} />
            <strong>{anteriorPiezas.length} piezas de días anteriores sin devolver</strong>
          </div>
          <p className="checklist-section-label">Préstamos anteriores pendientes</p>
          <div className="checklist-list">
            {anteriorPiezas.map((p) => (
              <ChecklistRow
                key={p.id}
                pieza={p}
                devuelta={devueltas.has(p.id)}
                cargando={pendientes.has(p.id)}
                overdue
                esEstucheIncompleto={padreIdsConHijasPrestadas.has(p.id)}
                hijasPrestadas={prestadas.filter(
                  (h) => h.padre === p.id && !devueltas.has(h.id)
                ).length}
                onCheck={(checked) => handleCheck(p, checked)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Piezas de hoy */}
      {hoyPiezas.length > 0 && (
        <div className="data-panel">
          <p className="checklist-section-label">Préstamos de hoy</p>
          <div className="checklist-list">
            {hoyPiezas.map((p) => (
              <ChecklistRow
                key={p.id}
                pieza={p}
                devuelta={devueltas.has(p.id)}
                cargando={pendientes.has(p.id)}
                overdue={false}
                esEstucheIncompleto={padreIdsConHijasPrestadas.has(p.id)}
                hijasPrestadas={prestadas.filter(
                  (h) => h.padre === p.id && !devueltas.has(h.id)
                ).length}
                onCheck={(checked) => handleCheck(p, checked)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Subcomponente: fila del checklist ──────────────────────────────────────────────────
function ChecklistRow({
  pieza,
  devuelta,
  cargando,
  overdue,
  esEstucheIncompleto,
  hijasPrestadas,
  onCheck,
}: {
  pieza: PiezaPrestada;
  devuelta: boolean;
  cargando: boolean;
  overdue: boolean;
  esEstucheIncompleto?: boolean;
  hijasPrestadas?: number;
  onCheck: (checked: boolean) => void;
}) {
  return (
    <div className={`checklist-row ${overdue ? "is-overdue" : ""} ${devuelta ? "is-devuelta" : ""}`}
      style={devuelta ? { opacity: 0.5 } : undefined}
    >
      <input
        type="checkbox"
        checked={devuelta}
        disabled={devuelta || cargando}
        onChange={(e) => onCheck(e.target.checked)}
        aria-label={`Marcar como devuelta ${labelPieza(pieza)}`}
      />
      <div className="checklist-row-info">
        <strong>
          <code className="pieza-code">{labelPieza(pieza)}</code>{" "}
          — {pieza.material_nombre}
          {pieza.padre_codigo && (
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
              (estuche {pieza.padre_codigo})
            </span>
          )}
        </strong>
        {/* Aviso de estuche incompleto: el estuche regresa pero faltan hijas */}
        {esEstucheIncompleto && !devuelta && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--warning, #d97706)",
              marginLeft: 8,
            }}
          >
            <Package size={12} />
            Estuche incompleto — {hijasPrestadas} item{hijasPrestadas !== 1 ? "s" : ""} aún prestado{hijasPrestadas !== 1 ? "s" : ""}
          </span>
        )}
        <small>
          {pieza.ultimo_movimiento
            ? `Salida: ${new Date(pieza.ultimo_movimiento.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })} · ${pieza.ultimo_movimiento.responsable}`
            : "Sin datos de salida"}
          {pieza.ultimo_movimiento?.referencia_externa &&
            ` · Ref: ${pieza.ultimo_movimiento.referencia_externa}`}
        </small>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {cargando ? (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Registrando…</span>
        ) : devuelta ? (
          <CheckCircle size={18} color="var(--success)" />
        ) : (
          <StatusBadge value={pieza.estado} />
        )}
      </div>
    </div>
  );
}
