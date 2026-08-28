import {
  ArrowLeft,
  Clock,
  Package,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { labelPieza } from "@/utils/pieza";

import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import {
  getMaterialDetalle,
  listMateriales,
  listPiezas,
} from "@/modules/almacen/catalogoRepository";
import {
  createInspeccion,
  getChecklistContexto,
  getOrdenesDisponibles,
  listPlantillasCriterios,
  listUsuarios,
} from "@/modules/almacen/inspeccionRepository";
import type {
  AccionInspeccion,
  Criterio,
  ObservacionInspeccion,
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
import { Field } from "@/modules/almacen/components/shared/Field";
import { EstucheGroup } from "@/modules/almacen/components/EstucheGroup";

const GRUPOS_HERRAMIENTAS_MANUALES = [
  "Herramientas de golpe",
  "Herramientas de corte",
  "Herramientas de cohesión",
  "Herramientas de torsión y ajuste",
  "Herramientas de medición",
  "Herramientas de sujeción",
  "Herramientas de pintura",
  "Otras herramientas",
];

export function InspeccionFormPage() {
  const qc = useQueryClient();
  const { almacenId } = useAlmacenActivo();
  const [params] = useSearchParams();

  const preselMaterial = params.get("material") ? Number(params.get("material")) : 0;
  const preselPiezasLote = params.get("piezas_lote")
    ? params.get("piezas_lote")!.split(",").map(Number).filter(Boolean)
    : [];

  const [tipo, setTipo] = useState<TipoInspeccion>(
    preselPiezasLote.length > 0 ? "grupal" : "individual",
  );
  const [modalidad, setModalidad] = useState<"planificada" | "no_planificada">("planificada");
  const [areaTrabajo, setAreaTrabajo] = useState<string>("Facility Management");
  const [referenciaOrden, setReferenciaOrden] = useState<string>("");
  const [tiposHerramientas, setTiposHerramientas] = useState<string[]>([]);
  const [materialId, setMaterialId] = useState<number>(preselMaterial);
  const [piezaId, setPiezaId] = useState<number>(0);
  const [piezasLote, setPiezasLote] = useState<Set<number>>(new Set(preselPiezasLote));
  const [inspectorId, setInspectorId] = useState<number>(0);
  const [plantillaId, setPlantillaId] = useState<number>(0);
  const [respuestas, setRespuestas] = useState<Record<number, { valor: ValorRespuesta | ""; observacion: string }>>({});
  const [resultado, setResultado] = useState<ResultadoInspeccion>("apta");
  const [accion, setAccion] = useState<AccionInspeccion>("continua_servicio");
  const [proximaInspeccion, setProximaInspeccion] = useState("");
  const [cantInspeccionada, setCantInspeccionada] = useState<number>(0);
  const [cantApta, setCantApta] = useState<number>(0);
  const [cantNoApta, setCantNoApta] = useState<number>(0);
  const [itemsObservacion, setItemsObservacion] = useState<ObservacionInspeccion[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<number | null>(null);

  // Contexto inteligente del backend (Frecuencia ABC, color 5S, detección manual)
  // Solo se activa cuando hay un material seleccionado
  const { data: contexto } = useQuery({
    queryKey: ["checklist-contexto", materialId, almacenId],
    queryFn: () => getChecklistContexto(materialId || undefined, almacenId || undefined),
    enabled: materialId > 0,
  });

  // Órdenes disponibles autorizadas — se cargan al entrar al formulario (sin depender del material)
  const { data: ordenesDisponibles = [] } = useQuery({
    queryKey: ["ordenes-disponibles-checklist"],
    queryFn: getOrdenesDisponibles,
  });

  // Queries
  const { data: materiales = [] } = useQuery({
    queryKey: ["materiales", almacenId],
    queryFn: () => listMateriales(almacenId),
    enabled: !!almacenId,
  });
  const { data: materialDetalle } = useQuery({
    queryKey: ["material-detalle", materialId],
    queryFn: () => getMaterialDetalle(materialId),
    enabled: materialId > 0,
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });
  const { data: plantillas = [] } = useQuery({
    queryKey: ["plantillas-criterios"],
    queryFn: listPlantillasCriterios,
  });

  const material = materialDetalle ?? materiales.find((m) => m.id === materialId);

  // Detectar reactivamente si el material seleccionado es herramienta manual
  const isHerramientaManual: boolean = Boolean(
    contexto?.es_herramienta_manual || tiposHerramientas.length > 0
  );

  // Derivar si la plantilla seleccionada es EPP o Manual para admitir la sección de observaciones de ítems
  const nombrePlantillaNorm = (plantillas.find((p) => p.id === plantillaId)?.nombre ?? "").toLowerCase();
  const esPlantillaEPP = nombrePlantillaNorm.includes("epp") || nombrePlantillaNorm.includes("proteccion personal");
  const esPlantillaManual = nombrePlantillaNorm.includes("manual") || isHerramientaManual;
  const admiteObservaciones = esPlantillaEPP || esPlantillaManual;

  const addItemObservacion = () => {
    setItemsObservacion((prev) => [
      ...prev,
      { codigo: "", nombre: "", observacion_encontrada: "", accion_recomendada: "", estado: "" },
    ]);
  };

  const updateItemObservacion = (
    index: number,
    field: keyof ObservacionInspeccion,
    value: string,
  ) => {
    setItemsObservacion((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const removeItemObservacion = (index: number) => {
    setItemsObservacion((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-poblar próxima inspección calculada
  useEffect(() => {
    if (contexto?.proxima_fecha_calculada) {
      setProximaInspeccion(contexto.proxima_fecha_calculada);
    }
  }, [contexto?.proxima_fecha_calculada]);

  const toggleTipoHerramienta = (item: string) => {
    setTiposHerramientas((prev) =>
      prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item],
    );
  };

  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", materialId],
    queryFn: () => listPiezas({ material: materialId }),
    enabled: !!materialId,
  });

  // Hijas activas de la pieza seleccionada (modo individual).
  const { data: hijasActivas = [] } = useQuery({
    queryKey: ["piezas-hijas", piezaId],
    queryFn: () =>
      listPiezas({ padre: piezaId }).then((res) => res.filter((p) => p.estado !== "Baja")),
    enabled: piezaId > 0,
  });
  const esEstuche = piezaId > 0 && hijasActivas.length > 0;

  // Auto-seleccionar plantilla de la subcategoría del material (automático y obligatorio)
  useEffect(() => {
    if (!material) return;
    const plantillaIdSub = material.subcategoria_plantilla_inspeccion;
    if (plantillaIdSub) {
      setPlantillaId(plantillaIdSub);
    } else if (plantillas.length > 0) {
      const fallback =
        plantillas.find((p) => p.nombre.toLowerCase().includes("manual")) ?? plantillas[0];
      if (fallback) setPlantillaId(fallback.id);
    }
  }, [material, plantillas]);

  // Auto-poblar piezas_lote cuando se detecta estuche.
  useEffect(() => {
    if (esEstuche) {
      const idsDisponibles = new Set(
        hijasActivas.filter((h) => h.estado === "Disponible").map((h) => h.id),
      );
      setPiezasLote(idsDisponibles);
    }
  }, [esEstuche, piezaId, hijasActivas]);

  // Recalcula el total inspeccionado automáticamente según el lote
  useEffect(() => {
    if (tipo === "grupal" && material?.control_individual) {
      setCantInspeccionada(piezasLote.size);
    }
  }, [tipo, material?.control_individual, piezasLote]);

  // Feedback inmediato: recalcula el error de cantidades
  useEffect(() => {
    if (tipo !== "grupal") return;
    setErrors((prev) => {
      const next = { ...prev };
      if (material?.control_individual && cantInspeccionada !== piezasLote.size) {
        next.cantidades = `Debes tener ${cantInspeccionada} pieza(s) seleccionada(s) en el lote (actualmente hay ${piezasLote.size}).`;
      } else if (cantInspeccionada > 0 && cantApta + cantNoApta !== cantInspeccionada) {
        next.cantidades = `Aptas (${cantApta}) + No aptas (${cantNoApta}) debe ser igual a inspeccionadas (${cantInspeccionada}).`;
      } else {
        delete next.cantidades;
      }
      return next;
    });
  }, [tipo, material?.control_individual, cantInspeccionada, cantApta, cantNoApta, piezasLote]);

  const plantillaSeleccionada = plantillas.find((p) => p.id === plantillaId);
  const criterios: Criterio[] = plantillaSeleccionada?.criterios ?? [];

  function setRespuesta(criterioId: number, campo: "valor" | "observacion", valor: string) {
    setRespuestas((prev) => {
      const actual = prev[criterioId] ?? { valor: "", observacion: "" };
      return {
        ...prev,
        [criterioId]: {
          ...actual,
          [campo]: valor,
        },
      };
    });
  }

  function togglePieza(id: number) {
    setPiezasLote((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodasHijas(hijas: PiezaBase[]) {
    setPiezasLote((prev) => {
      const next = new Set(prev);
      const todasMarcadas = hijas.every((h) => next.has(h.id));
      hijas.forEach((h) => (todasMarcadas ? next.delete(h.id) : next.add(h.id)));
      return next;
    });
  }

  const piezasPadre = piezas.filter((p) => !p.padre);
  const estuches = piezasPadre.filter((p) => p.tiene_hijas);
  const sueltas = piezasPadre.filter((p) => !p.tiene_hijas);
  const hijasPorPadre = new Map<number, PiezaBase[]>();
  piezas
    .filter((p) => p.padre)
    .forEach((p) => {
      if (!hijasPorPadre.has(p.padre!)) hijasPorPadre.set(p.padre!, []);
      hijasPorPadre.get(p.padre!)!.push(p);
    });

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
        modalidad,
        area_trabajo: areaTrabajo,
        referencia_orden: referenciaOrden,
        tipos_herramientas: isHerramientaManual ? tiposHerramientas : [],
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
        items_con_observacion: admiteObservaciones
          ? itemsObservacion.filter((it) => it.nombre.trim() || it.observacion_encontrada.trim())
          : [],
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
          <Link className="button button-primary" to={`/almacen/${almacenId}/inspecciones/${exito}`}>
            Ver detalle
          </Link>
          <Link className="button button-secondary" to={`/almacen/${almacenId}/inspecciones`}>
            Volver a inspecciones
          </Link>
          <button className="button button-secondary" onClick={() => { setExito(null); setPiezaId(0); setPiezasLote(new Set()); setRespuestas({}); }}>
            Nueva inspección
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="wizard-heading">
        <Link to={`/almacen/${almacenId}/inspecciones`} className="back-link">
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
          
          {/* Paso 1a: Alcance de la inspección */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Alcance de la inspección</h2>
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

          {/* Paso 1b: Modalidad de inspección */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Modalidad de inspección</h2>
            </div>
            <Field label="Modalidad" required>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as "planificada" | "no_planificada")}
              >
                <option value="planificada">Planificada</option>
                <option value="no_planificada">No planificada (Inopinada)</option>
              </select>
            </Field>
          </div>

          {/* Paso 2: Material y Pieza con Metadatos SST y Tipos de Herramientas */}
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
                  onChange={(id) => { setMaterialId(id); setPiezaId(0); setPiezasLote(new Set()); }}
                  fetchOptions={async (q) => {
                    const res = await listMateriales(almacenId, { q, inspeccionable: true });
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
                  {estuches.length > 0 && (
                    <div className="lote-subseccion">
                      <span className="lote-subseccion-titulo">Estuches ({estuches.length})</span>
                      {estuches.map((p) => (
                        <EstucheGroup
                          key={p.id}
                          padre={p}
                          hijas={hijasPorPadre.get(p.id) ?? []}
                          piezasLote={piezasLote}
                          togglePieza={togglePieza}
                          toggleTodas={toggleTodasHijas}
                        />
                      ))}
                    </div>
                  )}

                  {sueltas.length > 0 && (
                    <div className="lote-subseccion">
                      <span className="lote-subseccion-titulo">Piezas sueltas ({sueltas.length})</span>
                      {sueltas.map((p) => (
                        <label key={p.id} className="pieza-checkbox-row">
                          <input
                            type="checkbox"
                            checked={piezasLote.has(p.id)}
                            onChange={() => togglePieza(p.id)}
                          />
                          <span className="pieza-code">{labelPieza(p)}</span>
                          <span style={{ fontSize: 13 }}>
                            {p.material_nombre}
                            {p.detalle ? ` — ${p.detalle}` : ""}
                            {p.material_medida ? ` (${p.material_medida})` : ""}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>{p.estado}</span>
                        </label>
                      ))}
                    </div>
                  )}

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

            {/* Metadatos SST y Clasificación ABC */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border, #e2e8f0)", display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                <Field label="Área de trabajo / Lugar">
                  <input
                    type="text"
                    value={areaTrabajo}
                    onChange={(e) => setAreaTrabajo(e.target.value)}
                    placeholder="Ej. Taller Central, Mantenimiento FM, Hilandería..."
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Referencia (OT / OL / OP)">
                  {ordenesDisponibles.length > 0 ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <select
                        value={
                          ordenesDisponibles.some((o) => o.codigo === referenciaOrden)
                            ? referenciaOrden
                            : referenciaOrden === ""
                            ? ""
                            : "__custom__"
                        }
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setReferenciaOrden("OT-");
                          } else {
                            setReferenciaOrden(e.target.value);
                          }
                        }}
                      >
                        <option value="">— Seleccionar orden disponible —</option>
                        {ordenesDisponibles.map((ord) => (
                          <option key={ord.id} value={ord.codigo}>
                            {ord.codigo} — {ord.descripcion}
                          </option>
                        ))}
                        <option value="__custom__">Escribir referencia manual…</option>
                      </select>

                      {(!ordenesDisponibles.some((o) => o.codigo === referenciaOrden) && referenciaOrden !== "") && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="text"
                            value={referenciaOrden}
                            onChange={(e) => setReferenciaOrden(e.target.value)}
                            placeholder="Escribir código de orden (ej. OT-2026-0099)..."
                            autoFocus
                          />
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: "4px 8px", fontSize: 11 }}
                            onClick={() => setReferenciaOrden("")}
                          >
                            Limpiar
                          </button>
                        </div>
                      )}

                      <small style={{ color: "var(--muted, #64748b)", fontSize: 11 }}>
                        {ordenesDisponibles.length} orden(es) disponible(s) con acceso autorizado.
                      </small>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={referenciaOrden}
                        onChange={(e) => setReferenciaOrden(e.target.value)}
                        placeholder="Ej. OT-2026-0045, OL-012, OP-882..."
                      />
                      <small style={{ color: "var(--muted, #64748b)", fontSize: 11, display: "block", marginTop: 4 }}>
                        Sin órdenes activas disponibles. Puedes escribir una referencia manual.
                      </small>
                    </div>
                  )}
                </Field>

                {/* Banner visual del Color Bimestral/Trimestral 5S */}
                {contexto?.color_actual && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--muted, #64748b)" }}>
                      {contexto.tipo_periodo_color === "bimestral"
                        ? "Código de Color Bimestral (Sistema 5S)"
                        : "Código de Color Trimestral (Sistema 5S)"}
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        background: "var(--surface-sunken, #f8fafc)",
                        borderRadius: 6,
                        border: "1px solid var(--border, #e2e8f0)",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: contexto.color_actual.hex,
                          boxShadow: "0 0 0 2px rgba(0,0,0,0.1)",
                          border: contexto.color_actual.hex === "#FFFFFF" ? "1px solid #94a3b8" : "none",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--foreground, #0f172a)" }}>
                          {contexto.color_actual.label ?? (contexto.tipo_periodo_color === "bimestral" ? `Bimestre ${contexto.color_actual.bimestre}` : `Trimestre ${contexto.color_actual.trimestre}`)} — {contexto.color_actual.nombre} ({contexto.color_actual.meses})
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
                          Periodo vigente según el sistema 5S
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 8 Checkboxes de Tipos de Herramientas Manuales (Condicional a que sea herramienta manual) */}
              {isHerramientaManual && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "14px 16px",
                    background: "var(--surface-elevated, #ffffff)",
                    borderRadius: 8,
                    border: "1px solid var(--border, #e2e8f0)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground, #0f172a)" }}>
                      Tipo de Herramientas Manuales (Marcar las que aplican)
                    </label>
                    <span style={{ fontSize: 11.5, color: "var(--muted, #64748b)" }}>
                      {tiposHerramientas.length} seleccionada{tiposHerramientas.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "8px 16px",
                    }}
                  >
                    {GRUPOS_HERRAMIENTAS_MANUALES.map((grupo) => {
                      const checked = tiposHerramientas.includes(grupo);
                      return (
                        <label
                          key={grupo}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: checked ? "rgba(37, 99, 235, 0.08)" : "transparent",
                            border: checked ? "1px solid var(--primary, #2563eb)" : "1px solid transparent",
                            cursor: "pointer",
                            fontSize: 12.5,
                            fontWeight: checked ? 600 : 400,
                            color: checked ? "var(--primary, #2563eb)" : "var(--foreground, #334155)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTipoHerramienta(grupo)}
                            style={{ cursor: "pointer", accentColor: "var(--primary, #2563eb)" }}
                          />
                          <span>{grupo}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Paso 3: Plantilla e inspector */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 3</span>
              <h2>Plantilla e inspector</h2>
            </div>
            <div className="form-grid">
              <Field label="Plantilla de criterios" required error={errors.plantilla}>
                <select
                  value={plantillaId || ""}
                  onChange={(e) => setPlantillaId(Number(e.target.value))}
                >
                  <option value="">
                    {materialId ? "Seleccionar plantilla…" : "Selecciona un material en el Paso 2…"}
                  </option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <small style={{ display: "block", marginTop: 4, color: "var(--muted, #64748b)", fontSize: 12 }}>
                  {material?.subcategoria_plantilla_inspeccion_nombre
                    ? `✓ Plantilla recomendada: ${material.subcategoria_plantilla_inspeccion_nombre}`
                    : "Selecciona la plantilla de criterios que corresponda."}
                </small>
              </Field>
              <Field label="Inspector" required error={errors.inspector}>
                <select value={inspectorId || ""} onChange={(e) => setInspectorId(Number(e.target.value))}>
                  <option value="">Seleccionar inspector…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role_display})</option>
                  ))}
                </select>
              </Field>
              <Field label="Próxima inspección">
                <small style={{ display: "block", marginBottom: 8, color: "#666" }}>
                  Calculada automáticamente según la periodicidad sugerida: {proximaInspeccion || "—"}.
                </small>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--accent)" }}>
                    Asignar una fecha manual (opcional)
                  </summary>
                  <input
                    type="date"
                    value={proximaInspeccion}
                    onChange={(e) => setProximaInspeccion(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                </details>
              </Field>
            </div>
          </div>

          {/* Paso 4: Criterios dinámicos */}
          {criterios.length > 0 && (
            <div className="form-panel">
              <div className="form-section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span>Paso 4</span>
                  <h2>Criterios de inspección ({criterios.length})</h2>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: 12, padding: "4px 10px", height: "auto" }}
                  onClick={() => {
                    const nuevas: Record<number, { valor: ValorRespuesta; observacion: string }> = {};
                    criterios.forEach((c) => {
                      nuevas[c.id] = { valor: "cumple", observacion: respuestas[c.id]?.observacion || "" };
                    });
                    setRespuestas((prev) => ({ ...prev, ...nuevas }));
                  }}
                >
                  ✓ Marcar todos como Cumple
                </button>
              </div>
              <div>
                {criterios
                  .slice()
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

          {/* Paso 5: Cantidades (solo grupal) */}
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

          {/* Paso 5.5 (opcional): Herramientas/EPP con observaciones — solo grupal + Manual o EPP */}
          {admiteObservaciones && (
            <div className="form-panel">
              <div className="form-section-heading">
                <span>Opcional</span>
                <h2>
                  {esPlantillaEPP ? "EPP con observaciones" : "Herramientas con observaciones"}
                </h2>
              </div>
              <p style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                Registra aquí los ítems con condición insegura (opcional).
              </p>
              {itemsObservacion.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "10px 12px",
                    marginBottom: 10,
                    backgroundColor: "#f8fafc",
                    position: "relative",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => removeItemObservacion(idx)}
                    title="Eliminar"
                    style={{
                      position: "absolute", top: 8, right: 8,
                      background: "none", border: "none", cursor: "pointer", color: "#EF4444",
                    }}
                  >
                    <Trash size={15} />
                  </button>
                  <div className="form-grid" style={{ gap: 8 }}>
                    <Field label="Código">
                      <input
                        type="text"
                        placeholder="Ej. HERR-001"
                        value={item.codigo}
                        onChange={(e) => updateItemObservacion(idx, "codigo", e.target.value)}
                      />
                    </Field>
                    <Field label={esPlantillaEPP ? "Nombre del EPP" : "Nombre de la herramienta / ítem"} required>
                      <input
                        type="text"
                        placeholder={esPlantillaEPP ? "Ej. Casco de seguridad" : "Ej. Destornillador plano / Taladro"}
                        value={item.nombre}
                        onChange={(e) => updateItemObservacion(idx, "nombre", e.target.value)}
                      />
                    </Field>
                    <Field label="Observación encontrada" wide required>
                      <input
                        type="text"
                        placeholder="Describe la condición insegura"
                        value={item.observacion_encontrada}
                        onChange={(e) => updateItemObservacion(idx, "observacion_encontrada", e.target.value)}
                      />
                    </Field>
                    {!esPlantillaEPP && (
                      <>
                        <Field label="Acción recomendada">
                          <input
                            type="text"
                            placeholder="Ej. Reemplazar mango"
                            value={item.accion_recomendada ?? ""}
                            onChange={(e) => updateItemObservacion(idx, "accion_recomendada", e.target.value)}
                          />
                        </Field>
                        <Field label="Estado">
                          <input
                            type="text"
                            placeholder="Ej. Pendiente / Resuelto"
                            value={item.estado ?? ""}
                            onChange={(e) => updateItemObservacion(idx, "estado", e.target.value)}
                          />
                        </Field>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="button button-secondary"
                onClick={addItemObservacion}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}
              >
                <Plus size={14} /> Agregar ítem
              </button>
            </div>
          )}

          {/* Paso 5 o 6: Resultado y acción */}
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
            <Link to={`/almacen/${almacenId}/inspecciones`} className="button button-secondary">
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
