import { ArrowLeft, Package, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  listMaterialesPendientes,
  listPlantillasCriterios,
  listUsuarios,
} from "@/modules/almacen/inspeccionRepository";
import type {
  AccionInspeccion,
  Criterio,
  Material,
  MaterialDetalle,
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

import { InspeccionCriteriosList } from '../components/InspeccionCriteriosList';

import { InspeccionObservacionesTable } from '../components/InspeccionObservacionesTable';

const GRUPOS_HERRAMIENTAS = [
  "Herramientas de golpe",
  "Herramientas de corte",
  "Herramientas de cohesiÃ³n",
  "Herramientas de torsiÃ³n y ajuste",
  "Herramientas de mediciÃ³n",
  "Herramientas de sujeciÃ³n",
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
  const [frecuencia, setFrecuencia] = useState<string>("trimestral");
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
  const [incluirInspeccionados, setIncluirInspeccionados] = useState(true);
  const [tipoInspeccion, setTipoInspeccion] = useState<"planificada" | "no_planificada">("planificada");
  const [area, setArea] = useState("");
  const [cantInspeccionada, setCantInspeccionada] = useState<number>(0);
  const [cantApta, setCantApta] = useState<number>(0);
  const [cantNoApta, setCantNoApta] = useState<number>(0);
  const [itemsObservacion, setItemsObservacion] = useState<ObservacionInspeccion[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<number | null>(null);

  const { data: contexto } = useQuery({
    queryKey: ["checklist-contexto", materialId, almacenId],
    queryFn: () => getChecklistContexto(materialId || undefined, almacenId || undefined),
  });

  const { data: ordenesDisponibles = [] } = useQuery({
    queryKey: ["ordenes-disponibles-checklist"],
    queryFn: getOrdenesDisponibles,
  });

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
  const { data: materialesPendientes = [] } = useQuery({
    queryKey: ["materiales-pendientes", almacenId, incluirInspeccionados],
    queryFn: () => listMaterialesPendientes(almacenId, incluirInspeccionados),
    enabled: !!almacenId,
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

  // Auto-poblar frecuencia sugerida cuando el backend la calcula
  useEffect(() => {
    if (contexto?.frecuencia_sugerida?.frecuencia_sugerida) {
      setFrecuencia(contexto.frecuencia_sugerida.frecuencia_sugerida.toLowerCase());
    }
  }, [contexto]);

  const toggleTipoHerramienta = (item: string) => {
    setTiposHerramientas((prev) =>
      prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item],
    );
  };

  // Detectar si el material es de subcategorÃ­a "Herramientas Manuales" (del backend o por nombre/cÃ³digo)
  const isHerramientaManual: boolean = Boolean(
    contexto?.es_herramienta_manual ||
    tiposHerramientas.length > 0 ||
    (material?.codigo?.toUpperCase().startsWith("H") &&
      !material?.subcategoria_nombre?.toLowerCase().includes("inalÃ¡mbric") &&
      !material?.subcategoria_nombre?.toLowerCase().includes("elÃ©ctric")) ||
    (material?.nombre &&
      /alicate|destornillador|llave|martillo|sierra|cincel|lima|pinza|tenaza|cizalla|cutter|flexometro|huincha|nivel|brocha|rodillo|espatula|prensa|comba|manual|cortafrÃ­o/i.test(
        material.nombre,
      ))
  );

  const frecuenciaTexto = useMemo(() => {
    if (!material) return "Trimestral";
    const dias = material.periodicidad_inspeccion_dias || 90;
    if (dias <= 30) return "Mensual";
    if (dias <= 60) return "Bimestral";
    if (dias <= 90) return "Trimestral";
    if (dias <= 180) return "Semestral";
    if (dias <= 365) return "Anual";
    return `Cada ${dias} dÃ­as`;
  }, [material]);

  const nombrePlantillaNorm = (plantillas.find((p) => p.id === plantillaId)?.nombre ?? "").toLowerCase();
  const subcatNorm = (material?.subcategoria_nombre ?? "").toLowerCase();
  const esPlantillaEPP = nombrePlantillaNorm.includes("epp") || nombrePlantillaNorm.includes("proteccion personal") || subcatNorm.includes("epp") || subcatNorm.includes("protecciÃ³n");
  const esPlantillaManual = nombrePlantillaNorm.includes("manual") || isHerramientaManual;
  const admiteObservaciones = esPlantillaEPP || esPlantillaManual;

  const addItemObservacion = () => {
    setItemsObservacion((prev) => [
      ...prev,
      {
        codigo: "",
        nombre: material ? material.nombre : "",
        observacion_encontrada: "",
        accion_recomendada: "",
        estado: "Operativa",
      },
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


  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", materialId],
    queryFn: () => listPiezas({ material: materialId }),
    enabled: !!materialId && material?.control_individual === true,
  });

  // IDs de piezas pendientes para este material
  const pendingPiezaIds = useMemo(() => {
    return new Set(
      materialesPendientes
        .filter((item) => item.material_id === materialId && item.pieza_id !== null)
        .map((item) => item.pieza_id as number),
    );
  }, [materialesPendientes, materialId]);

  // Filtrado de piezas: solo pendientes a menos que se active incluirInspeccionados
  const piezasFiltradas = useMemo(() => {
    if (incluirInspeccionados) return piezas;
    return piezas.filter((p) => pendingPiezaIds.has(p.id) || (p.tiene_hijas && !p.padre));
  }, [piezas, incluirInspeccionados, pendingPiezaIds]);

  // Hijas activas de la pieza seleccionada (modo individual).
  const { data: hijasActivas = [] } = useQuery({
    queryKey: ["piezas-hijas", piezaId],
    queryFn: () =>
      listPiezas({ padre: piezaId }).then((res) => res.filter((p) => p.estado !== "Baja")),
    enabled: piezaId > 0,
  });
  const esEstuche = piezaId > 0 && hijasActivas.length > 0;

  // Auto-seleccionar plantilla de la subcategorÃ­a del material (automÃ¡tico y obligatorio)
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

  // Auto-poblar piezas_lote cuando se detecta estuche en individual.
  useEffect(() => {
    if (esEstuche) {
      const idsDisponibles = new Set(
        hijasActivas.filter((h) => h.estado === "Disponible").map((h) => h.id),
      );
      setPiezasLote(idsDisponibles);
    }
  }, [esEstuche, piezaId, hijasActivas]);

  // En modo grupal: auto-seleccionar por defecto TODO el juego / lote de piezas disponibles
  useEffect(() => {
    if (tipo === "grupal" && piezas.length > 0) {
      const disponibles = piezas.filter((p) => p.estado === "Disponible");
      const hijasOsueltas = disponibles.filter((p) => p.padre !== null || !p.tiene_hijas);
      const target = incluirInspeccionados
        ? hijasOsueltas
        : hijasOsueltas.filter((p) => pendingPiezaIds.size === 0 || pendingPiezaIds.has(p.id));
      const sel = target.length > 0 ? target : hijasOsueltas;
      setPiezasLote(new Set(sel.map((p) => p.id)));
    }
  }, [tipo, materialId, piezas, incluirInspeccionados, pendingPiezaIds]);

  // Recalcula el total inspeccionado y piezas aptas automÃ¡ticamente segÃºn el lote seleccionado
  useEffect(() => {
    if (tipo === "grupal" && material?.control_individual) {
      const total = piezasLote.size;
      setCantInspeccionada(total);
      setCantApta(total);
      setCantNoApta(0);
    }
  }, [tipo, material?.control_individual, piezasLote]);

  // Feedback: recalcula el error de cantidades solo si la suma no coincide y se ha interactuado
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
        return Promise.reject(new Error("ValidaciÃ³n fallida"));
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
        tipo_inspeccion: tipoInspeccion,
        area: area.trim() || undefined,
        material: materialId,
        pieza: tipo === "individual" ? piezaId : null,
        piezas_lote: tipo === "grupal" ? Array.from(piezasLote) : [],
        plantilla: plantillaId,
        inspector: inspectorId,
        modalidad,
        frecuencia: modalidad === "planificada" ? frecuencia : frecuenciaTexto,
        area_trabajo: areaTrabajo,
        referencia_orden: referenciaOrden,
        tipos_herramientas: tiposHerramientas,
        proxima_inspeccion: null,
        cantidad_inspeccionada: tipo === "grupal" ? cantInspeccionada : null,
        cantidad_apta: tipo === "grupal" ? cantApta : null,
        cantidad_no_apta: tipo === "grupal" ? cantNoApta : null,
        resultado_general: resultado,
        accion_tomada: accion,
        observaciones,
        respuestas: respuestasArray,
        items_con_observacion: admiteObservaciones
          ? itemsObservacion.filter((it) => it.nombre.trim() || it.observacion_encontrada.trim() || it.codigo.trim())
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
        <h2>InspecciÃ³n registrada</h2>
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/${almacenId}/inspecciones/${exito}`}>
            Ver detalle
          </Link>
          <Link className="button button-secondary" to={`/almacen/${almacenId}/inspecciones`}>
            Volver a inspecciones
          </Link>
          <button className="button button-secondary" onClick={() => { setExito(null); setPiezaId(0); setPiezasLote(new Set()); setRespuestas({}); }}>
            Nueva inspecciÃ³n
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
          <p className="breadcrumb">AlmacÃ©n / Inspecciones / Nueva</p>
          <h1>Nueva inspecciÃ³n</h1>
        </div>
      </div>

      <form
        className="wizard-layout"
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        noValidate
      >
        <div style={{ display: "grid", gap: 20 }}>

          {/* Paso 1: Solo Alcance + Tipo de inspecciÃ³n */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Tipo de inspecciÃ³n</h2>
            </div>

            {/* Alcance */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Alcance
              </label>
              <div className="segmented-control segmented-2">
                <button
                  type="button"
                  className={tipo === "individual" ? "is-active" : ""}
                  onClick={() => setTipo("individual")}
                >
                  Individual (por pieza)
                </button>
                <button
                  type="button"
                  className={tipo === "grupal" ? "is-active" : ""}
                  onClick={() => setTipo("grupal")}
                >
                  Grupal (lote / varias piezas)
                </button>
              </div>
            </div>

            {/* Modalidad: Planificada / No planificada */}
            <div className="form-grid">
              <Field label="Modalidad">
                <select
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value as "planificada" | "no_planificada")}
                >
                  <option value="planificada">Planificada</option>
                  <option value="no_planificada">No planificada</option>
                </select>
              </Field>
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
                  key={`${almacenId}-${incluirInspeccionados}`}
                  value={materialId}
                  selectedLabel={material ? `${material.codigo} â€” ${material.nombre}` : ""}
                  placeholder="Buscar por cÃ³digo o nombreâ€¦"
                  onChange={(id) => { setMaterialId(id); setPiezaId(0); setPiezasLote(new Set()); }}
                  fetchOptions={async (q) => {
                    if (!almacenId) return [];
                    const res = await listMaterialesPendientes(almacenId, incluirInspeccionados, q || undefined);
                    const seen = new Set<number>();
                    const uniqueOptions: { id: number; label: string }[] = [];
                    for (const item of res) {
                      if (!seen.has(item.material_id)) {
                        seen.add(item.material_id);
                        uniqueOptions.push({
                          id: item.material_id,
                          label: `${item.material_codigo} â€” ${item.material_nombre}`,
                        });
                      }
                    }
                    return uniqueOptions;
                  }}
                />
                <div style={{ marginTop: 8 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "var(--text, #334155)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={incluirInspeccionados}
                      onChange={(e) => setIncluirInspeccionados(e.target.checked)}
                      style={{
                        width: 16,
                        height: 16,
                        minWidth: 16,
                        maxWidth: 16,
                        margin: 0,
                        padding: 0,
                        cursor: "pointer",
                        accentColor: "var(--accent, #6366f1)",
                      }}
                    />
                    <span>Incluir herramientas ya inspeccionadas (para re-inspecciÃ³n)</span>
                  </label>
                </div>
              </Field>

              {tipo === "individual" && material?.control_individual && (
                <Field label="Pieza" required error={errors.pieza}>
                  <Combobox
                    value={piezaId}
                    selectedLabel={
                      piezas.find((p) => p.id === piezaId)
                        ? `${labelPieza(piezas.find((p) => p.id === piezaId)!)}${piezas.find((p) => p.id === piezaId)!.estado !== "Disponible" ? ` (âš ï¸ ${piezas.find((p) => p.id === piezaId)!.estado})` : ""}`
                        : ""
                    }
                    placeholder="Buscar por cÃ³digoâ€¦"
                    onChange={(id) => { setPiezaId(id); setPiezasLote(new Set()); }}
                    fetchOptions={async (q) => {
                      const term = (q || "").trim().toLowerCase();
                      return piezasFiltradas
                        .filter((p: PiezaBase) => !p.padre)
                        .filter((p: PiezaBase) => !term || (p.codigo && p.codigo.toLowerCase().includes(term)) || (p.detalle && p.detalle.toLowerCase().includes(term)))
                        .map((p: PiezaBase) => ({
                          id: p.id,
                          label: `${labelPieza(p)}${p.estado !== "Disponible" ? ` (âš ï¸ ${p.estado})` : ""}`,
                        }));
                    }}
                  />
                  {!incluirInspeccionados && piezasFiltradas.filter((p: PiezaBase) => !p.padre).length === 0 && (
                    <small style={{ display: "block", marginTop: 4, color: "var(--muted, #64748b)", fontSize: 12 }}>
                      Todas las piezas estÃ¡n al dÃ­a con sus inspecciones. Marca "Incluir herramientas ya inspeccionadas" para re-inspeccionar.
                    </small>
                  )}
                </Field>
              )}

              {tipo === "grupal" && material?.control_individual && (
                <Field label={`Piezas del lote (${piezasLote.size} de ${piezas.filter((p) => !p.padre).length} seleccionadas)`} required error={errors.cantidades}>
                  <div
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      background: "#F8FAFC",
                      padding: "8px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: 6 }}>
                      <button
                        type="button"
                        style={{ fontSize: 11.5, color: "#2563EB", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
                        onClick={() => {
                          const allIds = new Set(piezas.filter((p) => !p.padre).map((p) => p.id));
                          setPiezasLote(allIds);
                        }}
                      >
                        âœ“ Seleccionar todas ({piezas.filter((p) => !p.padre).length})
                      </button>
                      <button
                        type="button"
                        style={{ fontSize: 11.5, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onClick={() => setPiezasLote(new Set())}
                      >
                        Deseleccionar
                      </button>
                    </div>
                    <div style={{ maxHeight: 110, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                      {piezas.filter((p) => !p.padre).map((p) => {
                        const checked = piezasLote.has(p.id);
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "4px 8px",
                              borderRadius: 4,
                              background: checked ? "#EFF6FF" : "#FFFFFF",
                              border: checked ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePieza(p.id)}
                              style={{ width: 14, height: 14, accentColor: "#2563EB" }}
                            />
                            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{labelPieza(p)}</span>
                            <span style={{ color: "#475569", fontSize: 11.5 }}>
                              {p.material_nombre} {p.detalle ? `(${p.detalle})` : ""}
                            </span>
                            <span style={{ color: "#64748B", fontSize: 11, marginLeft: "auto" }}>{p.estado}</span>
                          </label>
                        );
                      })}
                      {piezas.filter((p) => !p.padre).length === 0 && (
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>No hay piezas disponibles.</span>
                      )}
                    </div>
                  </div>
                </Field>
              )}

              {/* Aviso de estuche detectado */}
              {esEstuche && (
                <div className="aviso-estuche" style={{ marginTop: 12, gridColumn: "1 / -1" }}>
                  <Package size={15} />
                  <span>
                    Estuche detectado â€” se inspeccionan junto al estuche sus{" "}
                    <strong>{hijasActivas.length}</strong> item{hijasActivas.length !== 1 ? "s" : ""} activo{hijasActivas.length !== 1 ? "s" : ""}.
                  </span>
                </div>
              )}
            </div>

            {/* â”€â”€ Campos adicionales que dependen del material seleccionado â”€â”€ */}
            {materialId > 0 && (
              <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
                <div className="form-grid">
                  <Field label="Ãrea de trabajo / Lugar">
                    <input
                      type="text"
                      value={areaTrabajo}
                      onChange={(e) => setAreaTrabajo(e.target.value)}
                      placeholder="Facility Management"
                    />
                  </Field>
                </div>

                <div className="form-grid">
                  <Field label="Referencia (OT / OL / OP)">
                    <select
                      value={referenciaOrden}
                      onChange={(e) => setReferenciaOrden(e.target.value)}
                    >
                      <option value="">â€” Seleccionar orden disponible â€”</option>
                      {contexto?.ordenes_disponibles && contexto.ordenes_disponibles.length > 0 ? (
                        contexto.ordenes_disponibles.map((o) => (
                          <option key={o.id || o.codigo} value={o.codigo}>
                            {o.codigo}{o.descripcion ? ` â€” ${o.descripcion}` : ""}
                          </option>
                        ))
                      ) : (
                        ordenesDisponibles.map((ord) => (
                          <option key={ord.id || ord.codigo} value={ord.codigo}>
                            {ord.codigo}{ord.descripcion ? ` â€” ${ord.descripcion}` : ""}
                          </option>
                        ))
                      )}
                    </select>
                    <small style={{ display: "block", marginTop: 4, color: "var(--muted, #64748b)", fontSize: 11 }}>
                      {(contexto?.ordenes_disponibles?.length ?? ordenesDisponibles.length)} orden(es) disponible(s) con acceso autorizado.
                    </small>
                  </Field>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--muted, #64748b)" }}>
                      {contexto?.color_actual?.es_bimestral
                        ? "CÃ³digo de Color Bimestral (Sistema 5S)"
                        : "CÃ³digo de Color Trimestral (Sistema 5S)"}
                    </label>
                    <div
                      style={{
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: 8,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        minHeight: 46,
                      }}
                    >
                      {contexto?.color_actual ? (
                        <>
                          <span
                            style={{
                              display: "inline-block",
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              backgroundColor: contexto.color_actual.hex,
                              border: contexto.color_actual.hex.toLowerCase() === "#ffffff" ? "1px solid #94a3b8" : "1px solid rgba(0,0,0,0.15)",
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                              {contexto.color_actual.periodo_texto} â€” {contexto.color_actual.nombre} ({contexto.color_actual.meses_texto})
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                              Periodo vigente segÃºn el sistema 5S
                            </div>
                          </div>
                        </>
                      ) : contexto?.color_mes ? (
                        <>
                          <span
                            style={{
                              display: "inline-block",
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              backgroundColor: contexto.color_mes.hex,
                              border: "1px solid rgba(0,0,0,0.15)",
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                              Trimestre actual â€” {contexto.color_mes.nombre.toUpperCase()} ({contexto.color_mes.meses})
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                              Periodo vigente segÃºn el sistema 5S
                            </div>
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>Selecciona un material para ver el color 5S</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tipos de herramientas manuales â€” SOLO si el material es de esa subcategorÃ­a */}
                {isHerramientaManual && (
                  <div
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "14px 16px",
                      background: "#FFFFFF",
                      marginTop: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                        Tipo de Herramientas Manuales (Marcar las que aplican)
                      </span>
                      <span style={{ fontSize: 12, color: "#64748B" }}>
                        {tiposHerramientas.length} seleccionadas
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "10px 14px",
                      }}
                    >
                      {GRUPOS_HERRAMIENTAS.map((grupo) => {
                        const seleccionado = tiposHerramientas.includes(grupo);
                        return (
                          <label
                            key={grupo}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12.5,
                              color: "#334155",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              onChange={() => toggleTipoHerramienta(grupo)}
                              style={{
                                width: 15,
                                height: 15,
                                borderRadius: 4,
                                cursor: "pointer",
                                accentColor: "#2563EB",
                              }}
                            />
                            <span>{grupo}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                    {materialId ? "Seleccionar plantillaâ€¦" : "Selecciona un material en el Paso 2â€¦"}
                  </option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <small style={{ display: "block", marginTop: 4, color: "var(--muted, #64748b)", fontSize: 12 }}>
                  {material?.subcategoria_plantilla_inspeccion_nombre
                    ? `âœ“ Plantilla recomendada: ${material.subcategoria_plantilla_inspeccion_nombre}`
                    : "Selecciona la plantilla de criterios que corresponda."}
                </small>
              </Field>

              <Field label="Inspector" required error={errors.inspector}>
                <select value={inspectorId || ""} onChange={(e) => setInspectorId(Number(e.target.value))}>
                  <option value="">Seleccionar inspectorâ€¦</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role_display})</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

            <InspeccionCriteriosList
              criterios={criterios}
              respuestas={respuestas}
              setRespuesta={setRespuesta}
            />
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
                  <input
                    type="number"
                    min={0}
                    max={cantInspeccionada}
                    value={cantApta}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(cantInspeccionada, Number(e.target.value)));
                      setCantApta(val);
                      setCantNoApta(cantInspeccionada - val);
                    }}
                  />
                </Field>
                <Field label="No aptas">
                  <input
                    type="number"
                    min={0}
                    max={cantInspeccionada}
                    value={cantNoApta}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(cantInspeccionada, Number(e.target.value)));
                      setCantNoApta(val);
                      setCantApta(cantInspeccionada - val);
                    }}
                  />
                </Field>
              </div>
              {errors.cantidades && (
                <small className="field-error"><WarningCircle size={13} />{errors.cantidades}</small>
              )}
            </div>
          )}

          {/* Herramientas / EPP con observaciones â€” solo si la plantilla es Manual o EPP */}
          {admiteObservaciones && (
            <div className="form-panel">
            <InspeccionObservacionesTable
              esPlantillaEPP={esPlantillaEPP}
              tipo={tipo}
              piezasLote={piezasLote}
              piezas={piezas}
              itemsObservacion={itemsObservacion}
              addItemObservacion={addItemObservacion}
              updateItemObservacion={updateItemObservacion}
              removeItemObservacion={removeItemObservacion}
            />
          )}

          {/* Resultado y acciÃ³n */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>{tipo === "grupal" ? "Paso 6" : "Paso 5"}</span>
              <h2>Resultado y acciÃ³n</h2>
            </div>
            <div className="form-grid">
              <Field label="Resultado general" required>
                <select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoInspeccion)}>
                  {(Object.entries(resultadoInspeccionLabels) as [ResultadoInspeccion, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="AcciÃ³n tomada" required>
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
                  <strong>liberarÃ¡n</strong> y quedarÃ¡n disponibles como piezas sueltas.
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
              {mut.isPending ? "Guardandoâ€¦" : "Registrar inspecciÃ³n"}
            </button>
          </div>
        </div>

        {/* Ayuda lateral */}
        <div className="help-panel">
          <h2>Tipos de inspecciÃ³n</h2>
          <ul>
            <li><strong>Individual:</strong> inspecciÃ³n de una pieza especÃ­fica. Requerida para herramientas con control por pieza.</li>
            <li><strong>Grupal:</strong> inspecciÃ³n de un lote de piezas del mismo material (ej. un lote de cuerdas).</li>
          </ul>
          <hr style={{ margin: "14px 0", borderColor: "#dfe6ef" }} />
          <h2>AcciÃ³n tomada</h2>
          <ul>
            <li><strong>ContinÃºa en servicio:</strong> sin cambios.</li>
            <li><strong>Enviar a reparaciÃ³n / Retirar:</strong> cambia la pieza a estado Mantenimiento.</li>
            <li><strong>Dar de baja / Reemplazar:</strong> registra una baja en inventario.</li>
          </ul>
        </div>
      </form>
    </section>
  );
}
