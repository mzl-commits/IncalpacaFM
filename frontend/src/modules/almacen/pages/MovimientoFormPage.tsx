import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import { listMateriales, listPiezas } from "@/modules/almacen/catalogoRepository";
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

function renglonVacio(): RenglonSalida {
  return {
    id: window.crypto.randomUUID(),
    materialId: 0,
    cantidad: 1,
    cantidadCajas: 1,
  } as RenglonSalida;
}

type ResultadoLoteAdmin = { materialNombre: string; ok: boolean; error?: string };

export function MovimientosFormPage() {
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
  const [responsableId, setResponsableId] = useState<number>(0);
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [avisoEstuche, setAvisoEstuche] = useState<{ aviso: string; excluidas: number[] } | null>(null);
  const [exito, setExito] = useState(false);
  const [exitoPendiente, setExitoPendiente] = useState<string | null>(null);

  const [modoSalida, setModoSalida] = useState<"consumibles" | "pieza">("consumibles");
  const [renglones, setRenglones] = useState<RenglonSalida[]>([renglonVacio()]);
  const [workOrderSelected, setWorkOrderSelected] = useState<string>("");
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

  const [todasHijas, setTodasHijas] = useState(true);
  const [hijasSeleccionadas, setHijasSeleccionadas] = useState<Set<number>>(new Set());
  const [piezasSalidaSeleccionadas, setPiezasSalidaSeleccionadas] = useState<Set<number>>(new Set());
  const [prestadasSeleccionadas, setPrestadasSeleccionadas] = useState<Set<number>>(new Set());

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

  const material = materiales.find((m) => m.id === materialId);

  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", materialId, tipo],
    queryFn: () => {
      if (!materialId) return Promise.resolve<PiezaBase[]>([]);
      if (tipo === "salida") return listPiezas({ material: materialId, estado: "Disponible", sin_padre: true });
      return listPiezas({ material: materialId });
    },
    enabled: !!materialId && !!material?.control_individual && tipo !== "entrada",
  });

  const { data: prestadasMaterialRaw = [] } = useQuery({
    queryKey: ["piezas-prestadas-material", materialId],
    queryFn: () => listPiezas({ material: materialId, estado: "Prestado" }),
    enabled: !!materialId && !!material?.control_individual && tipo === "entrada",
  });
  const prestadasMaterial = prestadasMaterialRaw.filter((p) => !p.tiene_hijas);

  const pieza = piezas.find((p) => p.id === piezaId);
  const esContenedor = pieza && pieza.tiene_hijas;

  const piezasSueltasDisponibles = piezas.filter((p) => !p.tiene_hijas);

  function togglePiezaSalida(id: number) {
    setPiezasSalidaSeleccionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setPiezaId(0);
    setTodasHijas(true);
    setHijasSeleccionadas(new Set());
  }

  const mut = useMutation({
    mutationFn: async () => {
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
              const esEmp = matObj && matObj.unidad_manejo !== "unidad";
              return {
                tipo: "salida_material" as const,
                material: r.materialId,
                cantidad: esEmp ? undefined : r.cantidad,
                cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
              };
            }),
          });
        }

        const loteId = window.crypto.randomUUID().slice(0, 12);
        const resultados: ResultadoLoteAdmin[] = [];
        for (const r of renglonesValidos) {
          const matObj = materiales.find((m) => m.id === r.materialId);
          const nombre = matObj ? `${matObj.codigo} — ${matObj.nombre}` : `Material #${r.materialId}`;
          const esEmp = matObj && matObj.unidad_manejo !== "unidad";
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
            } as any);
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

      const refCalculada = workOrderSelected
        ? (otsActivas.find((o) => o.id === workOrderSelected)?.code ?? referencia)
        : referencia;

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
                  referencia_externa: refCalculada,
                  observaciones,
                })
              );
            }
            return resultados;
          }
          if (!piezaId) throw new Error("Selecciona al menos una pieza o un estuche.");
          const piezas_hijas_ids = esContenedor && !todasHijas ? Array.from(hijasSeleccionadas) : undefined;
          return registrarSalidaPieza({
            pieza_id: piezaId,
            responsable_id: responsableId,
            referencia_externa: refCalculada,
            observaciones,
            piezas_hijas_ids,
          });
        }
        if (!piezaId) throw new Error("Selecciona una pieza.");
        return registrarBajaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
      } else {
        const esPorEmpaque = material?.unidad_manejo !== undefined && material.unidad_manejo !== "unidad";
        const cantidadPayload = esPorEmpaque ? undefined : cantidad;
        const cantidadCajasPayload = esPorEmpaque ? cantidadCajas : undefined;
        if (tipo === "salida") return registrarSalidaMaterial({ material_id: materialId, cantidad: cantidadPayload, cantidad_cajas: cantidadCajasPayload, responsable_id: responsableId, referencia_externa: refCalculada, observaciones });
        if (tipo === "entrada") return registrarEntradaMaterial({ material_id: materialId, cantidad: cantidadPayload, cantidad_cajas: cantidadCajasPayload, responsable_id: responsableId, observaciones });
        return registrarBajaMaterial({ material_id: materialId, cantidad: cantidadPayload, cantidad_cajas: cantidadCajasPayload, responsable_id: responsableId, observaciones });
      }
    },
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
      qc.invalidateQueries({ queryKey: ["grupos-solicitud"] });
      qc.invalidateQueries({ queryKey: ["materiales"] });
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      qc.invalidateQueries({ queryKey: ["piezas-prestadas-material", materialId] });

      if (resp && typeof resp === "object" && ("batchCompleto" in resp || "batchParcial" in resp)) {
        return;
      }

      if (resp && typeof resp === "object" && "solicitud_grupo_id" in resp) {
        setExitoPendiente(resp.mensaje);
        return;
      }
      if (resp && typeof resp === "object" && !Array.isArray(resp) && "solicitud_id" in resp) {
        const r = resp as { mensaje: string };
        setExitoPendiente(r.mensaje);
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
              setTodasHijas(true);
              setHijasSeleccionadas(new Set());
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
                    setTodasHijas(true);
                    setHijasSeleccionadas(new Set());
                    setPrestadasSeleccionadas(new Set());
                    setPiezasSalidaSeleccionadas(new Set());
                    setRenglones([renglonVacio()]);
                    setResultadosAdmin(null);
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

            {/* Selector de modo para Salida */}
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
                    const esEmp = matObj && matObj.unidad_manejo !== "unidad";
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
                              {`Cant. (${matObj?.unidad_manejo})`}
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
                      setTodasHijas(true);
                      setHijasSeleccionadas(new Set());
                      setPrestadasSeleccionadas(new Set());
                      setPiezasSalidaSeleccionadas(new Set());
                    }}
                    fetchOptions={async (q) => {
                      const res = await listMateriales(almacenId, { q });
                      return res.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }));
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
                        onChange={(id) => {
                          setPiezaId(id);
                          setTodasHijas(true);
                          setHijasSeleccionadas(new Set());
                        }}
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
                  material.unidad_manejo !== "unidad" ? (
                    <Field
                      label={`Cantidad de ${material.unidad_manejo ?? "empaque"}`}
                      required
                      hint={`Cada ${material.unidad_manejo ?? "empaque"} trae ${
                        material.unidades_por_caja ?? "?"
                      } unidades · Total: ${cantidadCajas * (material.unidades_por_caja ?? 0)} unidades`}
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

            {material?.control_individual && (tipo === "salida" || modoSalida === "pieza") && materialId > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                  Piezas a sacar <span style={{ color: "var(--error, #dc2626)" }}>*</span>
                </strong>

                {piezasSueltasDisponibles.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>No hay piezas disponibles de este material.</p>
                ) : (
                  <div className="pieza-multiselect">
                    <label className="pieza-checkbox-row">
                      <input
                        type="checkbox"
                        checked={piezasSalidaSeleccionadas.size === piezasSueltasDisponibles.length}
                        onChange={(e) =>
                          setPiezasSalidaSeleccionadas(
                            e.target.checked ? new Set(piezasSueltasDisponibles.map((p) => p.id)) : new Set()
                          )
                        }
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
                      {(u as any).nombre || (u as any).full_name || [ (u as any).first_name, (u as any).last_name ].filter(Boolean).join(" ") || u.username}
                    </option>
                  ))}
                </select>
              </Field>

              {tipo === "salida" && (
                <Field label="Orden de Trabajo (opcional)">
                  <select value={workOrderSelected} onChange={(e) => setWorkOrderSelected(e.target.value)}>
                    <option value="">Sin orden de trabajo asociada</option>
                    {otsActivas.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.code} — {(o as any).description || (o as any).descripcion || "Sin descripción"}
                      </option>
                    ))}
                  </select>
                </Field>
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
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <Link to={`/almacen/${almacenId}/movimientos`} className="button button-ghost">
              Cancelar
            </Link>
            <button type="submit" className="button button-primary" disabled={mut.isPending}>
              {mut.isPending ? "Guardando…" : "Registrar movimiento"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}