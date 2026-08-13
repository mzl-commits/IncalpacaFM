import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { labelPieza } from "@/utils/pieza";

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
import type { RenglonSalida, WorkOrderActiva } from "@/modules/almacen/inventarioRepository";
import type { PiezaBase, TipoMovimiento } from "@/modules/almacen/types";
import { Combobox } from "../components/shared/Combobox";
import { ResumenCarrito } from "../components/ResumenCarrito";
import type { ItemCarrito } from "../components/ResumenCarrito";
import { useAuth } from "@/modules/accounts/AuthContext";

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

// Selector de UN estuche dentro de la grilla multi-estuche de salida.
// Cada instancia maneja su propia query de piezas hijas, para poder tener
// varios estuches seleccionados a la vez (Objetivo: agregar más estuches).
function EstucheSalidaSelector({
  materialId, renglon, excluirIds, onCambiarPieza, onCambiarTodas, onToggleHija, onQuitar, mostrarQuitar,
}: {
  materialId: number;
  renglon: EstucheSeleccion;
  excluirIds: number[];
  onCambiarPieza: (piezaId: number) => void;
  onCambiarTodas: (checked: boolean) => void;
  onToggleHija: (hijaId: number) => void;
  onQuitar: () => void;
  mostrarQuitar: boolean;
}) {
  const { data: estuchePieza } = useQuery({
    queryKey: ["pieza-estuche-seleccionado", renglon.piezaId],
    queryFn: () => listPiezas({ material: materialId, estado: "Disponible", sin_padre: true }),
    enabled: renglon.piezaId > 0,
  });
  const pieza = (estuchePieza ?? []).find((p) => p.id === renglon.piezaId);

  const { data: hijasDisponibles = [] } = useQuery({
    queryKey: ["piezas-hijas", renglon.piezaId],
    queryFn: () => listPiezas({ padre: renglon.piezaId, estado: "Disponible" }),
    enabled: renglon.piezaId > 0,
  });

  return (
    <div style={{ background: "var(--surface-subtle, #f9fafb)", padding: 12, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <Combobox
            value={renglon.piezaId}
            selectedLabel={
              pieza
                ? `${pieza.codigo} — ${pieza.material_nombre}${pieza.material_medida ? ` (${pieza.material_medida})` : ""} · ${pieza.estado} [estuche]`
                : ""
            }
            placeholder="Buscar estuche por código…"
            onChange={onCambiarPieza}
            fetchOptions={async (q) => {
              const res = await listPiezas({ material: materialId, estado: "Disponible", sin_padre: true, q });
              return res
                .filter((p) => p.tiene_hijas && !excluirIds.includes(p.id))
                .map((p) => ({
                  id: p.id,
                  label: `${p.codigo} — ${p.material_nombre}${p.material_medida ? ` (${p.material_medida})` : ""} · ${p.estado} [estuche]`,
                }));
            }}
          />
        </div>
        {mostrarQuitar && (
          <button
            type="button"
            onClick={onQuitar}
            style={{ padding: "6px 10px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            title="Quitar este estuche"
          >
            ✕ Quitar
          </button>
        )}
      </div>

      {renglon.piezaId > 0 && (
        <div style={{ marginTop: 10 }}>
          {hijasDisponibles.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No hay items disponibles en este estuche.</p>
          ) : (
            <div className="pieza-multiselect">
              <label className="pieza-checkbox-row">
                <input
                  type="checkbox"
                  checked={renglon.todasHijas}
                  onChange={(e) => onCambiarTodas(e.target.checked)}
                />
                <strong style={{ fontSize: 13 }}>Todas las disponibles ({hijasDisponibles.length})</strong>
              </label>
              {!renglon.todasHijas && hijasDisponibles.map((h) => (
                <label key={h.id} className="pieza-checkbox-row" style={{ marginLeft: 24 }}>
                  <input
                    type="checkbox"
                    checked={renglon.hijasSeleccionadas.has(h.id)}
                    onChange={() => onToggleHija(h.id)}
                  />
                  <span style={{ fontSize: 13 }}>
                    <b>{labelPieza(h)}</b>
                    {h.material_nombre && (
                      <span style={{ color: "var(--muted)", marginLeft: 6 }}>
                        {h.material_nombre}{h.material_medida ? ` (${h.material_medida})` : ""}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Renglón vacío por defecto para inicializar/agregar filas de la grilla multi-material.
// ⚠️ VERIFICAR: si RenglonSalida en inventarioRepository.ts define los campos con otros
// nombres o tipos (ej. cantidad_cajas en vez de cantidadCajas), ajusta esta función y
// los onChange de más abajo para que coincidan exactamente.
function renglonVacio(): RenglonSalida {
  return {
    id: crypto.randomUUID(),
    materialId: 0,
    cantidad: 1,
    cantidadCajas: 1,
  } as RenglonSalida;
}

type ResultadoLoteAdmin = { materialNombre: string; ok: boolean; error?: string };

interface EstucheSeleccion {
  id: string;
  piezaId: number;
  todasHijas: boolean;
  hijasSeleccionadas: Set<number>;
}

function estucheVacio(): EstucheSeleccion {
  return {
    id: crypto.randomUUID(),
    piezaId: 0,
    todasHijas: true,
    hijasSeleccionadas: new Set(),
  };
}

export function MovimientoFormPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const esAlmacenero = user?.role === "ALMACENERO";
  const { almacenId } = useAlmacenActivo();
  const [params] = useSearchParams();
  const preselMaterial = params.get("material") ? Number(params.get("material")) : 0;

  const [tipo, setTipo] = useState<TipoMovimiento>("salida");
  const [materialId, setMaterialId] = useState<number>(preselMaterial);
  const [piezaId, setPiezaId] = useState<number>(0);
  const [cantidad, setCantidad] = useState(1);
  const [cantidadCajas, setCantidadCajas] = useState(1);
  const [unidadMovimientoId, setUnidadMovimientoId] = useState<number | null>(null);
  const [cantidadEnUnidadMovimiento, setCantidadEnUnidadMovimiento] = useState("");
  const [responsableId, setResponsableId] = useState<number>(0);
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [avisoEstuche, setAvisoEstuche] = useState<{ aviso: string; excluidas: number[] } | null>(null);
  const [exito, setExito] = useState(false);
  const [exitoPendiente, setExitoPendiente] = useState<string | null>(null);
  const [modoSalida, setModoSalida] = useState<"consumibles" | "pieza">("consumibles");

  // Grilla de renglones para salida de materiales consumibles (sin control individual)
  const [renglones, setRenglones] = useState<RenglonSalida[]>([renglonVacio()]);

  // Orden de Trabajo seleccionada (id como string, UUID) para vincular la salida.
  const [workOrderSelected, setWorkOrderSelected] = useState<string>("");

  // Resultado del batch cuando el usuario es ADMIN (tabla ✓/✗ por renglón).
  const [resultadosAdmin, setResultadosAdmin] = useState<ResultadoLoteAdmin[] | null>(null);

  function agregarRenglon() {
    setRenglones((prev) => [...prev, renglonVacio()]);
  }

  function quitarRenglon(id: string) {
    setRenglones((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function actualizarRenglon(id: string, campo: "materialId" | "cantidad" | "cantidadCajas", valor: number) {
    setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)));
  }
  // ─────────────────────────────────────────────────────────────────────────

  // F2b: uno o más estuches seleccionados para salida (Objetivo: agregar más estuches).
  const [estuchesSeleccionados, setEstuchesSeleccionados] = useState<EstucheSeleccion[]>([]);

  // F4: checklist de piezas sueltas (no-estuche) para salida múltiple.
  const [piezasSalidaSeleccionadas, setPiezasSalidaSeleccionadas] = useState<Set<number>>(new Set());

  // F3: checklist de piezas prestadas a devolver (entrada)
  const [prestadasSeleccionadas, setPrestadasSeleccionadas] = useState<Set<number>>(new Set());

  // Objetivo: permitir que un movimiento de salida no esté ligado a ninguna OT.
  const [sinOT, setSinOT] = useState(false);

  function agregarEstuche() {
    setPiezasSalidaSeleccionadas(new Set());
    setEstuchesSeleccionados((prev) => [...prev, estucheVacio()]);
  }

  function quitarEstuche(id: string) {
    setEstuchesSeleccionados((prev) => prev.filter((e) => e.id !== id));
  }

  function actualizarEstuchePieza(id: string, piezaId: number) {
    setEstuchesSeleccionados((prev) =>
      prev.map((e) => (e.id === id ? { ...e, piezaId, todasHijas: true, hijasSeleccionadas: new Set() } : e))
    );
  }

  function actualizarEstucheTodas(id: string, checked: boolean) {
    setEstuchesSeleccionados((prev) =>
      prev.map((e) => (e.id === id ? { ...e, todasHijas: checked, hijasSeleccionadas: checked ? new Set() : e.hijasSeleccionadas } : e))
    );
  }

  function toggleEstucheHija(id: string, hijaId: number) {
    setEstuchesSeleccionados((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next = new Set(e.hijasSeleccionadas);
        next.has(hijaId) ? next.delete(hijaId) : next.add(hijaId);
        return { ...e, hijasSeleccionadas: next };
      })
    );
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

  // Query de OTs activas, para alimentar el <select> de "Orden de Trabajo".
  const { data: otsActivas = [] } = useQuery<WorkOrderActiva[]>({
    queryKey: ["ots-activas"],
    queryFn: listOrdenesTrabajoActivas,
    enabled: tipo === "salida",
  });

  const material = materiales.find((m) => m.id === materialId);

  // Unidades de medida compatibles con la unidad base del material (ej. si
  // el material es Rollo con base "cm", ofrece cm/m/etc. de la misma familia
  // "longitud"), para materiales con unidad_manejo_permite_conversion_unidad.
  const { data: unidadesMedida = [] } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: listUnidadesMedida,
    enabled: !!material?.unidad_manejo_permite_conversion_unidad,
  });
  const unidadBase = unidadesMedida.find((u) => u.id === material?.unidad_movimiento_base);
  const unidadesCompatibles = unidadesMedida.filter(
    (u) => u.activo && unidadBase && u.familia === unidadBase.familia,
  );

  // Al cambiar de material (o cargar uno con conversión de unidad), por
  // defecto se preselecciona su propia unidad base (ej. Rollo en cm).
  useEffect(() => {
    if (material?.unidad_manejo_permite_conversion_unidad && unidadBase) {
      setUnidadMovimientoId((prev) => (prev && unidadesCompatibles.some((u) => u.id === prev) ? prev : unidadBase.id));
    } else {
      setUnidadMovimientoId(null);
      setCantidadEnUnidadMovimiento("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, unidadBase?.id]);

  // Piezas seleccionables para salida/baja (combobox único)
  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", materialId, tipo],
    queryFn: () => {
      if (!materialId) return Promise.resolve<PiezaBase[]>([]);
      if (tipo === "salida") return listPiezas({ material: materialId, estado: "Disponible", sin_padre: true });
      return listPiezas({ material: materialId }); // baja
    },
    enabled: !!materialId && !!material?.control_individual && tipo !== "entrada",
  });

  const { data: prestadasMaterialRaw = [] } = useQuery({
    queryKey: ["piezas-prestadas-material", materialId],
    queryFn: () => listPiezas({ material: materialId, estado: "Prestado" }),
    enabled: !!materialId && !!material?.control_individual && tipo === "entrada",
  });
  const prestadasMaterial = prestadasMaterialRaw.filter((p) => !p.tiene_hijas);

  // `pieza` solo se usa ya para el selector único de Baja (piezaId).
  const pieza = piezas.find((p) => p.id === piezaId);

  const piezasSueltasDisponibles = piezas.filter((p) => !p.tiene_hijas);
  const estuchesDisponibles = piezas.filter((p) => p.tiene_hijas);

  // ── Carrito unificado (Tareas 1+2) ──────────────────────────────────────
  // Computa una lista plana de todos los ítems seleccionados (consumibles +
  // piezas sueltas + estuches) para mostrar el ResumenCarrito. No duplica
  // estado — deriva de los arrays existentes.
  const carritoUnificado = useMemo<ItemCarrito[]>(() => {
    if (tipo !== "salida") return [];
    const items: ItemCarrito[] = [];

    if (modoSalida === "consumibles") {
      for (const r of renglones) {
        if (r.materialId <= 0) continue;
        const mat = materiales.find((m) => m.id === r.materialId);
        items.push({
          tipo: "consumible",
          id: r.id,
          materialId: r.materialId,
          materialLabel: mat ? `${mat.codigo} \u2014 ${mat.nombre}` : `Material #${r.materialId}`,
          cantidad: r.cantidad,
          cantidadCajas: r.cantidadCajas,
          esEmpaque: !!mat?.unidad_manejo_requiere_multiplicador,
          unidadNombre: mat?.unidad_manejo_nombre ?? null,
          unidadesPorCaja: mat?.unidades_por_caja ?? null,
        });
      }
    } else {
      // Piezas sueltas seleccionadas
      for (const pid of piezasSalidaSeleccionadas) {
        const p = piezasSueltasDisponibles.find((x) => x.id === pid);
        items.push({
          tipo: "pieza_suelta",
          id: String(pid),
          piezaId: pid,
          piezaLabel: p ? p.codigo : `Pieza #${pid}`,
        });
      }
      // Estuches
      for (const e of estuchesSeleccionados) {
        items.push({
          tipo: "pieza",
          id: e.id,
          piezaId: e.piezaId,
          piezaLabel: e.piezaId > 0 ? `Estuche #${e.piezaId}` : "",
          todasHijas: e.todasHijas,
          hijasCount: e.todasHijas ? 0 : e.hijasSeleccionadas.size,
        });
      }
    }
    return items;
  }, [tipo, modoSalida, renglones, materiales, piezasSalidaSeleccionadas, piezasSueltasDisponibles, estuchesSeleccionados]);

  function togglePrestada(id: number) {
    setPrestadasSeleccionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePiezaSalida(id: number) {
    setPiezasSalidaSeleccionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setEstuchesSeleccionados([]);
  }

  const mut = useMutation({
    mutationFn: async () => {
      // ── MODO SALIDA CONSUMIBLES (Multi-material) ──────────────────────────
      if (tipo === "salida" && modoSalida === "consumibles") {
        if (!responsableId) throw new Error("Selecciona un responsable.");

        const renglonesValidos = renglones.filter((r) => r.materialId > 0);
        if (renglonesValidos.length === 0) throw new Error("Agrega al menos un material a la lista.");

        if (esAlmacenero) {
          return crearGrupoSolicitud({
            work_order: workOrderSelected || null,
            observaciones,
            items: renglonesValidos.map((r) => {
              const matObj = materiales.find((m) => m.id === r.materialId);
              const esEmp = matObj && matObj.unidad_manejo_requiere_multiplicador;
              return {
                tipo: "salida_material" as const,
                material: r.materialId,
                cantidad: esEmp ? undefined : r.cantidad,
                cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
              };
            }),
          });
        }

        // Flujo ADMIN: loop cliente-side con mismo lote_id
        const loteId = crypto.randomUUID().slice(0, 12);
        const resultados: ResultadoLoteAdmin[] = [];
        for (const r of renglonesValidos) {
          const matObj = materiales.find((m) => m.id === r.materialId);
          const nombre = matObj ? `${matObj.codigo} — ${matObj.nombre}` : `Material #${r.materialId}`;
          const esEmp = matObj && matObj.unidad_manejo_requiere_multiplicador;
          try {
            await registrarSalidaMaterial({
              material_id: r.materialId,
              cantidad: esEmp ? undefined : r.cantidad,
              cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
              responsable_id: responsableId,
              referencia_externa: workOrderSelected
                ? (otsActivas.find((o) => o.id === workOrderSelected)?.code ?? referencia)
                : referencia,
              observaciones,
              lote_id: loteId,
            });
            resultados.push({ materialNombre: nombre, ok: true });
          } catch (err: any) {
            const msg = err?.response?.data
              ? Object.values(err.response.data).flat().join(" ")
              : err?.message ?? "Error desconocido";
            resultados.push({ materialNombre: nombre, ok: false, error: msg });
          }
        }

        setResultadosAdmin(resultados);
        const idsFallidos = new Set(
          renglonesValidos
            .filter((_, idx) => !resultados[idx]?.ok)
            .map((r) => r.id)
        );
        setRenglones((prev) => {
          const restantes = prev.filter((r) => idsFallidos.has(r.id));
          return restantes.length > 0 ? restantes : [renglonVacio()];
        });

        if (resultados.every((r) => r.ok)) {
          return { batchCompleto: true };
        }
        return { batchParcial: true };
      }
      // ─────────────────────────────────────────────────────────────────────

      if (!materialId) throw new Error("Selecciona un material.");
      if (!responsableId) throw new Error("Selecciona un responsable.");

      if (material?.control_individual) {
        if (tipo === "entrada") {
          if (prestadasSeleccionadas.size === 0) {
            throw new Error("Selecciona al menos una pieza a devolver.");
          }
          const resultados = [];
          for (const id of prestadasSeleccionadas) {
            resultados.push(
              await registrarEntradaPieza({ pieza_id: id, responsable_id: responsableId, observaciones })
            );
          }
          return resultados;
        }

        if (tipo === "salida") {
          if (piezasSalidaSeleccionadas.size > 0) {
            const resultados = [];
            for (const id of piezasSalidaSeleccionadas) {
              resultados.push(
                await registrarSalidaPieza({
                  pieza_id: id,
                  responsable_id: responsableId,
                  referencia_externa: referencia,
                  observaciones,
                })
              );
            }
            return resultados;
          }
          const estuchesValidos = estuchesSeleccionados.filter((e) => e.piezaId > 0);
          if (estuchesValidos.length === 0) throw new Error("Selecciona al menos una pieza o un estuche.");
          const resultadosEstuches = [];
          for (const e of estuchesValidos) {
            const piezas_hijas_ids = e.todasHijas ? undefined : Array.from(e.hijasSeleccionadas);
            resultadosEstuches.push(
              await registrarSalidaPieza({
                pieza_id: e.piezaId,
                responsable_id: responsableId,
                referencia_externa: referencia,
                observaciones,
                piezas_hijas_ids,
              })
            );
          }
          return resultadosEstuches;
        }
        if (!piezaId) throw new Error("Selecciona una pieza.");
        return registrarBajaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
      } else {
        const esPorEmpaque = !!material?.unidad_manejo_requiere_multiplicador;
        const esPorConversion = !!material?.unidad_manejo_permite_conversion_unidad;
        const cantidadPayload = esPorEmpaque || esPorConversion ? undefined : cantidad;
        const cantidadCajasPayload = esPorEmpaque ? cantidadCajas : undefined;
        const conversionPayload = esPorConversion
          ? {
              unidad_movimiento_id: unidadMovimientoId ?? undefined,
              cantidad_en_unidad_movimiento: cantidadEnUnidadMovimiento
                ? Number(cantidadEnUnidadMovimiento)
                : undefined,
            }
          : {};
        if (esPorConversion && (!unidadMovimientoId || !cantidadEnUnidadMovimiento)) {
          throw new Error(`Indica la cantidad y la unidad (${unidadBase?.nombre ?? "unidad base"} u otra compatible).`);
        }
        if (tipo === "salida") return registrarSalidaMaterial({ material_id: materialId, cantidad: cantidadPayload, cantidad_cajas: cantidadCajasPayload, responsable_id: responsableId, referencia_externa: referencia, observaciones, ...conversionPayload });
        if (tipo === "entrada") return registrarEntradaMaterial({ material_id: materialId, cantidad: cantidadPayload, cantidad_cajas: cantidadCajasPayload, responsable_id: responsableId, observaciones, ...conversionPayload });
        return registrarBajaMaterial({ material_id: materialId, cantidad: cantidadPayload, cantidad_cajas: cantidadCajasPayload, responsable_id: responsableId, observaciones, ...conversionPayload });
      }
    },
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
      qc.invalidateQueries({ queryKey: ["grupos-solicitud"] });
      qc.invalidateQueries({ queryKey: ["materiales"] });
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      qc.invalidateQueries({ queryKey: ["piezas-prestadas-material", materialId] });

      // Resultado del batch admin: no navegar a pantalla de éxito, la tabla
      // ✓/✗ ya está visible arriba del formulario (resultadosAdmin).
      if (resp && typeof resp === "object" && ("batchCompleto" in resp || "batchParcial" in resp)) {
        if (resp.batchCompleto) {
          // Todo salió bien: limpia y muestra la tabla igual (queda como
          // confirmación visual), no hace falta pantalla aparte.
        }
        return;
      }

      if (resp && typeof resp === "object" && "solicitud_grupo_id" in resp) {
        setExitoPendiente(resp.mensaje);
        return;
      }
      if (resp && typeof resp === "object" && !Array.isArray(resp) && "solicitud_id" in resp) {
        const r = resp as unknown as { mensaje?: string };
        setExitoPendiente(r.mensaje || "Solicitud enviada para aprobación.");
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
      const data = e?.response?.data;
      if (data) {
        setError(Object.values(data).flat().join(" "));
      } else {
        setError(e.message ?? "Ocurrió un error al registrar el movimiento.");
      }
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
        <h2>Movimiento registrado</h2>
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
              setEstuchesSeleccionados([]);
              setPrestadasSeleccionadas(new Set());
              setPiezasSalidaSeleccionadas(new Set());
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
                    setEstuchesSeleccionados([]);
                    setPrestadasSeleccionadas(new Set());
                    setPiezasSalidaSeleccionadas(new Set());
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
              <h2>Materiales / Renglones</h2>
            </div>

            {/* Selector de modo para Salida: Consumibles agrupados vs Pieza individual */}
            {tipo === "salida" && (
              <div
                style={{
                  marginBottom: 16,
                  display: "flex",
                  gap: 8,
                  background: "var(--surface-subtle, #f3f4f6)",
                  padding: 4,
                  borderRadius: 8,
                  width: "fit-content",
                }}
              >
                <button
                  type="button"
                  className={modoSalida === "consumibles" ? "button button-secondary button-sm is-active" : "button button-ghost button-sm"}
                  style={{
                    fontSize: 12,
                    padding: "4px 12px",
                    background: modoSalida === "consumibles" ? "var(--surface, #fff)" : "transparent",
                    boxShadow: modoSalida === "consumibles" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  }}
                  onClick={() => {
                    setModoSalida("consumibles");
                    setMaterialId(0);
                    setPiezaId(0);
                  }}
                >
                  Materiales Consumibles (Agrupado)
                </button>
                <button
                  type="button"
                  className={modoSalida === "pieza" ? "button button-secondary button-sm is-active" : "button button-ghost button-sm"}
                  style={{
                    fontSize: 12,
                    padding: "4px 12px",
                    background: modoSalida === "pieza" ? "var(--surface, #fff)" : "transparent",
                    boxShadow: modoSalida === "pieza" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  }}
                  onClick={() => {
                    setModoSalida("pieza");
                    setMaterialId(0);
                    setPiezaId(0);
                  }}
                >
                  Pieza / Estuche (Control Individual)
                </button>
              </div>
            )}

            {/* SI ES SALIDA CONSUMIBLES MULTI-MATERIAL */}
            {tipo === "salida" && modoSalida === "consumibles" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "var(--muted, #6b7280)", margin: 0 }}>
                  Agrega los materiales consumibles que saldrán en este envío.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {renglones.map((r, index) => {
                    const matObj = materiales.find((m) => m.id === r.materialId);
                    const esEmp = matObj && matObj.unidad_manejo_requiere_multiplicador;
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          background: "var(--surface-subtle, #f9fafb)",
                          padding: 12,
                          borderRadius: 8,
                          border: "1px solid var(--border, #e5e7eb)",
                        }}
                      >
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                            Material #{index + 1}
                          </label>
                          <Combobox
                            value={r.materialId}
                            selectedLabel={matObj ? `${matObj.codigo} — ${matObj.nombre}` : ""}
                            placeholder="Buscar material consumible…"
                            onChange={(id) => {
                              actualizarRenglon(r.id, "materialId", id);
                            }}
                            fetchOptions={async (q) => {
                              const res = await listMateriales(almacenId, { q });
                              return res
                                .filter((m) => !m.control_individual)
                                .map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }));
                            }}
                          />
                        </div>

                        {esEmp ? (
                          <div style={{ width: 140 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                              {`Cant. (${matObj?.unidad_manejo_nombre ?? "empaque"})`}
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={r.cantidadCajas || 1}
                              onChange={(e) => actualizarRenglon(r.id, "cantidadCajas", Number(e.target.value))}
                              placeholder="Empaques"
                              style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                            />
                            <small style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>
                              {`× ${matObj?.unidades_por_caja ?? 1} u.`}
                            </small>
                          </div>
                        ) : (
                          <div style={{ width: 120 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                              Cantidad (u.)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={r.cantidad}
                              onChange={(e) => actualizarRenglon(r.id, "cantidad", Number(e.target.value))}
                              placeholder="Unidades"
                              style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
                            />
                          </div>
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
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={agregarRenglon}
                    style={{ fontSize: 13 }}
                  >
                    + Agregar otro material
                  </button>
                </div>

                {/* Resumen del carrito — consumibles (Tarea 1) */}
                <ResumenCarrito
                  items={carritoUnificado}
                  onQuitarConsumible={quitarRenglon}
                  onQuitarEstuche={quitarEstuche}
                  onQuitarPiezaSuelta={(pid) => {
                    setPiezasSalidaSeleccionadas((prev) => {
                      const next = new Set(prev);
                      next.delete(pid);
                      return next;
                    });
                  }}
                />
              </div>
            ) : (
              /* SI ES ENTRADA / BAJA O SALIDA DE PIEZA INDIVIDUAL */
              <div className="form-grid">
                <Field label="Material" required>
                  <Combobox
                    value={materialId}
                    selectedLabel={material ? `${material.codigo} — ${material.nombre}` : ""}
                    placeholder="Buscar por código o nombre…"
                    onChange={(id) => {
                      setMaterialId(id);
                      setPiezaId(0);
                      setEstuchesSeleccionados([]);
                      setPrestadasSeleccionadas(new Set());
                      setPiezasSalidaSeleccionadas(new Set());
                    }}
                    fetchOptions={async (q) => {
                      const res = await listMateriales(almacenId, { q });
                      // En modo "Pieza/Estuche" de salida, solo materiales con control
                      // individual; en entrada/baja se permiten ambos tipos.
                      const filtrados = (tipo === "salida" && modoSalida === "pieza")
                        ? res.filter((m) => m.control_individual)
                        : res;
                      return filtrados.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }));
                    }}
                  />
                </Field>

                {material?.control_individual ? (
                  tipo === "baja" && (
                    <Field label="Pieza" required>
                      <Combobox
                        value={piezaId}
                        selectedLabel={
                          pieza
                            ? `${pieza.codigo} — ${pieza.material_nombre}${
                                pieza.material_medida ? ` (${pieza.material_medida})` : ""
                              } · ${pieza.estado}${pieza.tiene_hijas ? " [estuche]" : ""}`
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
                  )
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
                        max={
                          tipo === "salida" || tipo === "baja"
                            ? Math.floor(material.cantidad_total / (material.unidades_por_caja || 1))
                            : undefined
                        }
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
                        max={tipo === "salida" || tipo === "baja" ? material.cantidad_total : undefined}
                        value={cantidad}
                        onChange={(e) => setCantidad(Number(e.target.value))}
                      />
                    </Field>
                  )
                ) : null}
              </div>
            )}


            {/* F4: checklist de piezas sueltas disponibles + selector de
                estuche, para salida. Reemplaza el Combobox de pieza única
                que había acá antes. Fuera del form-grid a propósito, igual
                que F2/F3. */}
            {material?.control_individual && tipo === "salida" && materialId > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                  Piezas a sacar <span style={{ color: "var(--error, #dc2626)" }}>*</span>
                </strong>

                {piezasSueltasDisponibles.length === 0 && estuchesDisponibles.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>No hay piezas disponibles de este material.</p>
                ) : (
                  <>
                    {piezasSueltasDisponibles.length > 0 && (
                      <div className="pieza-multiselect">
                        <label className="pieza-checkbox-row">
                          <input
                            type="checkbox"
                            checked={piezasSalidaSeleccionadas.size === piezasSueltasDisponibles.length}
                            onChange={(e) => {
                              setPiezasSalidaSeleccionadas(
                                e.target.checked ? new Set(piezasSueltasDisponibles.map((p) => p.id)) : new Set()
                              );
                              setEstuchesSeleccionados([]);
                            }}
                          />
                          <strong style={{ fontSize: 13 }}>
                            Todas las piezas sueltas ({piezasSueltasDisponibles.length})
                          </strong>
                        </label>
                        {piezasSueltasDisponibles.map((p) => (
                          <label key={p.id} className="pieza-checkbox-row">
                            <input
                              type="checkbox"
                              checked={piezasSalidaSeleccionadas.has(p.id)}
                              onChange={() => togglePiezaSalida(p.id)}
                            />
                            <span className="pieza-code">{p.codigo}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {estuchesDisponibles.length > 0 && piezasSalidaSeleccionadas.size === 0 && (
                      <div style={{ marginTop: piezasSueltasDisponibles.length > 0 ? 16 : 0 }}>
                        <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
                          O selecciona uno o más estuches completos
                        </strong>
                        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 0, marginBottom: 8 }}>
                          Los estuches se sacan aparte; no se pueden combinar con piezas sueltas en el mismo movimiento.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {estuchesSeleccionados.map((renglon) => (
                            <EstucheSalidaSelector
                              key={renglon.id}
                              materialId={materialId}
                              renglon={renglon}
                              excluirIds={estuchesSeleccionados.filter((e) => e.id !== renglon.id).map((e) => e.piezaId).filter((id) => id > 0)}
                              onCambiarPieza={(id) => actualizarEstuchePieza(renglon.id, id)}
                              onCambiarTodas={(checked) => actualizarEstucheTodas(renglon.id, checked)}
                              onToggleHija={(hijaId) => toggleEstucheHija(renglon.id, hijaId)}
                              onQuitar={() => quitarEstuche(renglon.id)}
                              mostrarQuitar={estuchesSeleccionados.length > 1}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          onClick={agregarEstuche}
                          style={{ fontSize: 13, marginTop: 10 }}
                        >
                          + Agregar otro estuche
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Resumen del carrito — piezas y estuches (Tarea 1+2) */}
                {(piezasSalidaSeleccionadas.size > 0 || estuchesSeleccionados.some((e) => e.piezaId > 0)) && (
                  <ResumenCarrito
                    items={carritoUnificado}
                    onQuitarConsumible={quitarRenglon}
                    onQuitarEstuche={quitarEstuche}
                    onQuitarPiezaSuelta={(pid) => {
                      setPiezasSalidaSeleccionadas((prev) => {
                        const next = new Set(prev);
                        next.delete(pid);
                        return next;
                      });
                    }}
                  />
                )}
              </div>
            )}

            {/* F3: checklist de piezas prestadas a devolver (entrada). Fuera del
                form-grid a propósito, igual que F2: evita que estas filas queden
                atrapadas en la grilla de 2 columnas del formulario. */}
            {material?.control_individual && tipo === "entrada" && materialId > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                  Piezas prestadas a devolver <span style={{ color: "var(--error, #dc2626)" }}>*</span>
                </strong>

                {prestadasMaterial.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>
                    No hay piezas prestadas de este material.
                  </p>
                ) : (
                  <div className="pieza-multiselect">
                    <label className="pieza-checkbox-row">
                      <input
                        type="checkbox"
                        checked={prestadasSeleccionadas.size === prestadasMaterial.length}
                        onChange={(e) =>
                          setPrestadasSeleccionadas(
                            e.target.checked ? new Set(prestadasMaterial.map((p) => p.id)) : new Set()
                          )
                        }
                      />
                      <strong style={{ fontSize: 13 }}>Todas las prestadas ({prestadasMaterial.length})</strong>
                    </label>
                    {prestadasMaterial.map((p) => (
                      <label key={p.id} className="pieza-checkbox-row">
                        <input
                          type="checkbox"
                          checked={prestadasSeleccionadas.has(p.id)}
                          onChange={() => togglePrestada(p.id)}
                        />
                        <span className="pieza-code">{p.codigo}</span>
                        {p.padre && (
                          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
                            pieza de estuche
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
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
                        <Field label="Referencia manual" hint="Ej. OT-2026-045 (opcional si no eliges de la lista)">
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

              <Field label="Referencia externa / Folio">
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej. Vale de almacén, Remisión..."
                />
              </Field>

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

          {/* Resultados de envío por lote (solo Admin) */}
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
                  Los materiales con ✗ se han conservado en el formulario para que puedas corregir y reintentar.
                </p>
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
          {material?.control_individual ? (
            <div className="help-note">
              {tipo === "entrada" ? (
                <>Marca todas las piezas que estás devolviendo en esta misma acción.</>
              ) : tipo === "salida" ? (
                <>
                  Marca una o más piezas sueltas para sacarlas juntas, o
                  selecciona un estuche completo (no se puede combinar
                  ambos en el mismo movimiento).
                </>
              ) : (
                <>Selecciona la pieza física específica (por código y nombre).</>
              )}
            </div>
          ) : material ? (
          <div className="help-note">
              {material.unidad_manejo_requiere_multiplicador
                ? `Este material es consumible y se maneja por ${material.unidad_manejo_nombre ?? "empaque"} (${material.unidades_por_caja ?? "?"} unidades c/u). Indica cuántos mover.`
                : material.unidad_manejo_permite_conversion_unidad
                ? `Este material se guarda en ${material.unidad_movimiento_base_nombre ?? "su unidad base"}. Elige la unidad y la cantidad a mover.`
                : "Este material es consumible. Indica la cantidad a mover."}
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}