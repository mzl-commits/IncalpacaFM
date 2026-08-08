import { ArrowLeft, Package, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { labelPieza } from "@/utils/pieza";

import {
  listMateriales,
  listPiezas,
} from "@/modules/almacen/catalogoRepository";
import {
  createInspeccion,
  listPlantillasCriterios,
  listUsuarios,
} from "@/modules/almacen/inspeccionRepository";
import type {
  AccionInspeccion,
  Criterio,
  Material,
  PiezaBase,
  ResultadoInspeccion,
  TipoInspeccion,
  ValorRespuesta,
} from "@/modules/almacen/types";
import {
  accionInspeccionLabels,
  resultadoInspeccionLabels,
  valorRespuestaLabels,
} from "@/modules/almacen/types";
import type { RespuestaInput } from "@/modules/almacen/inspeccionRepository";
import { Combobox } from "../components/shared/Combobox";

function Field({ label, required, error, children, wide }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""} ${error ? "has-error" : ""}`}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {error && <small className="field-error"><WarningCircle size={14} />{error}</small>}
    </label>
  );
}

export function InspeccionFormPage() {
  const qc = useQueryClient();
  const [params] = useSearchParams();

  const preselMaterial = params.get("material") ? Number(params.get("material")) : 0;
  const preselPiezasLote = params.get("piezas_lote")
    ? params.get("piezas_lote")!.split(",").map(Number).filter(Boolean)
    : [];

  const [tipo, setTipo] = useState<TipoInspeccion>(
    preselPiezasLote.length > 0 ? "grupal" : "individual",
  );
  const [materialId, setMaterialId] = useState<number>(preselMaterial);
  const [piezaId, setPiezaId] = useState<number>(0);
  const [piezasLote, setPiezasLote] = useState<Set<number>>(new Set(preselPiezasLote));
  const [inspectorId, setInspectorId] = useState<number>(0);
  const [plantillaId, setPlantillaId] = useState<number>(0);
  const [respuestas, setRespuestas] = useState<Record<number, { valor: ValorRespuesta | ""; observacion: string }>>({});
  const [resultado, setResultado] = useState<ResultadoInspeccion>("apta");
  const [accion, setAccion] = useState<AccionInspeccion>("continua_servicio");
  const [proximaInspeccion, setProximaInspeccion] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  });
  const [cantInspeccionada, setCantInspeccionada] = useState<number>(0);
  const [cantApta, setCantApta] = useState<number>(0);
  const [cantNoApta, setCantNoApta] = useState<number>(0);
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<number | null>(null);

  // Queries
  const { data: materiales = [] } = useQuery({
    queryKey: ["materiales"],
    queryFn: () => listMateriales(),
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });
  const { data: plantillas = [] } = useQuery({
    queryKey: ["plantillas-criterios"],
    queryFn: listPlantillasCriterios,
  });

  const material: Material | undefined = materiales.find((m) => m.id === materialId);

  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", materialId],
    queryFn: () => listPiezas({ material: materialId }),
    enabled: !!materialId && material?.control_individual === true,
  });

  // Hijas activas de la pieza seleccionada (modo individual). Consulta
  // independiente: las hijas pueden pertenecer a un material distinto
  // al del contenedor, así que no dependemos de `piezas` (filtrado por materialId).
  const { data: hijasActivas = [] } = useQuery({
    queryKey: ["piezas-hijas", piezaId],
    queryFn: () =>
      listPiezas({ padre: piezaId }).then((res) => res.filter((p) => p.estado !== "Baja")),
    enabled: piezaId > 0,
  });
  const esEstuche = piezaId > 0 && hijasActivas.length > 0;

  // Auto-seleccionar plantilla de la subcategoría del material
  useEffect(() => {
    if (!material) return;
    const plantillaId = material.subcategoria_plantilla_inspeccion;
    if (plantillaId) setPlantillaId(plantillaId);
  }, [material]);

  // Auto-poblar piezas_lote cuando se detecta estuche
  useEffect(() => {
  if (esEstuche) {
    const idsHijas = new Set(hijasActivas.map((h) => h.id));
    setPiezasLote(idsHijas);
  }
}, [esEstuche, piezaId]);

  // Recalcula el total inspeccionado automáticamente según el lote,
  // solo para materiales con control individual (donde sí hay piezas que contar).
  useEffect(() => {
    if (tipo === "grupal" && material?.control_individual) {
      setCantInspeccionada(piezasLote.size);
    }
  }, [tipo, material?.control_individual, piezasLote]);

  const plantillaSeleccionada = plantillas.find((p) => p.id === plantillaId);
  const criterios: Criterio[] = plantillaSeleccionada?.criterios ?? [];

  function setRespuesta(criterioId: number, campo: "valor" | "observacion", valor: string) {
    setRespuestas((prev) => ({
      ...prev,
      [criterioId]: { ...{ valor: "", observacion: "" }, ...(prev[criterioId] ?? {}), [campo]: valor },
    }));
  }

  function togglePieza(id: number) {
    setPiezasLote((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [contenedoresMarcados, setContenedoresMarcados] = useState<Set<number>>(new Set());

  async function togglePiezaLote(pieza: PiezaBase) {
    if (!pieza.tiene_hijas) {
      togglePieza(pieza.id);
      return;
    }
    const marcando = !contenedoresMarcados.has(pieza.id);
    setContenedoresMarcados((prev) => {
      const next = new Set(prev);
      marcando ? next.add(pieza.id) : next.delete(pieza.id);
      return next;
    });
    const hijas = await listPiezas({ padre: pieza.id });
    setPiezasLote((prev) => {
      const next = new Set(prev);
      if (marcando) {
        hijas.filter((h) => h.estado !== "Baja").forEach((h) => next.add(h.id));
      } else {
        hijas.forEach((h) => next.delete(h.id));
      }
      return next;
    });
  }

  const mut = useMutation({
    mutationFn: () => {
      const errs: Record<string, string> = {};
      if (!materialId) errs.material = "Selecciona un material.";
      if (!inspectorId) errs.inspector = "Selecciona un inspector.";
      if (!plantillaId) errs.plantilla = "Selecciona una plantilla.";
      if (tipo === "individual" && !piezaId) errs.pieza = "Selecciona una pieza.";
      if (tipo === "grupal") {
        if (material?.control_individual && cantInspeccionada !== piezasLote.size) {
          errs.cantidades = `Debes tener ${cantInspeccionada} pieza(s) seleccionada(s) en el lote (actualmente hay ${piezasLote.size}).`;
        } else if (cantApta + cantNoApta !== cantInspeccionada && cantInspeccionada > 0) {
          errs.cantidades = `Aptas (${cantApta}) + No aptas (${cantNoApta}) debe ser igual a inspeccionadas (${cantInspeccionada}).`;
        }
      }
      if (Object.keys(errs).length) {
        setErrors(errs);
        return Promise.reject(new Error("Validación fallida"));
      }
      setErrors({});

      const respuestasArray: RespuestaInput[] = criterios
        .filter((c) => respuestas[c.id]?.valor)
        .map((c) => ({
          criterio_id: c.id,
          valor: respuestas[c.id].valor as ValorRespuesta,
          observacion: respuestas[c.id].observacion || undefined,
        }));

      return createInspeccion({
        tipo,
        material: materialId,
        pieza: tipo === "individual" ? piezaId : null,
        piezas_lote: tipo === "grupal" ? Array.from(piezasLote) : [],
        plantilla: plantillaId,
        inspector: inspectorId,
        proxima_inspeccion: proximaInspeccion || null,
        cantidad_inspeccionada: tipo === "grupal" ? cantInspeccionada : null,
        cantidad_apta: tipo === "grupal" ? cantApta : null,
        cantidad_no_apta: tipo === "grupal" ? cantNoApta : null,
        resultado_general: resultado,
        accion_tomada: accion,
        observaciones,
        respuestas: respuestasArray,
      });
    },
    onSuccess: (insp) => {
      qc.invalidateQueries({ queryKey: ["inspecciones"] });
      setExito(insp.id);
    },
    onError: (e: { response?: { data?: Record<string, string[]> } }) => {
      const data = e?.response?.data ?? {};
      const mapped: Record<string, string> = {};
      Object.entries(data).forEach(([k, v]) => {
        mapped[k] = Array.isArray(v) ? v[0] : String(v);
      });
      setErrors(mapped);
    },
  });

  if (exito) {
    return (
      <section className="success-panel">
        <h2>Inspección registrada</h2>
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/inspecciones/${exito}`}>
            Ver detalle
          </Link>
          <Link className="button button-secondary" to="/almacen/inspecciones">
            Volver a inspecciones
          </Link>
          <button className="button button-secondary" onClick={() => { setExito(null); setPiezaId(0); setPiezasLote(new Set()); setContenedoresMarcados(new Set()); setRespuestas({}); }}>
            Nueva inspección
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="wizard-heading">
        <Link to="/almacen/inspecciones" className="back-link">
          <ArrowLeft size={16} /> Inspecciones
        </Link>
        <div>
          <p className="breadcrumb">Almacén / Inspecciones / Nueva</p>
          <h1>Nueva inspección</h1>
        </div>
      </div>

      <form
        className="wizard-layout"
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        noValidate
      >
        <div style={{ display: "grid", gap: 20 }}>

          {/* Tipo */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Tipo de inspección</h2>
            </div>
            <div className="segmented-control segmented-2">
              <button type="button" className={tipo === "individual" ? "is-active" : ""} onClick={() => setTipo("individual")}>
                Individual (por pieza)
              </button>
              <button type="button" className={tipo === "grupal" ? "is-active" : ""} onClick={() => setTipo("grupal")}>
                Grupal (lote)
              </button>
            </div>
          </div>

          {/* Material y pieza */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 2</span>
              <h2>Material {tipo === "individual" ? "y pieza" : "y lote"}</h2>
            </div>
            <div className="form-grid">
              <Field label="Material" required error={errors.material}>
                <Combobox
                  value={materialId}
                  selectedLabel={material ? `${material.codigo} — ${material.nombre}` : ""}
                  placeholder="Buscar por código o nombre…"
                  onChange={(id) => { setMaterialId(id); setPiezaId(0); setPiezasLote(new Set()); setContenedoresMarcados(new Set()); }}
                  fetchOptions={async (q) => {
                    const res = await listMateriales({ q, inspeccionable: true });
                    return res.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }));
                  }}
                />
              </Field>

              {tipo === "individual" && material?.control_individual && (
              <Field label="Pieza" required error={errors.pieza}>
                <Combobox
                  value={piezaId}
                  selectedLabel={
                    piezas.find((p) => p.id === piezaId)
                      ? `${labelPieza(piezas.find((p) => p.id === piezaId)!)}${piezas.find((p) => p.id === piezaId)!.estado !== "Disponible" ? ` (⚠️ ${piezas.find((p) => p.id === piezaId)!.estado})` : ""}`
                      : ""
                  }
                  placeholder="Buscar por código…"
                  onChange={(id) => { setPiezaId(id); setPiezasLote(new Set()); }}
                  fetchOptions={async (q) => {
                    const res = await listPiezas({ material: materialId, sin_padre: true, q });
                    return res.map((p) => ({
                      id: p.id,
                      label: `${labelPieza(p)}${p.estado !== "Disponible" ? ` (⚠️ ${p.estado})` : ""}`,
                    }));
                  }}
                />
              </Field>
              )}

            {/* Aviso de estuche detectado */}
            {esEstuche && (
              <div className="aviso-estuche" style={{ marginTop: 12, gridColumn: "1 / -1" }}>
                <Package size={15} />
                <span>
                  Estuche detectado — se inspeccionan junto al estuche sus{" "}
                  <strong>{hijasActivas.length}</strong> item{hijasActivas.length !== 1 ? "s" : ""} activo{hijasActivas.length !== 1 ? "s" : ""}.
                </span>
              </div>
            )}
            </div>

            {/* Lote de piezas (grupal) */}
            {tipo === "grupal" && material?.control_individual && (
              <div style={{ marginTop: 16 }}>
                <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                  Seleccionar piezas del lote
                </strong>
                <div className="pieza-multiselect">
                  {piezas.map((p) => (
                    <label key={p.id} className="pieza-checkbox-row">
                      <input
                        type="checkbox"
                        checked={p.tiene_hijas ? contenedoresMarcados.has(p.id) : piezasLote.has(p.id)}
                        onChange={() => togglePiezaLote(p)}
                      />
                      <span className="pieza-code">{labelPieza(p)}{p.tiene_hijas ? " [estuche]" : ""}</span>
                      <span style={{ fontSize: 13 }}>
                        {p.material_nombre}{p.material_medida ? ` (${p.material_medida})` : ""}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>{p.estado}</span>
                    </label>
                  ))}
                  {piezas.length === 0 && materialId > 0 && (
                    <p className="empty-row" style={{ fontSize: 12 }}>Sin piezas disponibles.</p>
                  )}
                </div>
                {piezasLote.size > 0 && (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                    {piezasLote.size} piezas seleccionadas
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Plantilla e inspector */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 3</span>
              <h2>Plantilla e inspector</h2>
            </div>
            <div className="form-grid">
              <Field label="Plantilla de criterios" required error={errors.plantilla}>
                <select value={plantillaId || ""} onChange={(e) => setPlantillaId(Number(e.target.value))}>
                  <option value="">Seleccionar plantilla…</option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </Field>
              <Field label="Inspector" required error={errors.inspector}>
                <select value={inspectorId || ""} onChange={(e) => setInspectorId(Number(e.target.value))}>
                  <option value="">Seleccionar inspector…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role_display})</option>
                  ))}
                </select>
              </Field>
              <Field label="Próxima inspección" hint="Opcional — si no se asigna, se calculará automáticamente como fecha actual + 90 días">
                <input type="date" value={proximaInspeccion} onChange={(e) => setProximaInspeccion(e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Criterios dinámicos */}
          {criterios.length > 0 && (
            <div className="form-panel">
              <div className="form-section-heading">
                <span>Paso 4</span>
                <h2>Criterios de inspección ({criterios.length})</h2>
              </div>
              <div>
                {criterios
                  .sort((a, b) => a.orden - b.orden)
                  .map((criterio) => {
                    const resp = respuestas[criterio.id] ?? { valor: "", observacion: "" };
                    return (
                      <div key={criterio.id} className="criterio-row">
                        <span className="criterio-texto">
                          <strong>{criterio.orden}.</strong> {criterio.texto}
                        </span>
                        <div className="criterio-controls">
                          <select
                            value={resp.valor}
                            onChange={(e) => setRespuesta(criterio.id, "valor", e.target.value)}
                          >
                            <option value="">— evaluar —</option>
                            {(Object.entries(valorRespuestaLabels) as [ValorRespuesta, string][]).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                          {resp.valor === "no_cumple" && (
                            <input
                              type="text"
                              placeholder="Observación (opcional)"
                              value={resp.observacion}
                              onChange={(e) => setRespuesta(criterio.id, "observacion", e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Cantidades (solo grupal) */}
          {tipo === "grupal" && (
            <div className="form-panel">
              <div className="form-section-heading">
                <span>Paso 5</span>
                <h2>Cantidades inspeccionadas</h2>
              </div>
              <div className="form-grid">
                <Field label="Total inspeccionadas" required error={errors.cantidades}>
                  <input
                    type="number"
                    min={0}
                    value={cantInspeccionada}
                    disabled={!!material?.control_individual}
                    onChange={(e) => setCantInspeccionada(Number(e.target.value))}
                  />
                </Field>
                <Field label="Aptas">
                  <input type="number" min={0} value={cantApta} onChange={(e) => setCantApta(Number(e.target.value))} />
                </Field>
                <Field label="No aptas">
                  <input type="number" min={0} value={cantNoApta} onChange={(e) => setCantNoApta(Number(e.target.value))} />
                </Field>
              </div>
              {errors.cantidades && (
                <small className="field-error"><WarningCircle size={13} />{errors.cantidades}</small>
              )}
            </div>
          )}

          {/* Resultado y acción */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>{tipo === "grupal" ? "Paso 6" : "Paso 5"}</span>
              <h2>Resultado y acción</h2>
            </div>
            <div className="form-grid">
              <Field label="Resultado general" required>
                <select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoInspeccion)}>
                  {(Object.entries(resultadoInspeccionLabels) as [ResultadoInspeccion, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Acción tomada" required>
                <select value={accion} onChange={(e) => setAccion(e.target.value as AccionInspeccion)}>
                  {(Object.entries(accionInspeccionLabels) as [AccionInspeccion, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Observaciones" wide>
                <textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones adicionales (opcional)" />
              </Field>
            </div>
            {/* Aviso baja de estuche con hijas activas */}
            {esEstuche && (accion === "dar_baja" || accion === "reemplazar") && (
              <div className="alert-banner alert-banner-warning" style={{ marginTop: 12 }}>
                <WarningCircle size={16} />
                <span>
                  Al dar de baja este estuche, sus{" "}
                  <strong>{hijasActivas.length}</strong> item{hijasActivas.length !== 1 ? "s" : ""} activo{hijasActivas.length !== 1 ? "s" : ""} se{" "}
                  <strong>liberarán</strong> y quedarán disponibles como piezas sueltas.
                </span>
              </div>
            )}
          </div>

          {errors.non_field_errors && (
            <div className="alert-banner alert-banner-error">
              <WarningCircle size={18} />
              <span>{errors.non_field_errors}</span>
            </div>
          )}

          <div className="form-actions">
            <Link to="/almacen/inspecciones" className="button button-secondary">
              <ArrowLeft size={15} /> Cancelar
            </Link>
            <button type="submit" className="button button-primary" disabled={mut.isPending}>
              {mut.isPending ? "Guardando…" : "Registrar inspección"}
            </button>
          </div>
        </div>

        {/* Ayuda lateral */}
        <div className="help-panel">
          <h2>Tipos de inspección</h2>
          <ul>
            <li><strong>Individual:</strong> inspección de una pieza específica. Requerida para herramientas con control por pieza.</li>
            <li><strong>Grupal:</strong> inspección de un lote de piezas del mismo material (ej. un lote de cuerdas).</li>
          </ul>
          <hr style={{ margin: "14px 0", borderColor: "#dfe6ef" }} />
          <h2>Acción tomada</h2>
          <ul>
            <li><strong>Continúa en servicio:</strong> sin cambios.</li>
            <li><strong>Enviar a reparación / Retirar:</strong> cambia la pieza a estado Mantenimiento.</li>
            <li><strong>Dar de baja / Reemplazar:</strong> registra una baja en inventario.</li>
          </ul>
        </div>
      </form>
    </section>
  );
}