import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import {
  listMateriales,
  listPiezas,
  listUnidadesMedida,
} from "@/modules/almacen/catalogoRepository";
import { listUsuarios } from "@/modules/almacen/inspeccionRepository";

import {
  crearGrupoSolicitud,
  listOrdenesTrabajoActivas,
  registrarBajaMaterial,
  registrarBajaPieza,
  registrarEntradaMaterial,
  registrarEntradaPieza,
  registrarSalidaMaterial,
  registrarSalidaPieza,
} from "@/modules/almacen/inventarioRepository";
import type { WorkOrderActiva } from "@/modules/almacen/inventarioRepository";
import type { Material, TipoMovimiento, UnidadMedidaCatalogo } from "@/modules/almacen/types";
import { Combobox } from "../components/shared/Combobox";

/**
 * `crypto.randomUUID()` solo existe en contextos seguros (HTTPS o localhost).
 * Cuando la app se abre por HTTP con una IP (ej. http://172.18.10.24:8080),
 * el navegador no expone esa función y la app se cae. Este helper genera un
 * UUID v4 equivalente sin depender de esa API.
 */
function generarUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function Field({
  label,
  required,
  error,
  hint,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {

  return (
    <label className={`field ${wide ? "field-wide" : ""} ${error ? "has-error" : ""}`}>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {hint && !error && <small style={{ color: "var(--muted)", fontSize: 12 }}>{hint}</small>}
      {error && (
        <small className="field-error">
          <WarningCircle size={14} />
          {error}
        </small>
      )}
    </label>
  );
}

function mensajeError(err: any): string {
  return err?.response?.data
    ? Object.values(err.response.data).flat().join(" ")
    : err?.message ?? "Error desconocido";
}

// ── Renglón unificado (Objetivo: mezclar consumibles y piezas retornables
// en Entrada y Salida, un renglón = un material) ────────────────────────────

interface RenglonMovimiento {
  id: string;
  materialId: number;
  // Consumibles (material sin control individual)
  cantidad: number;
  cantidadCajas: number;
  unidadMovimientoId: number | null;
  cantidadEnUnidadMovimiento: string;
  // Piezas (material con control individual)
  modoPieza: "sueltas" | "estuche";
  piezasSeleccionadas: Set<number>; // salida: sueltas disponibles · entrada: prestadas a devolver
  estuchePiezaId: number; // solo salida
  estucheTodasHijas: boolean;
  estucheHijasSeleccionadas: Set<number>;
}

function renglonVacio(materialId = 0): RenglonMovimiento {
  return {
    id: generarUUID(),
    materialId,
    cantidad: 1,
    cantidadCajas: 1,
    unidadMovimientoId: null,
    cantidadEnUnidadMovimiento: "",
    modoPieza: "sueltas",
    piezasSeleccionadas: new Set(),
    estuchePiezaId: 0,
    estucheTodasHijas: true,
    estucheHijasSeleccionadas: new Set(),
  };
}

function unidadesCompatiblesDe(mat: Material | undefined, unidadesMedida: UnidadMedidaCatalogo[]): UnidadMedidaCatalogo[] {
  if (!mat?.unidad_manejo_permite_conversion_unidad) return [];
  const base = unidadesMedida.find((u) => u.id === mat.unidad_movimiento_base);
  if (!base) return [];
  return unidadesMedida.filter((u) => u.activo && u.familia === base.familia);
}

type ResultadoLoteAdmin = { materialNombre: string; ok: boolean; error?: string };

// Selector de piezas dentro de UN renglón. Para salida: piezas sueltas
// disponibles o un estuche completo. Para entrada: piezas prestadas a
// devolver. Cada renglón maneja su propia query — así se pueden tener varios
// materiales con control individual en la misma lista.
function PiezaPickerRenglon({
  tipo,
  materialId,
  renglon,
  onUpdate,
}: {
  tipo: "salida" | "entrada";
  materialId: number;
  renglon: RenglonMovimiento;
  onUpdate: (patch: Partial<RenglonMovimiento>) => void;
}) {
  const { data: piezasDisponibles = [] } = useQuery({
    queryKey: ["piezas-renglon-disponible", materialId],
    queryFn: () => listPiezas({ material: materialId, estado: "Disponible", sin_padre: true }),
    enabled: tipo === "salida" && !!materialId,
  });
  const { data: piezasPrestadasRaw = [] } = useQuery({
    queryKey: ["piezas-renglon-prestado", materialId],
    queryFn: () => listPiezas({ material: materialId, estado: "Prestado" }),
    enabled: tipo === "entrada" && !!materialId,
  });
  const piezasPrestadas = piezasPrestadasRaw.filter((p) => !p.tiene_hijas);
  const piezasSueltas = piezasDisponibles.filter((p) => !p.tiene_hijas);
  const estuches = piezasDisponibles.filter((p) => p.tiene_hijas);
  const estuche = estuches.find((e) => e.id === renglon.estuchePiezaId);

  const { data: hijasDisponibles = [] } = useQuery({
    queryKey: ["piezas-hijas-renglon", renglon.estuchePiezaId],
    queryFn: () => listPiezas({ padre: renglon.estuchePiezaId, estado: "Disponible" }),
    enabled: tipo === "salida" && renglon.estuchePiezaId > 0,
  });

  // Si el material no tiene piezas sueltas (todas están dentro de estuches),
  // "sueltas" es un callejón sin salida — cambiamos automáticamente a "estuche"
  // para que el usuario no se quede viendo "No hay piezas sueltas disponibles".
  useEffect(() => {
    if (tipo === "salida" && renglon.modoPieza === "sueltas" && piezasSueltas.length === 0 && estuches.length > 0) {
      onUpdate({ modoPieza: "estuche" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, renglon.modoPieza, piezasSueltas.length, estuches.length]);

  function togglePieza(id: number) {
    const next = new Set(renglon.piezasSeleccionadas);
    next.has(id) ? next.delete(id) : next.add(id);
    onUpdate({ piezasSeleccionadas: next });
  }

  function toggleHija(id: number) {
    const next = new Set(renglon.estucheHijasSeleccionadas);
    next.has(id) ? next.delete(id) : next.add(id);
    onUpdate({ estucheHijasSeleccionadas: next });
  }

  if (tipo === "entrada") {
    if (piezasPrestadas.length === 0) {
      return <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>No hay piezas prestadas de este material.</p>;
    }
    return (
      <div className="pieza-multiselect" style={{ marginTop: 8 }}>
        <label className="pieza-checkbox-row">
          <input
            type="checkbox"
            checked={renglon.piezasSeleccionadas.size === piezasPrestadas.length}
            onChange={(e) =>
              onUpdate({ piezasSeleccionadas: e.target.checked ? new Set(piezasPrestadas.map((p) => p.id)) : new Set() })
            }
          />
          <strong style={{ fontSize: 13 }}>Todas las prestadas ({piezasPrestadas.length})</strong>
        </label>
        {piezasPrestadas.map((p) => (
          <label key={p.id} className="pieza-checkbox-row">
            <input type="checkbox" checked={renglon.piezasSeleccionadas.has(p.id)} onChange={() => togglePieza(p.id)} />
            <span className="pieza-code">{p.codigo}</span>
            {p.detalle && <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>— {p.detalle}</span>}
          </label>
        ))}
      </div>
    );
  }

  // tipo === "salida"
  if (piezasSueltas.length === 0 && estuches.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>No hay piezas disponibles de este material.</p>;
  }

  return (
    <div style={{ marginTop: 8 }}>
      {estuches.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            className={renglon.modoPieza === "sueltas" ? "button button-secondary button-sm is-active" : "button button-ghost button-sm"}
            style={{ fontSize: 12 }}
            onClick={() => onUpdate({ modoPieza: "sueltas", estuchePiezaId: 0, estucheHijasSeleccionadas: new Set() })}
          >
            Piezas sueltas
          </button>
          <button
            type="button"
            className={renglon.modoPieza === "estuche" ? "button button-secondary button-sm is-active" : "button button-ghost button-sm"}
            style={{ fontSize: 12 }}
            onClick={() => onUpdate({ modoPieza: "estuche", piezasSeleccionadas: new Set() })}
          >
            Estuche completo
          </button>
        </div>
      )}

      {(renglon.modoPieza === "sueltas" || estuches.length === 0) ? (
        piezasSueltas.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            No hay piezas sueltas disponibles{estuches.length > 0 ? " — este material está organizado en estuches, usa \"Estuche completo\"." : "."}
          </p>
        ) : (
          <PiezasSueltasSelector piezasSueltas={piezasSueltas} renglon={renglon} onUpdate={onUpdate} />
        )
      ) : (
        <div>
          <Combobox
            value={renglon.estuchePiezaId}
            selectedLabel={estuche ? `${estuche.codigo} — ${estuche.material_nombre ?? ""}` : ""}
            placeholder="Buscar estuche por código…"
            onChange={(id) => {
              // Cuando se selecciona un estuche, forzamos estucheTodasHijas: false
              // y pre-seleccionamos todas las hijas (el useEffect las cargará en hijasDisponibles).
              onUpdate({ estuchePiezaId: id, estucheTodasHijas: false, estucheHijasSeleccionadas: new Set() });
            }}
            fetchOptions={async (q) => {
              const res = await listPiezas({ material: materialId, estado: "Disponible", sin_padre: true, q });
              return res
                .filter((p) => p.tiene_hijas)
                .map((p) => ({ id: p.id, label: `${p.codigo} — ${p.material_nombre ?? ""}` }));
            }}
          />
          {renglon.estuchePiezaId > 0 && (
            <div style={{ marginTop: 8 }}>
              {hijasDisponibles.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)" }}>No hay items disponibles en este estuche.</p>
              ) : (
                <AutoSelectEstucheHijas
                  hijasDisponibles={hijasDisponibles}
                  renglon={renglon}
                  onUpdate={onUpdate}
                  toggleHija={toggleHija}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente auxiliar que auto-selecciona todas las hijas disponibles al
// montar y permite desmarcar individualmente las que no se vayan a mover.
function AutoSelectEstucheHijas({
  hijasDisponibles,
  renglon,
  onUpdate,
  toggleHija,
}: {
  hijasDisponibles: Array<{ id: number; codigo: string | null; material_nombre?: string | null; material_medida?: string | null; detalle?: string | null }>;
  renglon: RenglonMovimiento;
  onUpdate: (patch: Partial<RenglonMovimiento>) => void;
  toggleHija: (id: number) => void;
}) {
  const hijasIds = hijasDisponibles.map((h) => h.id).join(",");

  // Pre-marcar todas las hijas disponibles al cargar / cambiar el listado
  useEffect(() => {
    onUpdate({ estucheTodasHijas: false, estucheHijasSeleccionadas: new Set(hijasDisponibles.map((h) => h.id)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hijasIds]);

  const selAll = renglon.estucheHijasSeleccionadas.size === hijasDisponibles.length;
  const selNone = renglon.estucheHijasSeleccionadas.size === 0;

  return (
    <div className="pieza-multiselect">
      <label className="pieza-checkbox-row">
        <input
          type="checkbox"
          checked={selAll}
          ref={(el) => { if (el) el.indeterminate = !selAll && !selNone; }}
          onChange={() =>
            onUpdate({
              estucheHijasSeleccionadas: selAll ? new Set() : new Set(hijasDisponibles.map((h) => h.id)),
            })
          }
        />
        <strong style={{ fontSize: 13 }}>Todas las disponibles ({hijasDisponibles.length})</strong>
      </label>
      {hijasDisponibles.map((h) => (
        <label key={h.id} className="pieza-checkbox-row" style={{ marginLeft: 24 }}>
          <input type="checkbox" checked={renglon.estucheHijasSeleccionadas.has(h.id)} onChange={() => toggleHija(h.id)} />
          <span className="pieza-code" style={{ fontSize: 13 }}>{h.codigo}</span>
          {(h.material_nombre || h.material_medida) && (
            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>
              {[h.material_nombre, h.material_medida].filter(Boolean).join(" · ")}
            </span>
          )}
          {h.detalle && (
            <span style={{ fontSize: 12, color: "var(--text)", marginLeft: 4 }}>— {h.detalle}</span>
          )}
        </label>
      ))}
    </div>
  );
}

// Selector de piezas sueltas para UN renglón de salida. La mayoría de las
// veces cualquier pieza suelta sirve igual (rara vez varían en detalle o
// medida), así que por defecto solo se pide una cantidad y se auto-eligen
// las primeras N disponibles. Si el usuario necesita una pieza puntual
// (por su detalle/medida/código), puede desplegar la lista y elegirla.
function PiezasSueltasSelector({
  piezasSueltas,
  renglon,
  onUpdate,
}: {
  piezasSueltas: Array<{ id: number; codigo: string | null; detalle?: string | null }>;
  renglon: RenglonMovimiento;
  onUpdate: (patch: Partial<RenglonMovimiento>) => void;
}) {
  const [modoSeleccion, setModoSeleccion] = useState<"cantidad" | "especifica">("cantidad");
  const [cantidadDeseada, setCantidadDeseada] = useState(1);
  const idsDisponibles = piezasSueltas.map((p) => p.id).join(",");

  // Mientras estamos en modo "cantidad", mantenemos la selección sincronizada
  // tomando las primeras N piezas sueltas disponibles.
  useEffect(() => {
    if (modoSeleccion !== "cantidad") return;
    const n = Math.min(Math.max(cantidadDeseada, 1), piezasSueltas.length);
    onUpdate({ piezasSeleccionadas: new Set(piezasSueltas.slice(0, n).map((p) => p.id)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoSeleccion, cantidadDeseada, idsDisponibles]);

  if (modoSeleccion === "especifica") {
    return (
      <div className="pieza-multiselect">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <strong style={{ fontSize: 13 }}>Elegir piezas específicas</strong>
          <button
            type="button"
            style={{ background: "transparent", border: 0, color: "var(--accent, #6366f1)", cursor: "pointer", fontSize: 12 }}
            onClick={() => {
              setModoSeleccion("cantidad");
              setCantidadDeseada(Math.max(renglon.piezasSeleccionadas.size, 1));
            }}
          >
            ← Volver a cantidad
          </button>
        </div>
        <label className="pieza-checkbox-row">
          <input
            type="checkbox"
            checked={renglon.piezasSeleccionadas.size === piezasSueltas.length}
            onChange={(e) =>
              onUpdate({ piezasSeleccionadas: e.target.checked ? new Set(piezasSueltas.map((p) => p.id)) : new Set() })
            }
          />
          <strong style={{ fontSize: 13 }}>Todas las sueltas ({piezasSueltas.length})</strong>
        </label>
        {piezasSueltas.map((p) => (
          <label key={p.id} className="pieza-checkbox-row">
            <input
              type="checkbox"
              checked={renglon.piezasSeleccionadas.has(p.id)}
              onChange={() => {
                const next = new Set(renglon.piezasSeleccionadas);
                next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                onUpdate({ piezasSeleccionadas: next });
              }}
            />
            <span className="pieza-code">{p.codigo}</span>
            {p.detalle && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>{p.detalle}</span>}
          </label>
        ))}
      </div>
    );
  }

  const seleccionadas = piezasSueltas.filter((p) => renglon.piezasSeleccionadas.has(p.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          Cantidad
          <input
            type="number"
            min={1}
            max={piezasSueltas.length}
            value={cantidadDeseada}
            onChange={(e) =>
              setCantidadDeseada(Math.max(1, Math.min(piezasSueltas.length, Number(e.target.value) || 1)))
            }
            style={{ width: 56, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
          />
        </label>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>de {piezasSueltas.length} disponibles</span>
        <button
          type="button"
          style={{ background: "transparent", border: 0, color: "var(--accent, #6366f1)", cursor: "pointer", fontSize: 12, marginLeft: "auto" }}
          onClick={() => setModoSeleccion("especifica")}
        >
          Elegir una en específico
        </button>
      </div>
      {seleccionadas.length > 0 && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Se usarán: {seleccionadas.map((p) => p.codigo ?? "—").join(", ")}
        </span>
      )}
    </div>
  );
}

export function MovimientoFormPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const esAlmacenero = user?.role === "ALMACENERO";
  const { almacenId } = useAlmacenActivo();
  const [params] = useSearchParams();
  const preselMaterial = params.get("material") ? Number(params.get("material")) : 0;

  const [tipo, setTipo] = useState<TipoMovimiento>("salida");

  // ── Estado exclusivo de Baja (single-material, sin cambios de lógica) ────
  const [materialId, setMaterialId] = useState<number>(preselMaterial);
  const [piezaId, setPiezaId] = useState<number>(0);
  const [cantidad, setCantidad] = useState(1);
  const [cantidadCajas, setCantidadCajas] = useState(1);
  const [unidadMovimientoId, setUnidadMovimientoId] = useState<number | null>(null);
  const [cantidadEnUnidadMovimiento, setCantidadEnUnidadMovimiento] = useState("");

  // ── Estado común ──────────────────────────────────────────────────────
  const [responsableId, setResponsableId] = useState<number>(0);
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [avisoEstuche, setAvisoEstuche] = useState<{ aviso: string; excluidas: number[] } | null>(null);
  const [exito, setExito] = useState(false);
  const [exitoPendiente, setExitoPendiente] = useState<string | null>(null);

  // ── Renglones unificados de Entrada / Salida (Objetivo: mezclar
  // consumibles y piezas retornables) ──────────────────────────────────────
  const [renglones, setRenglones] = useState<RenglonMovimiento[]>([renglonVacio(preselMaterial)]);

  // Orden de Trabajo seleccionada (id como string, UUID) para vincular la salida.
  const [workOrderSelected, setWorkOrderSelected] = useState<string>("");

  // Resultado del lote (tabla ✓/✗ por renglón/pieza).
  const [resultadosAdmin, setResultadosAdmin] = useState<ResultadoLoteAdmin[] | null>(null);

  const [sinOT, setSinOT] = useState(false);

  function agregarRenglon() {
    setRenglones((prev) => [...prev, renglonVacio()]);
  }

  function quitarRenglon(id: string) {
    setRenglones((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function actualizarRenglon(id: string, patch: Partial<RenglonMovimiento>) {
    setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function resetRenglonSelector(id: string) {
    actualizarRenglon(id, {
      cantidad: 1,
      cantidadCajas: 1,
      unidadMovimientoId: null,
      cantidadEnUnidadMovimiento: "",
      modoPieza: "sueltas",
      piezasSeleccionadas: new Set(),
      estuchePiezaId: 0,
      estucheTodasHijas: true,
      estucheHijasSeleccionadas: new Set(),
    });
  }

  const tipoId = useId();

  const { data: materiales = [] } = useQuery({
    queryKey: ["materiales", almacenId],
    queryFn: () => listMateriales(almacenId),
    enabled: !!almacenId,
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });

  const { data: otsActivas = [] } = useQuery<WorkOrderActiva[]>({
    queryKey: ["ots-activas"],
    queryFn: listOrdenesTrabajoActivas,
    enabled: tipo === "salida",
  });

  const { data: unidadesMedida = [] } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: listUnidadesMedida,
  });

  // ── Solo para Baja ────────────────────────────────────────────────────
  const material = materiales.find((m) => m.id === materialId);
  const unidadBase = unidadesMedida.find((u) => u.id === material?.unidad_movimiento_base);
  const unidadesCompatibles = unidadesCompatiblesDe(material, unidadesMedida);

  useEffect(() => {
    if (tipo !== "baja") return;
    if (material?.unidad_manejo_permite_conversion_unidad && unidadBase) {
      setUnidadMovimientoId((prev) => (prev && unidadesCompatibles.some((u) => u.id === prev) ? prev : unidadBase.id));
    } else {
      setUnidadMovimientoId(null);
      setCantidadEnUnidadMovimiento("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, materialId, unidadBase?.id]);

  const { data: piezasBaja = [] } = useQuery({
    queryKey: ["piezas-baja", materialId],
    queryFn: () => listPiezas({ material: materialId }),
    enabled: !!materialId && !!material?.control_individual && tipo === "baja",
  });
  const piezaBaja = piezasBaja.find((p) => p.id === piezaId);

  const mut = useMutation({
    mutationFn: async () => {
      // ═══════════════ BAJA (sin cambios: un material a la vez) ═══════════
      if (tipo === "baja") {
        if (!materialId) throw new Error("Selecciona un material.");
        if (!responsableId) throw new Error("Selecciona un responsable.");

        if (material?.control_individual) {
          if (!piezaId) throw new Error("Selecciona una pieza.");
          return registrarBajaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
        }
        const esPorEmpaque = !!material?.unidad_manejo_requiere_multiplicador;
        const esPorConversion = !!material?.unidad_manejo_permite_conversion_unidad;
        const cantidadPayload = esPorEmpaque || esPorConversion ? undefined : cantidad;
        const cantidadCajasPayload = esPorEmpaque ? cantidadCajas : undefined;
        const conversionPayload = esPorConversion
          ? {
              unidad_movimiento_id: unidadMovimientoId ?? undefined,
              cantidad_en_unidad_movimiento: cantidadEnUnidadMovimiento ? Number(cantidadEnUnidadMovimiento) : undefined,
            }
          : {};
        if (esPorConversion && (!unidadMovimientoId || !cantidadEnUnidadMovimiento)) {
          throw new Error(`Indica la cantidad y la unidad (${unidadBase?.nombre ?? "unidad base"} u otra compatible).`);
        }
        return registrarBajaMaterial({
          material_id: materialId,
          cantidad: cantidadPayload,
          cantidad_cajas: cantidadCajasPayload,
          responsable_id: responsableId,
          observaciones,
          ...conversionPayload,
        });
      }

      // ═══════ ENTRADA / SALIDA — lista unificada (consumibles + piezas) ═══
      if (!responsableId) throw new Error("Selecciona un responsable.");
      const renglonesValidos = renglones.filter((r) => r.materialId > 0);
      if (renglonesValidos.length === 0) throw new Error("Agrega al menos un material a la lista.");

      const consumibleRenglones = renglonesValidos.filter((r) => {
        const m = materiales.find((mm) => mm.id === r.materialId);
        return m && !m.control_individual;
      });
      const piezaRenglones = renglonesValidos.filter((r) => {
        const m = materiales.find((mm) => mm.id === r.materialId);
        return m && m.control_individual;
      });

      for (const r of piezaRenglones) {
        const m = materiales.find((mm) => mm.id === r.materialId)!;
        if (tipo === "entrada") {
          if (r.piezasSeleccionadas.size === 0) {
            throw new Error(`Selecciona al menos una pieza a devolver de "${m.nombre}".`);
          }
        } else {
          const tieneSueltas = r.piezasSeleccionadas.size > 0;
          const tieneEstuche = r.modoPieza === "estuche" && r.estuchePiezaId > 0;
          if (!tieneSueltas && !tieneEstuche) {
            throw new Error(`Selecciona pieza(s) o un estuche de "${m.nombre}".`);
          }
        }
      }

      // ── ENTRADA: siempre directa, sin flujo de aprobación ──────────────
      if (tipo === "entrada") {
        const resultados: ResultadoLoteAdmin[] = [];
        for (const r of consumibleRenglones) {
          const m = materiales.find((mm) => mm.id === r.materialId)!;
          const esEmp = !!m.unidad_manejo_requiere_multiplicador;
          const esConv = !!m.unidad_manejo_permite_conversion_unidad;
          try {
            await registrarEntradaMaterial({
              material_id: r.materialId,
              cantidad: esEmp || esConv ? undefined : r.cantidad,
              cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
              unidad_movimiento_id: esConv ? r.unidadMovimientoId ?? undefined : undefined,
              cantidad_en_unidad_movimiento:
                esConv && r.cantidadEnUnidadMovimiento ? Number(r.cantidadEnUnidadMovimiento) : undefined,
              responsable_id: responsableId,
              observaciones,
            });
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: true });
          } catch (err: any) {
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: false, error: mensajeError(err) });
          }
        }
        for (const r of piezaRenglones) {
          const m = materiales.find((mm) => mm.id === r.materialId)!;
          for (const piezaIdSel of r.piezasSeleccionadas) {
            try {
              await registrarEntradaPieza({ pieza_id: piezaIdSel, responsable_id: responsableId, observaciones });
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: true });
            } catch (err: any) {
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: false, error: mensajeError(err) });
            }
          }
        }
        setResultadosAdmin(resultados);
        return resultados.every((r) => r.ok) ? { batchCompleto: true } : { batchParcial: true };
      }

      // ── SALIDA ──────────────────────────────────────────────────────────
      const referenciaFinal = workOrderSelected
        ? (otsActivas.find((o) => o.id === workOrderSelected)?.code ?? referencia)
        : referencia;

      if (esAlmacenero) {
        // Consumibles → solicitud en lote (requiere aprobación, como antes).
        // Piezas → salida directa (como antes: el checkout de piezas nunca
        // pasó por aprobación en este sistema).
        const resultados: ResultadoLoteAdmin[] = [];
        let solicitudEnviada = false;

        if (consumibleRenglones.length > 0) {
          await crearGrupoSolicitud({
            work_order: workOrderSelected || null,
            observaciones,
            items: consumibleRenglones.map((r) => {
              const m = materiales.find((mm) => mm.id === r.materialId)!;
              const esEmp = !!m.unidad_manejo_requiere_multiplicador;
              return {
                tipo: "salida_material" as const,
                material: r.materialId,
                cantidad: esEmp ? undefined : r.cantidad,
                cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
              };
            }),
          });
          solicitudEnviada = true;
        }

        for (const r of piezaRenglones) {
          const m = materiales.find((mm) => mm.id === r.materialId)!;
          if (r.piezasSeleccionadas.size > 0) {
            for (const piezaIdSel of r.piezasSeleccionadas) {
              try {
                await registrarSalidaPieza({ pieza_id: piezaIdSel, responsable_id: responsableId, referencia_externa: referenciaFinal, observaciones });
                resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: true });
              } catch (err: any) {
                resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: false, error: mensajeError(err) });
              }
            }
          } else if (r.estuchePiezaId > 0) {
            try {
              const resp = await registrarSalidaPieza({
                pieza_id: r.estuchePiezaId,
                responsable_id: responsableId,
                referencia_externa: referenciaFinal,
                observaciones,
                piezas_hijas_ids: r.estucheTodasHijas ? undefined : Array.from(r.estucheHijasSeleccionadas),
              });
              const nota = resp.aviso ? ` — ⚠ ${resp.aviso}` : "";
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (estuche)${nota}`, ok: true });
            } catch (err: any) {
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (estuche)`, ok: false, error: mensajeError(err) });
            }
          }
        }

        if (resultados.length > 0) setResultadosAdmin(resultados);

        if (solicitudEnviada) {
          return {
            solicitud_grupo_id: true,
            mensaje:
              resultados.length > 0
                ? "Solicitud de materiales consumibles enviada para aprobación. Las piezas seleccionadas ya salieron del almacén."
                : "Solicitud enviada para aprobación.",
          };
        }
        return resultados.every((r) => r.ok) ? { batchCompleto: true } : { batchParcial: true };
      }

      // ADMIN: todo directo, mismo lote_id.
      const loteId = generarUUID().slice(0, 12);
      const resultados: ResultadoLoteAdmin[] = [];
      for (const r of consumibleRenglones) {
        const m = materiales.find((mm) => mm.id === r.materialId)!;
        const esEmp = !!m.unidad_manejo_requiere_multiplicador;
        const esConv = !!m.unidad_manejo_permite_conversion_unidad;
        try {
          await registrarSalidaMaterial({
            material_id: r.materialId,
            cantidad: esEmp || esConv ? undefined : r.cantidad,
            cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
            unidad_movimiento_id: esConv ? r.unidadMovimientoId ?? undefined : undefined,
            cantidad_en_unidad_movimiento:
              esConv && r.cantidadEnUnidadMovimiento ? Number(r.cantidadEnUnidadMovimiento) : undefined,
            responsable_id: responsableId,
            referencia_externa: referenciaFinal,
            observaciones,
            lote_id: loteId,
          });
          resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: true });
        } catch (err: any) {
          resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: false, error: mensajeError(err) });
        }
      }
      for (const r of piezaRenglones) {
        const m = materiales.find((mm) => mm.id === r.materialId)!;
        if (r.piezasSeleccionadas.size > 0) {
          for (const piezaIdSel of r.piezasSeleccionadas) {
            try {
              await registrarSalidaPieza({ pieza_id: piezaIdSel, responsable_id: responsableId, referencia_externa: referenciaFinal, observaciones });
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: true });
            } catch (err: any) {
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: false, error: mensajeError(err) });
            }
          }
        } else if (r.estuchePiezaId > 0) {
          try {
            const resp = await registrarSalidaPieza({
              pieza_id: r.estuchePiezaId,
              responsable_id: responsableId,
              referencia_externa: referenciaFinal,
              observaciones,
              piezas_hijas_ids: r.estucheTodasHijas ? undefined : Array.from(r.estucheHijasSeleccionadas),
            });
            const nota = resp.aviso ? ` — ⚠ ${resp.aviso}` : "";
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (estuche)${nota}`, ok: true });
          } catch (err: any) {
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (estuche)`, ok: false, error: mensajeError(err) });
          }
        }
      }
      setResultadosAdmin(resultados);
      return resultados.every((r) => r.ok) ? { batchCompleto: true } : { batchParcial: true };
    },
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
      qc.invalidateQueries({ queryKey: ["grupos-solicitud"] });
      qc.invalidateQueries({ queryKey: ["materiales"] });
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      qc.invalidateQueries({ queryKey: ["piezas-renglon-disponible"] });
      qc.invalidateQueries({ queryKey: ["piezas-renglon-prestado"] });
      qc.invalidateQueries({ queryKey: ["piezas-baja", materialId] });

      if (resp && typeof resp === "object" && ("batchCompleto" in resp || "batchParcial" in resp)) {
        if ("batchCompleto" in resp) {
          setExito(true);
        }
        return;
      }

      if (resp && typeof resp === "object" && "solicitud_grupo_id" in resp) {
        setExitoPendiente(resp.mensaje);
        return;
      }
      if (resp && typeof resp === "object" && !Array.isArray(resp) && "aviso" in resp) {
        const r = resp as { aviso?: string; hijas_excluidas?: number[] };
        if (r.aviso) {
          setAvisoEstuche({ aviso: r.aviso, excluidas: r.hijas_excluidas ?? [] });
          return;
        }
      }
      setExito(true);
    },
    onError: (e: any) => {
      setError(mensajeError(e));
    },
  });

  if (exitoPendiente) {
    return (
      <section className="success-panel">
        <h2 style={{ color: "var(--accent-600, #2563eb)" }}>⏳ Solicitud enviada — pendiente de aprobación</h2>
        <p style={{ maxWidth: 440, textAlign: "center", color: "var(--neutral-600)" }}>{exitoPendiente}</p>
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/${almacenId}/movimientos`}>
            Ver historial
          </Link>
          <Link className="button button-secondary" to={`/almacen/${almacenId}/movimientos/nuevo`}>
            Nueva solicitud
          </Link>
        </div>
      </section>
    );
  }

  if (exito || avisoEstuche) {
    return (
      <section className="success-panel">
        <h2>
          {tipo === "salida"
            ? "✓ Salida registrada con éxito"
            : tipo === "entrada"
            ? "✓ Entrada registrada con éxito"
            : "✓ Baja registrada con éxito"}
        </h2>
        {avisoEstuche && (
          <div className="aviso-estuche" style={{ maxWidth: 480, margin: "0 auto 20px", textAlign: "left" }}>
            <strong>⚠ Estuche incompleto</strong>
            {avisoEstuche.aviso}
            <p style={{ fontSize: 12, marginTop: 8 }}>
              {avisoEstuche.excluidas.length} pieza(s) no salieron por no estar disponibles.
            </p>
          </div>
        )}
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/${almacenId}/movimientos`}>
            Ver historial
          </Link>
          {materialId > 0 && (
            <Link className="button button-secondary" to={`/almacen/${almacenId}/catalogo/${materialId}`}>
              Ver material
            </Link>
          )}
          <button
            className="button button-secondary"
            onClick={() => {
              setExito(false);
              setAvisoEstuche(null);
              setPiezaId(0);
              setCantidad(1);
              setRenglones([renglonVacio()]);
              setResultadosAdmin(null);
              setObservaciones("");
              setReferencia("");
              setWorkOrderSelected("");
              setSinOT(false);
            }}
          >
            Registrar otro
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="wizard-heading">
        <Link to={`/almacen/${almacenId}/movimientos`} className="back-link">
          <ArrowLeft size={16} /> Movimientos
        </Link>
        <div>
          <p className="breadcrumb">Almacén / Movimientos / Nuevo</p>
          <h1>Registrar movimiento</h1>
        </div>
      </div>

      <form
        className="wizard-layout"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setResultadosAdmin(null);
          mut.mutate();
        }}
        noValidate
      >
        <div style={{ display: "grid", gap: 20 }}>
          {/* Tipo de movimiento */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Tipo</span>
              <h2>¿Qué deseas registrar?</h2>
            </div>
            <div className="segmented-control segmented-3" role="group" aria-labelledby={tipoId}>
              {(["salida", "entrada", "baja"] as TipoMovimiento[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={tipo === t ? "is-active" : ""}
                  onClick={() => {
                    setTipo(t);
                    setPiezaId(0);
                    setRenglones([renglonVacio()]);
                    setResultadosAdmin(null);
                    setSinOT(false);
                    setWorkOrderSelected("");
                    setReferencia("");
                  }}
                >
                  {t === "salida" ? "Salida" : t === "entrada" ? "Entrada / Devolución" : "Baja"}
                </button>
              ))}
            </div>
          </div>

          {/* Material / Renglones */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Materiales</h2>
            </div>

            {tipo === "baja" ? (
              /* ══════════════ BAJA: un solo material a la vez ══════════════ */
              <div className="form-grid">
                <Field label="Material" required>
                  <Combobox
                    value={materialId}
                    selectedLabel={material ? `${material.codigo} — ${material.nombre}` : ""}
                    placeholder="Buscar por código o nombre…"
                    onChange={(id) => {
                      setMaterialId(id);
                      setPiezaId(0);
                    }}
                    fetchOptions={async (q) => {
                      const res = await listMateriales(almacenId, { q });
                      return res.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }));
                    }}
                  />
                </Field>

                {material?.control_individual ? (
                  <Field label="Pieza" required>
                    <Combobox
                      value={piezaId}
                      selectedLabel={
                        piezaBaja
                          ? `${piezaBaja.codigo} — ${piezaBaja.material_nombre}${
                              piezaBaja.material_medida ? ` (${piezaBaja.material_medida})` : ""
                            } · ${piezaBaja.estado}${piezaBaja.tiene_hijas ? " [estuche]" : ""}`
                          : ""
                      }
                      placeholder="Buscar por código…"
                      onChange={(id) => setPiezaId(id)}
                      fetchOptions={async (q) => {
                        const res = await listPiezas({ material: materialId, q });
                        return res.map((p) => ({
                          id: p.id,
                          label: `${p.codigo} — ${p.material_nombre}${
                            p.material_medida ? ` (${p.material_medida})` : ""
                          } · ${p.estado}${p.tiene_hijas ? " [estuche]" : ""}`,
                        }));
                      }}
                    />
                  </Field>
                ) : material ? (
                  material.unidad_manejo_requiere_multiplicador ? (
                    <Field
                      label={`Cantidad de ${material.unidad_manejo_nombre ?? "empaque"}`}
                      required
                      hint={`Cada ${material.unidad_manejo_nombre ?? "empaque"} trae ${material.unidades_por_caja ?? "?"} unidades · Total: ${
                        cantidadCajas * (material.unidades_por_caja ?? 0)
                      } unidades`}
                    >
                      <input
                        type="number"
                        min={1}
                        max={Math.floor(material.cantidad_total / (material.unidades_por_caja || 1))}
                        value={cantidadCajas}
                        onChange={(e) => setCantidadCajas(Number(e.target.value))}
                      />
                    </Field>
                  ) : material.unidad_manejo_permite_conversion_unidad ? (
                    <>
                      <Field
                        label="Unidad"
                        required
                        hint={`El stock de este material se guarda en ${material.unidad_movimiento_base_nombre ?? "su unidad base"}. Elige en qué unidad quieres registrar la cantidad.`}
                      >
                        <select
                          value={unidadMovimientoId ?? ""}
                          onChange={(e) => setUnidadMovimientoId(e.target.value ? Number(e.target.value) : null)}
                        >
                          {unidadesCompatibles.map((u) => (
                            <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>
                          ))}
                        </select>
                      </Field>
                      <Field label={`Cantidad (${unidadesMedida.find((u) => u.id === unidadMovimientoId)?.abreviatura ?? ""})`} required>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={cantidadEnUnidadMovimiento}
                          onChange={(e) => setCantidadEnUnidadMovimiento(e.target.value)}
                          placeholder="Ej. 1.5"
                        />
                      </Field>
                    </>
                  ) : (
                    <Field label="Cantidad" required>
                      <input
                        type="number"
                        min={1}
                        max={material.cantidad_total}
                        value={cantidad}
                        onChange={(e) => setCantidad(Number(e.target.value))}
                      />
                    </Field>
                  )
                ) : null}
              </div>
            ) : (
              /* ══════ ENTRADA / SALIDA: lista unificada (consumibles + piezas) ══════ */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "var(--muted, #6b7280)", margin: 0 }}>
                  {tipo === "salida"
                    ? "Agrega los materiales que saldrán: indica cantidad o con control individual."
                    : "Agrega los materiales que se devuelven: consumibles (indica cantidad) o con control individual (elige qué pieza prestada devuelves)."}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {renglones.map((r, index) => {
                    const matObj = materiales.find((m) => m.id === r.materialId);
                    const esControlIndividual = !!matObj?.control_individual;
                    const esEmp = !!matObj?.unidad_manejo_requiere_multiplicador;
                    const esConv = !!matObj?.unidad_manejo_permite_conversion_unidad;
                    const unidadesRenglon = unidadesCompatiblesDe(matObj, unidadesMedida);

                    return (
                      <div
                        key={r.id}
                        style={{
                          background: "var(--surface-subtle, #f9fafb)",
                          padding: 12,
                          borderRadius: 8,
                          border: "1px solid var(--border, #e5e7eb)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ flex: 2 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                              Material #{index + 1}
                            </label>
                            <Combobox
                              value={r.materialId}
                              selectedLabel={
                                matObj
                                  ? `${matObj.codigo} — ${matObj.nombre}${matObj.control_individual ? " · piezas" : ""}`
                                  : ""
                              }
                              placeholder="Buscar material, retornable o no…"
                              onChange={(id) => {
                                const nuevo = materiales.find((mm) => mm.id === id);
                                actualizarRenglon(r.id, {
                                  materialId: id,
                                  cantidad: 1,
                                  cantidadCajas: 1,
                                  unidadMovimientoId: nuevo?.unidad_manejo_permite_conversion_unidad
                                    ? (nuevo.unidad_movimiento_base as number) ?? null
                                    : null,
                                  cantidadEnUnidadMovimiento: "",
                                  modoPieza: "sueltas",
                                  piezasSeleccionadas: new Set(),
                                  estuchePiezaId: 0,
                                  estucheTodasHijas: true,
                                  estucheHijasSeleccionadas: new Set(),
                                });
                              }}
                              fetchOptions={async (q) => {
                                const res = await listMateriales(almacenId, { q });
                                return res.map((m) => ({
                                  id: m.id,
                                  label: `${m.codigo} — ${m.nombre}${m.control_individual ? " · piezas" : ""}`,
                                }));
                              }}
                            />
                          </div>

                          {matObj && !esControlIndividual && (
                            esEmp ? (
                              <div style={{ width: 140 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                                  {`Cant. (${matObj.unidad_manejo_nombre ?? "empaque"})`}
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={r.cantidadCajas || 1}
                                  onChange={(e) => actualizarRenglon(r.id, { cantidadCajas: Number(e.target.value) })}
                                  style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                                />
                                <small style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>
                                  {`× ${matObj.unidades_por_caja ?? 1} u.`}
                                </small>
                              </div>
                            ) : esConv ? (
                              <>
                                <div style={{ width: 130 }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Unidad</label>
                                  <select
                                    value={r.unidadMovimientoId ?? ""}
                                    onChange={(e) => actualizarRenglon(r.id, { unidadMovimientoId: e.target.value ? Number(e.target.value) : null })}
                                    style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                                  >
                                    {unidadesRenglon.map((u) => (
                                      <option key={u.id} value={u.id}>{u.abreviatura}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ width: 120 }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Cantidad</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={r.cantidadEnUnidadMovimiento}
                                    onChange={(e) => actualizarRenglon(r.id, { cantidadEnUnidadMovimiento: e.target.value })}
                                    placeholder="Ej. 1.5"
                                    style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                                  />
                                </div>
                              </>
                            ) : (
                              <div style={{ width: 120 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                                  Cantidad (u.)
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={r.cantidad}
                                  onChange={(e) => actualizarRenglon(r.id, { cantidad: Number(e.target.value) })}
                                  style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                                />
                              </div>
                            )
                          )}

                          {renglones.length > 1 && (
                            <button
                              type="button"
                              onClick={() => quitarRenglon(r.id)}
                              style={{
                                marginTop: 22,
                                padding: "6px 10px",
                                background: "#fee2e2",
                                color: "#dc2626",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                              title="Quitar este material"
                            >
                              ✕ Quitar
                            </button>
                          )}
                        </div>

                        {matObj && esControlIndividual && r.materialId > 0 && (
                          <PiezaPickerRenglon
                            tipo={tipo as "salida" | "entrada"}
                            materialId={r.materialId}
                            renglon={r}
                            onUpdate={(patch) => actualizarRenglon(r.id, patch)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div>
                  <button type="button" className="button button-secondary button-sm" onClick={agregarRenglon} style={{ fontSize: 13 }}>
                    + Agregar otro material
                  </button>
                </div>

                {esAlmacenero && tipo === "salida" && renglones.some((r) => materiales.find((m) => m.id === r.materialId)?.control_individual) && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                    Nota: las piezas con control individual salen de inmediato; los materiales consumibles de esta lista se envían como solicitud pendiente de aprobación.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Responsable y extras */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 2</span>
              <h2>Responsable y referencia</h2>
            </div>
            <div className="form-grid">
              <Field label="Responsable" required error={error ? error : undefined}>
                <select value={responsableId || ""} onChange={(e) => setResponsableId(Number(e.target.value))}>
                  <option value="">Seleccionar responsable…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u as any).nombre || (u as any).full_name || [ (u as any).first_name, (u as any).last_name ].filter(Boolean).join(" ") || (u as any).username}
                    </option>
                  ))}
                </select>
              </Field>
              {tipo === "salida" && (
                <>
                  <Field label="Vínculo con Orden de Trabajo" wide>
                    <div className="ot-checkbox-row">
                      <input
                        id="sinOT-check"
                        type="checkbox"
                        checked={sinOT}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSinOT(checked);
                          if (checked) {
                            setWorkOrderSelected("");
                            setReferencia("");
                          }
                        }}
                      />
                      <label htmlFor="sinOT-check">
                        Este movimiento no está vinculado a ninguna Orden de Trabajo
                      </label>
                    </div>
                  </Field>

                  {!sinOT && (
                    <>
                      <Field label="Orden de Trabajo" hint="Vincular a una OT activa (opcional)">
                        <select
                          value={workOrderSelected}
                          onChange={(e) => {
                            setWorkOrderSelected(e.target.value);
                            if (e.target.value) setReferencia("");
                          }}
                        >
                          <option value="">Seleccionar Orden de Trabajo…</option>
                          {otsActivas.map((ot) => (
                            <option key={ot.id} value={ot.id}>
                              {ot.code} — {ot.status_display} ({ot.technician_name})
                            </option>
                          ))}
                        </select>
                      </Field>

                      {!workOrderSelected && (
                        <Field label="Referencia manual">
                          <input
                            type="text"
                            value={referencia}
                            onChange={(e) => setReferencia(e.target.value)}
                            placeholder="Código manual u observaciones de referencia"
                          />
                        </Field>
                      )}
                    </>
                  )}
                </>
              )}
              <Field label="Observaciones" wide>
                <textarea
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Comentarios adicionales sobre el movimiento..."
                />
              </Field>
            </div>
          </div>

          {/* Resultados del lote (Entrada o Salida con varios renglones) */}
          {resultadosAdmin && (
            <div className="form-panel" style={{ borderLeft: "4px solid var(--accent, #2563eb)" }}>
              <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>Resultado de la operación</h3>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                {resultadosAdmin.map((r, i) => (
                  <li
                    key={i}
                    style={{ color: r.ok ? "var(--success, #16a34a)" : "var(--error, #dc2626)", marginBottom: 4 }}
                  >
                    <strong>{r.materialNombre}:</strong> {r.ok ? "Registrado con éxito" : `Error: ${r.error}`}
                  </li>
                ))}
              </ul>
              {resultadosAdmin.some((x) => !x.ok) && (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, marginBottom: 0 }}>
                  Los renglones con ✗ se conservan en el formulario para que puedas corregir y reintentar.
                </p>
              )}
              {resultadosAdmin.some((x) => x.ok) && (
                <Link
                  to={`/almacen/${almacenId}/movimientos`}
                  className="button button-secondary button-sm"
                  style={{ marginTop: 12, display: "inline-flex" }}
                >
                  Ver movimientos
                </Link>
              )}
            </div>
          )}

          {error && (
            <div className="alert-banner alert-banner-error">
              <WarningCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-actions">
            <Link to={`/almacen/${almacenId}/movimientos`} className="button button-secondary">
              <ArrowLeft size={15} /> Cancelar
            </Link>
            <button
              type="submit"
              className="button button-primary"
              disabled={mut.isPending}
            >
              {mut.isPending ? "Registrando…" : "Confirmar movimiento"}
            </button>
          </div>
        </div>

        <div className="help-panel">
          <h2>Flujo según tipo</h2>
          <ul>
            <li><strong>Salida:</strong> registra que el material/pieza salió del almacén.</li>
            <li><strong>Entrada:</strong> registra la devolución o reingreso.</li>
            <li><strong>Baja:</strong> da de baja definitiva el material o pieza.</li>
          </ul>
          {tipo === "baja" ? (
            material?.control_individual ? (
              <div className="help-note">Selecciona la pieza física específica (por código y nombre).</div>
            ) : material ? (
              <div className="help-note">
                {material.unidad_manejo_requiere_multiplicador
                  ? `Este material es consumible y se maneja por ${material.unidad_manejo_nombre ?? "empaque"} (${material.unidades_por_caja ?? "?"} unidades c/u). Indica cuántos mover.`
                  : material.unidad_manejo_permite_conversion_unidad
                  ? `Este material se guarda en ${material.unidad_movimiento_base_nombre ?? "su unidad base"}. Elige la unidad y la cantidad a mover.`
                  : "Este material es consumible. Indica la cantidad a mover."}
              </div>
            ) : null
          ) : null}
        </div>
      </form>
    </section>
  );
}