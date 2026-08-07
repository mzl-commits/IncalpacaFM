import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  listMateriales,
  listPiezas,
} from "@/modules/almacen/catalogoRepository";
import {
  registrarBajaMaterial,
  registrarBajaPieza,
  registrarEntradaMaterial,
  registrarEntradaPieza,
  registrarSalidaMaterial,
  registrarSalidaPieza,
} from "@/modules/almacen/inventarioRepository";
import { listUsuarios } from "@/modules/almacen/inspeccionRepository";
import type { PiezaBase, TipoMovimiento } from "@/modules/almacen/types";

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className={`field ${error ? "has-error" : ""}`}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {hint && !error && <small style={{ color: "var(--muted)", fontSize: 12 }}>{hint}</small>}
      {error && <small className="field-error"><WarningCircle size={14} />{error}</small>}
    </label>
  );
}

export function MovimientoFormPage() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const preselMaterial = params.get("material") ? Number(params.get("material")) : 0;

  const [tipo, setTipo] = useState<TipoMovimiento>("salida");
  const [materialId, setMaterialId] = useState<number>(preselMaterial);
  const [piezaId, setPiezaId] = useState<number>(0);
  const [cantidad, setCantidad] = useState(1);
  const [responsableId, setResponsableId] = useState<number>(0);
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [avisoEstuche, setAvisoEstuche] = useState<{ aviso: string; excluidas: number[] } | null>(null);
  const [exito, setExito] = useState(false);

  // F2: selección de hijas cuando se elige un contenedor
  const [todasHijas, setTodasHijas] = useState(true);
  const [hijasSeleccionadas, setHijasSeleccionadas] = useState<Set<number>>(new Set());

  const tipoId = useId();

  const { data: materiales = [] } = useQuery({
    queryKey: ["materiales"],
    queryFn: () => listMateriales(),
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });

  const material = materiales.find((m) => m.id === materialId);

  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", materialId, tipo],
    queryFn: () => {
      if (!materialId) return Promise.resolve<PiezaBase[]>([]);
      if (tipo === "salida") return listPiezas({ material: materialId, estado: "Disponible", sin_padre: true });
      if (tipo === "entrada") return listPiezas({ material: materialId, estado: "Prestado" });
      return listPiezas({ material: materialId });
    },
    enabled: !!materialId && !!material?.control_individual,
  });

  const pieza = piezas.find((p) => p.id === piezaId);
  const esContenedor = pieza && pieza.padre === null;

  // F2: hijas disponibles del estuche seleccionado
  const { data: hijasDisponibles = [] } = useQuery({
    queryKey: ["piezas-hijas", piezaId],
    queryFn: () => listPiezas({ padre: piezaId, estado: "Disponible" }),
    enabled: !!piezaId && !!esContenedor && tipo === "salida",
  });

  function toggleHija(id: number) {
    setHijasSeleccionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodas(checked: boolean) {
    setTodasHijas(checked);
    if (checked) setHijasSeleccionadas(new Set());
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!materialId) throw new Error("Selecciona un material.");
      if (!responsableId) throw new Error("Selecciona un responsable.");

      if (material?.control_individual) {
        if (!piezaId) throw new Error("Selecciona una pieza.");
        if (tipo === "salida") {
          // F2: pasar hijas seleccionadas si no es "todas"
          const piezas_hijas_ids = (esContenedor && !todasHijas)
            ? Array.from(hijasSeleccionadas)
            : undefined;
          return registrarSalidaPieza({
            pieza_id: piezaId,
            responsable_id: responsableId,
            referencia_externa: referencia,
            observaciones,
            piezas_hijas_ids,
          });
        }
        if (tipo === "entrada") return registrarEntradaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
        return registrarBajaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
      } else {
        if (tipo === "salida") return registrarSalidaMaterial({ material_id: materialId, cantidad, responsable_id: responsableId, referencia_externa: referencia, observaciones });
        if (tipo === "entrada") return registrarEntradaMaterial({ material_id: materialId, cantidad, responsable_id: responsableId, observaciones });
        return registrarBajaMaterial({ material_id: materialId, cantidad, responsable_id: responsableId, observaciones });
      }
    },
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      if (resp && typeof resp === "object" && "aviso" in resp) {
        const r = resp as { aviso?: string; hijas_excluidas?: number[] };
        if (r.aviso) {
          setAvisoEstuche({ aviso: r.aviso, excluidas: r.hijas_excluidas ?? [] });
          return;
        }
      }
      setExito(true);
    },
    onError: (e: { message?: string; response?: { data?: Record<string, string[]> } }) => {
      const data = e?.response?.data;
      if (data) {
        setError(Object.values(data).flat().join(" "));
      } else {
        setError(e.message ?? "Ocurrió un error al registrar el movimiento.");
      }
    },
  });

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
          <Link className="button button-primary" to="/almacen/movimientos">Ver historial</Link>
          <Link className="button button-secondary" to={`/almacen/catalogo/${materialId}`}>Ver material</Link>
          <button
            className="button button-secondary"
            onClick={() => {
              setExito(false);
              setAvisoEstuche(null);
              setPiezaId(0);
              setCantidad(1);
              setTodasHijas(true);
              setHijasSeleccionadas(new Set());
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
        <Link to="/almacen/movimientos" className="back-link">
          <ArrowLeft size={16} /> Movimientos
        </Link>
        <div>
          <p className="breadcrumb">Almacén / Movimientos / Nuevo</p>
          <h1>Registrar movimiento</h1>
        </div>
      </div>

      <form
        className="wizard-layout"
        onSubmit={(e) => { e.preventDefault(); setError(""); mut.mutate(); }}
        noValidate
      >
        <div style={{ display: "grid", gap: 20 }}>
          {/* Tipo de movimiento */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Tipo</span>
              <h2>¿Qué deseas registrar?</h2>
            </div>
            <div className={`segmented-control segmented-3`} role="group" aria-labelledby={tipoId}>
              {(["salida", "entrada", "baja"] as TipoMovimiento[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={tipo === t ? "is-active" : ""}
                  onClick={() => { setTipo(t); setPiezaId(0); setTodasHijas(true); setHijasSeleccionadas(new Set()); }}
                >
                  {t === "salida" ? "Salida" : t === "entrada" ? "Entrada / Devolución" : "Baja"}
                </button>
              ))}
            </div>
          </div>

          {/* Material */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Material</h2>
            </div>
            <div className="form-grid">
              <Field label="Material" required>
                <select
                  value={materialId || ""}
                  onChange={(e) => { setMaterialId(Number(e.target.value)); setPiezaId(0); setTodasHijas(true); setHijasSeleccionadas(new Set()); }}
                >
                  <option value="">Seleccionar material…</option>
                  {materiales.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} — {m.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Si control_individual: selector de pieza */}
              {material?.control_individual ? (
                <Field label="Pieza" required>
                  <select
                    value={piezaId || ""}
                    onChange={(e) => {
                      setPiezaId(Number(e.target.value));
                      setTodasHijas(true);
                      setHijasSeleccionadas(new Set());
                    }}
                  >
                    <option value="">Seleccionar pieza…</option>
                    {/* F4: muestra nombre del material junto al código */}
                    {piezas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} — {p.material_nombre}{p.material_medida ? ` (${p.material_medida})` : ""} · {p.estado}
                        {p.padre === null ? " [estuche]" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : material ? (
                <Field label="Cantidad" required>
                  <input
                    type="number"
                    min={1}
                    max={tipo === "salida" || tipo === "baja" ? material.cantidad_total : undefined}
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                  />
                </Field>
              ) : null}
            </div>

            {/* F2: selector de piezas hijas cuando se elige un estuche en salida */}
            {material?.control_individual && piezaId > 0 && esContenedor && tipo === "salida" && (
              <div style={{ marginTop: 16 }}>
                <div className="aviso-estuche">
                  <strong>Este es un estuche contenedor.</strong>
                  {" "}Elige qué piezas hijas incluir en la salida:
                </div>

                {hijasDisponibles.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                    No hay piezas hijas disponibles en este estuche.
                  </p>
                ) : (
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    {/* Opción "todas" */}
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={todasHijas}
                        onChange={(e) => toggleTodas(e.target.checked)}
                      />
                      <strong>Todas las disponibles ({hijasDisponibles.length})</strong>
                    </label>

                    {/* Checkboxes individuales, activos si no es "todas" */}
                    {!todasHijas && hijasDisponibles.map((h) => (
                      <label
                        key={h.id}
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingLeft: 24, cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          checked={hijasSeleccionadas.has(h.id)}
                          onChange={() => toggleHija(h.id)}
                        />
                        <span>
                          <b>{h.codigo}</b>
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

          {/* Responsable y extras */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 2</span>
              <h2>Responsable y referencia</h2>
            </div>
            <div className="form-grid">
              <Field label="Responsable" required>
                <select value={responsableId || ""} onChange={(e) => setResponsableId(Number(e.target.value))}>
                  <option value="">Seleccionar responsable…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role_display})
                    </option>
                  ))}
                </select>
              </Field>
              {(tipo === "salida") && (
                <Field label="Referencia externa" hint="Ej. OT-2026-045 (opcional)">
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Orden de trabajo u otro código"
                  />
                </Field>
              )}
              <Field label="Observaciones">
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  placeholder="Detalles adicionales (opcional)"
                  style={{width: "100%"}}
                />
              </Field>
            </div>
          </div>

          {error && (
            <div className="alert-banner alert-banner-error">
              <WarningCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-actions">
            <Link to="/almacen/movimientos" className="button button-secondary">
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
              Selecciona la pieza física específica (por código y nombre).
              {tipo === "salida" && <><br />Si es un estuche, puedes elegir cuáles piezas hijas incluir.</>}
            </div>
          ) : material ? (
            <div className="help-note">Este material es consumible. Indica la cantidad a mover.</div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
