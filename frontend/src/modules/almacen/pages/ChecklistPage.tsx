import { CaretDown, CaretRight, CheckCircle, Package, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { labelPieza } from "@/utils/pieza";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { listUsuarios } from "@/modules/almacen/inspeccionRepository";
import {
  listChecklistPrestados,
  registrarEntradaPieza,
} from "@/modules/almacen/inventarioRepository";
import type { PiezaPrestada } from "@/modules/almacen/types";

export function ChecklistPage() {
  const { almacenId } = useAlmacenActivo();
  const qc = useQueryClient();

  const [responsableId, setResponsableId] = useState<number>(0);
  const [devueltas, setDevueltas] = useState<Set<number>>(new Set());
  const [pendientes, setPendientes] = useState<Set<number>>(new Set());
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set());

    const { data: prestadas = [], isLoading } = useQuery({
      queryKey: ["checklist-prestados", almacenId],
      queryFn: () => listChecklistPrestados(almacenId),
    });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });

  // Agrupación optimizada con fecha local (no UTC)
  const { hoyPiezas, anteriorPiezas } = useMemo(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA"); // Formato YYYY-MM-DD
    return {
      hoyPiezas: prestadas.filter((p) => p.ultimo_movimiento?.fecha?.slice(0, 10) === hoyLocal),
      anteriorPiezas: prestadas.filter((p) => p.ultimo_movimiento?.fecha?.slice(0, 10) !== hoyLocal),
    };
  }, [prestadas]);

  const devolverMut = useMutation({
    mutationFn: (pieza: PiezaPrestada) =>
      registrarEntradaPieza({
        pieza_id: pieza.id,
        responsable_id: responsableId,
        observaciones: "Devolución registrada desde checklist diario.",
      }),
    onMutate: (pieza) => {
      setPendientes((prev) => new Set(prev).add(pieza.id));
    },
    onSuccess: (_, pieza) => {
      setDevueltas((prev) => new Set(prev).add(pieza.id));
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    },
    onSettled: (_, __, pieza) => {
      setPendientes((prev) => {
        const next = new Set(prev);
        next.delete(pieza.id);
        return next;
      });
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

  function handleCheckGrupo(hijas: PiezaPrestada[]) {
    if (!responsableId) {
      alert("Selecciona un responsable antes de registrar devoluciones.");
      return;
    }
    const sinDevolver = hijas.filter((h) => !devueltas.has(h.id));
    sinDevolver.forEach((pieza) => devolverMut.mutate(pieza));
  }

  function toggleGrupo(codigo: string) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
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
      </div>

      {/* Selector de responsable global */}
      <div className="form-panel" style={{ marginBottom: 20 }}>
        <label className="field">
          <span>
            Responsable de las devoluciones <b>*</b>
          </span>
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
          <div
            className="alert-banner alert-banner-warning"
            style={{ margin: "12px 16px 0", borderRadius: 6 }}
          >
            <WarningCircle size={18} />
            <strong>{anteriorPiezas.length} piezas de días anteriores sin devolver</strong>
          </div>
          <p className="checklist-section-label">Préstamos anteriores pendientes</p>
          <ChecklistSection
            piezas={anteriorPiezas}
            devueltas={devueltas}
            pendientes={pendientes}
            gruposAbiertos={gruposAbiertos}
            overdue
            onToggleGrupo={toggleGrupo}
            onCheck={handleCheck}
            onCheckGrupo={handleCheckGrupo}
          />
        </div>
      )}

      {/* Piezas de hoy */}
      {hoyPiezas.length > 0 && (
        <div className="data-panel">
          <p className="checklist-section-label">Préstamos de hoy</p>
          <ChecklistSection
            piezas={hoyPiezas}
            devueltas={devueltas}
            pendientes={pendientes}
            gruposAbiertos={gruposAbiertos}
            overdue={false}
            onToggleGrupo={toggleGrupo}
            onCheck={handleCheck}
            onCheckGrupo={handleCheckGrupo}
          />
        </div>
      )}
    </section>
  );
}

// ─── Agrupa piezas prestadas: sueltas vs. hijas de un mismo estuche ─────────────
function agruparPorContenedor(piezas: PiezaPrestada[]) {
  const grupos = new Map<string, PiezaPrestada[]>();
  const candidatasSueltas: PiezaPrestada[] = [];

  for (const p of piezas) {
    if (p.padre_codigo) {
      const arr = grupos.get(p.padre_codigo) ?? [];
      arr.push(p);
      grupos.set(p.padre_codigo, arr);
    } else {
      candidatasSueltas.push(p);
    }
  }

  const sueltas = candidatasSueltas.filter((p) => !p.codigo || !grupos.has(p.codigo));
  return { grupos, sueltas };
}

// ─── Subcomponente: sección (hoy / anteriores) con grupos + sueltas ─────────────
function ChecklistSection({
  piezas,
  devueltas,
  pendientes,
  gruposAbiertos,
  overdue,
  onToggleGrupo,
  onCheck,
  onCheckGrupo,
}: {
  piezas: PiezaPrestada[];
  devueltas: Set<number>;
  pendientes: Set<number>;
  gruposAbiertos: Set<string>;
  overdue: boolean;
  onToggleGrupo: (codigo: string) => void;
  onCheck: (pieza: PiezaPrestada, checked: boolean) => void;
  onCheckGrupo: (hijas: PiezaPrestada[]) => void;
}) {
  const { grupos, sueltas } = useMemo(() => agruparPorContenedor(piezas), [piezas]);

  return (
    <div className="checklist-list">
      {[...grupos.entries()].map(([codigoContenedor, hijas]) => {
        const hijasPendientes = hijas.filter((h) => !devueltas.has(h.id));
        const abierto = gruposAbiertos.has(codigoContenedor);

        return (
          <div
            key={codigoContenedor}
            style={{ border: "1px solid #e8e8e8", borderRadius: 6, overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f6f6f6",
                padding: "8px 14px",
              }}
            >
              <button
                type="button"
                onClick={() => onToggleGrupo(codigoContenedor)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  flex: 1,
                }}
              >
                {abierto ? <CaretDown size={14} /> : <CaretRight size={14} />}
                <Package size={16} />
                <span style={{ fontSize: 13 }}>
                  <strong>{codigoContenedor}</strong> — estuche ·{" "}
                  {hijasPendientes.length === 0
                    ? "todas las piezas devueltas"
                    : `${hijasPendientes.length} pieza${
                        hijasPendientes.length !== 1 ? "s" : ""
                      } aún prestada${hijasPendientes.length !== 1 ? "s" : ""}`}
                </span>
              </button>

              {/* Botón para devolver todo el grupo */}
              {hijasPendientes.length > 0 ? (
                <button
                  type="button"
                  className="button button-small"
                  style={{ fontSize: 12, padding: "4px 8px" }}
                  onClick={() => onCheckGrupo(hijas)}
                >
                  Devolver todo
                </button>
              ) : (
                <CheckCircle size={16} color="var(--success)" />
              )}
            </div>

            {abierto && (
              <div className="checklist-list" style={{ padding: "8px 10px 8px 30px" }}>
                {hijas.map((h) => (
                  <ChecklistRow
                    key={h.id}
                    pieza={h}
                    devuelta={devueltas.has(h.id)}
                    cargando={pendientes.has(h.id)}
                    overdue={overdue}
                    onCheck={(checked) => onCheck(h, checked)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {sueltas.map((p) => (
        <ChecklistRow
          key={p.id}
          pieza={p}
          devuelta={devueltas.has(p.id)}
          cargando={pendientes.has(p.id)}
          overdue={overdue}
          onCheck={(checked) => onCheck(p, checked)}
        />
      ))}
    </div>
  );
}

// ─── Subcomponente: fila del checklist ──────────────────────────────────────────────────
function ChecklistRow({
  pieza,
  devuelta,
  cargando,
  overdue,
  onCheck,
}: {
  pieza: PiezaPrestada;
  devuelta: boolean;
  cargando: boolean;
  overdue: boolean;
  onCheck: (checked: boolean) => void;
}) {
  return (
    <div
      className={`checklist-row ${overdue ? "is-overdue" : ""} ${devuelta ? "is-devuelta" : ""}`}
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
          <code className="pieza-code">{labelPieza(pieza)}</code> — {pieza.material_nombre}
        </strong>
        <small>
          {pieza.ultimo_movimiento
            ? `Salida: ${new Date(pieza.ultimo_movimiento.fecha).toLocaleString("es-PE", {
                dateStyle: "short",
                timeStyle: "short",
              })} · ${pieza.ultimo_movimiento.responsable}`
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