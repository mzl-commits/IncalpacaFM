import { ArrowLeft, Trash, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal } from "@/components/shared/Modal";
import { GestionCategoriasPanel } from "@/modules/almacen/components/GestionCategoriasPanel";
import { Field } from "@/modules/almacen/components/shared/Field";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";

import {
  createMaterial,
  getMaterialDetalle,
  listCategorias,
  listSubcategorias,
  listUnidadesMedida,
  listTiposManejoStock,
  listTiposMedida,
  updateMaterial,
} from "@/modules/almacen/catalogoRepository";

import type {
  MaterialCreatePayload,
  MaterialMedida,
  Moneda,
  TipoControl,
} from "@/modules/almacen/types";


type Fase = "form" | "exito";

export function MaterialFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fotoInputId = useId();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const materialId = Number(id);
  const { almacenId } = useAlmacenActivo();

  const [fase, setFase] = useState<Fase>("form");
  const [formInicializado, setFormInicializado] = useState(false);
  const [materialCreado, setMaterialCreado] = useState<{ id: number; codigo: string; nombre: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<MaterialCreatePayload>({
    subcategoria: 0,
    almacen: almacenId,
    nombre: "",
    codigo_quipu: "",
    marca: "",
    modelo: "",
    medida: "",
    medidas: [],
    ubicacion_fisica: "",
    precio: "",
    tipo_control: "retornable",
    control_individual: false,
    periodicidad_valor: 3,
    periodicidad_unidad: "meses",
    unidad_manejo: 0,
    unidades_por_caja: "",
    unidad_movimiento_base: null,
    moneda: "PEN",
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, almacen: almacenId }));
  }, [almacenId]);

  const [cajasIniciales, setCajasIniciales] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<number>(0);
  const [catalogoModalOpen, setCatalogoModalOpen] = useState(false);

  // Queries parametrizados por almacén activo
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", almacenId],
    queryFn: () => listCategorias(almacenId),
    enabled: !!almacenId,
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", almacenId, categoriaId],
    queryFn: () => listSubcategorias(almacenId, categoriaId),
    enabled: !!almacenId && !!categoriaId,
  });

  const { data: unidadesMedida = [] } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: listUnidadesMedida,
  });

  const { data: tiposManejoStock = [] } = useQuery({
    queryKey: ["tipos-manejo-stock"],
    queryFn: listTiposManejoStock,
  });

  const { data: tiposMedida = [] } = useQuery({
    queryKey: ["tipos-medida"],
    queryFn: listTiposMedida,
  });

  const unidadesMedidaActivas = unidadesMedida
    .filter((u) => u.activo)
    .sort((a, b) => a.orden - b.orden);

  const tiposManejoActivos = tiposManejoStock
    .filter((t) => t.activo)
    .sort((a, b) => a.orden - b.orden);

  const tiposMedidaActivos = tiposMedida
    .filter((t) => t.activo)
    .sort((a, b) => a.orden - b.orden);

  // Tipos de medida que todavía no se usaron en el formulario (no se puede
  // repetir un mismo tipo dos veces, ver unique_together en el backend).
  const tiposMedidaDisponibles = (tipoActualId?: number) =>
    tiposMedidaActivos.filter(
      (t) => t.id === tipoActualId || !form.medidas.some((m) => m.tipo === t.id),
    );

  // Al crear un material nuevo, preseleccionamos un tipo de manejo de stock
  // razonable apenas carga el catálogo (equivalente al antiguo default
  // "Unidad" hardcodeado). En edición, el valor viene del material existente.
  useEffect(() => {
    if (isEditMode) return;
    setForm((prev) => {
      if (prev.unidad_manejo || tiposManejoStock.length === 0) return prev;
      const defecto = tiposManejoStock.find((t) => t.codigo === "unidad") ?? tiposManejoStock[0];
      return { ...prev, unidad_manejo: defecto.id };
    });
  }, [isEditMode, tiposManejoStock]);

  // Flags del tipo de manejo elegido: definen qué campos de stock mostrar,
  // reemplazando la vieja comparación hardcodeada `unidad_manejo !== "Unidad"`.
  const tipoManejoSeleccionado = tiposManejoStock.find(
    (t) => t.id === Number(form.unidad_manejo),
  );
  const requiereMultiplicador = !!tipoManejoSeleccionado?.requiere_multiplicador;
  const permiteConversionUnidad = !!tipoManejoSeleccionado?.permite_conversion_unidad;

  const { data: materialExistente, isLoading: isLoadingMaterial } = useQuery({
    queryKey: ["material", almacenId, materialId],
    queryFn: () => getMaterialDetalle(materialId),
    enabled: isEditMode,
  });

  const { data: todasSubcategorias = [] } = useQuery({
    queryKey: ["subcategorias-todas", almacenId],
    queryFn: () => listSubcategorias(almacenId),
    enabled: isEditMode && !!almacenId,
  });

  useEffect(() => {
    if (isEditMode && materialExistente && todasSubcategorias.length > 0 && !formInicializado) {
      const sub = todasSubcategorias.find((s) => s.id === materialExistente.subcategoria);
      if (sub) setCategoriaId(sub.categoria);
      setForm({
        subcategoria: materialExistente.subcategoria,
        almacen: materialExistente.almacen,
        nombre: materialExistente.nombre,
        codigo_quipu: materialExistente.codigo_quipu ?? "",
        marca: materialExistente.marca,
        modelo: materialExistente.modelo,
        medida: materialExistente.medida,
        medidas: materialExistente.medidas ?? [],
        ubicacion_fisica: materialExistente.ubicacion_fisica,
        precio: materialExistente.precio ?? "",
        moneda: materialExistente.moneda ?? "PEN",
        tipo_control: materialExistente.tipo_control,
        control_individual: materialExistente.control_individual,
        periodicidad_valor: materialExistente.periodicidad_valor ?? 3,
        periodicidad_unidad: materialExistente.periodicidad_unidad ?? "meses",
        unidad_manejo: materialExistente.unidad_manejo ?? 0,
        unidades_por_caja: materialExistente.unidades_por_caja ?? "",
        unidad_movimiento_base: materialExistente.unidad_movimiento_base ?? null,
        cantidad_total: materialExistente.cantidad_total,
      });
      if (materialExistente.foto) setFotoPreview(materialExistente.foto);
      setFormInicializado(true);
    }
  }, [isEditMode, materialExistente, todasSubcategorias, formInicializado]);

  const guardarMut = useMutation({
    mutationFn: (payload: MaterialCreatePayload) =>
      isEditMode
        ? updateMaterial(materialId, payload, fotoFile)
        : createMaterial(payload, fotoFile),
    onSuccess: (mat) => {
      qc.invalidateQueries({ queryKey: ["materiales", almacenId] });
      if (isEditMode) {
        qc.invalidateQueries({ queryKey: ["material", almacenId, materialId] });
        navigate(`/almacen/${almacenId}/catalogo/${mat.id}`);
        return;
      }
      if (form.control_individual) {
        navigate(`/almacen/${almacenId}/catalogo/${mat.id}/alta-piezas`);
      } else {
        setMaterialCreado({ id: mat.id, codigo: mat.codigo, nombre: mat.nombre });
        setFase("exito");
      }
    },
    onError: (e: { response?: { data?: Record<string, string[]> } }) => {
      const data = e?.response?.data ?? {};
      const mapped: Record<string, string> = {};
      Object.entries(data).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : String(v); });
      setErrors(mapped);
    },
  });

  function set<K extends keyof MaterialCreatePayload>(key: K, value: MaterialCreatePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = "El nombre es requerido.";
    if (!form.subcategoria) errs.subcategoria = "Selecciona una subcategoría.";
    if (!form.tipo_control) errs.tipo_control = "Selecciona el tipo de control.";

    form.medidas.forEach((medida, i) => {
      if (!medida.tipo || !medida.unidad_medida || medida.valor === "" || medida.valor === null) {
        errs[`medida_${i}`] = "Completa el tipo, valor y unidad de esta medida.";
      }
    });

    const aplicaManejo = form.tipo_control === "no_retornable" && !form.control_individual;

    if (aplicaManejo && requiereMultiplicador && !(Number(form.unidades_por_caja) > 0)) {
      errs.unidades_por_caja = "Indica cuántas unidades trae cada empaque.";
    }
    if (aplicaManejo && permiteConversionUnidad && !form.unidad_movimiento_base) {
      errs.unidad_movimiento_base = "Selecciona en qué unidad se registrará el stock.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload(): MaterialCreatePayload {
    const aplicaManejo = form.tipo_control === "no_retornable" && !form.control_individual;
    return {
      ...form,
      almacen: almacenId,
      unidades_por_caja:
        aplicaManejo && requiereMultiplicador ? Number(form.unidades_por_caja) : null,
      unidad_movimiento_base:
        aplicaManejo && permiteConversionUnidad ? form.unidad_movimiento_base : null,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const payload = buildPayload();
    guardarMut.mutate(payload);
  }

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleCatalogoChange() {
    qc.invalidateQueries({ queryKey: ["categorias", almacenId] });
    qc.invalidateQueries({ queryKey: ["subcategorias", almacenId] });
    qc.invalidateQueries({ queryKey: ["subcategorias-todas", almacenId] });
  }

  if (fase === "exito") {
    return (
      <section className="success-panel">
        <h2>Material registrado</h2>
        <p>
          <code className="pieza-code">{materialCreado?.codigo}</code> — {materialCreado?.nombre}
        </p>
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/${almacenId}/catalogo/${materialCreado?.id}`}>
            Ver ficha del material
          </Link>
          <Link className="button button-secondary" to={`/almacen/${almacenId}/catalogo`}>
            Volver al catálogo
          </Link>
        </div>
      </section>
    );
  }

  if (isEditMode && (isLoadingMaterial || !formInicializado)) {
    return <div className="loading-panel">Cargando datos del material…</div>;
  }

  return (
    <section>
      <div className="wizard-heading">
        <Link to={`/almacen/${almacenId}/catalogo`} className="back-link">
          <ArrowLeft size={16} /> Catálogo
        </Link>
        <div>
          <p className="breadcrumb">
            Almacén / Catálogo / {isEditMode ? materialExistente?.codigo : "Nuevo"}
          </p>
          <h1>{isEditMode ? "Editar material" : "Nuevo material"}</h1>
          <p>
            {isEditMode
              ? "El código no cambia al editar."
              : "El código se genera automáticamente al guardar."}
          </p>
        </div>
      </div>

      <form className="wizard-layout" onSubmit={handleSubmit} noValidate>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="form-panel">
            <div className="form-section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span>Paso 1</span>
                <h2>Clasificación</h2>
              </div>
              <button
                type="button"
                className="button button-secondary"
                style={{ fontSize: 13 }}
                onClick={() => setCatalogoModalOpen(true)}
              >
                + Gestionar categorías
              </button>
            </div>
            <div className="form-grid">
              <Field label="Categoría" required error={errors.categoria}>
                <select
                  value={categoriaId || ""}
                  onChange={(e) => {
                    setCategoriaId(Number(e.target.value));
                    set("subcategoria", 0);
                  }}
                >
                  <option value="">Seleccionar categoría…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </Field>
              <Field label="Subcategoría" required error={errors.subcategoria}>
                <select
                  value={form.subcategoria || ""}
                  onChange={(e) => set("subcategoria", Number(e.target.value))}
                  disabled={!categoriaId}
                >
                  <option value="">Seleccionar subcategoría…</option>
                  {subcategorias.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </Field>
            </div>
            {categorias.length === 0 && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", borderRadius: 8, marginTop: 12,
                  background: "var(--warning-surface, #fffbeb)",
                  border: "1px solid var(--warning, #f59e0b)",
                  color: "var(--warning-text, #92400e)",
                  fontSize: 13,
                }}
              >
                <WarningCircle size={18} style={{ flexShrink: 0 }} />
                <span>
                  No hay categorías creadas. Haz clic en <strong>+ Gestionar categorías</strong> para agregar una antes de continuar.
                </span>
              </div>
            )}
          </div>

          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 2</span>
              <h2>Datos del material</h2>
            </div>
            <div className="form-grid">
              <Field label="Nombre" required wide error={errors.nombre}>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                />
              </Field>
              <Field label="Código EKIPU" hint="Código interno del equipo, si aplica" error={errors.codigo_quipu}>
                <input
                  type="text"
                  value={form.codigo_quipu ?? ""}
                  onChange={(e) => set("codigo_quipu", e.target.value)}
                />
              </Field>
              <Field label="Marca" error={errors.marca}>
                <input
                  type="text"
                  value={form.marca}
                  onChange={(e) => set("marca", e.target.value)}
                />
              </Field>
              <Field label="Modelo" error={errors.modelo}>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                />
              </Field>
              <Field label="Medida" hint='Solo si aplica (ej. 5/16" o M8)' error={errors.medida}>
                <input
                  type="text"
                  value={form.medida}
                  onChange={(e) => set("medida", e.target.value)}
                />
              </Field>

              <Field label="Dimensiones" wide hint="Agrega una fila por cada medida que aplique a este material (ej. Diámetro y Largo).">
                <div style={{ display: "grid", gap: 8 }}>
                  {form.medidas.map((medida, i) => (
                    <div
                      key={i}
                      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "start" }}
                    >
                      <select
                        value={medida.tipo || ""}
                        onChange={(e) => {
                          const tipo = Number(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            medidas: prev.medidas.map((m, idx) => (idx === i ? { ...m, tipo } : m)),
                          }));
                        }}
                      >
                        <option value="">Tipo de medida…</option>
                        {tiposMedidaDisponibles(medida.tipo).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Valor"
                        value={medida.valor}
                        onChange={(e) => {
                          const valor = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            medidas: prev.medidas.map((m, idx) => (idx === i ? { ...m, valor } : m)),
                          }));
                        }}
                      />
                      <select
                        value={medida.unidad_medida || ""}
                        onChange={(e) => {
                          const unidad_medida = Number(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            medidas: prev.medidas.map((m, idx) => (idx === i ? { ...m, unidad_medida } : m)),
                          }));
                        }}
                      >
                        <option value="">Unidad…</option>
                        {unidadesMedidaActivas.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.abreviatura})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            medidas: prev.medidas.filter((_, idx) => idx !== i),
                          }))
                        }
                        aria-label="Quitar medida"
                        style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted, #6b7280)", padding: "6px 8px" }}
                      >
                        <Trash size={16} />
                      </button>
                      {errors[`medida_${i}`] && (
                        <small className="field-error" style={{ gridColumn: "1 / -1" }}>
                          <WarningCircle size={14} /> {errors[`medida_${i}`]}
                        </small>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={tiposMedidaDisponibles().length === 0}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        medidas: [...prev.medidas, { tipo: 0, valor: "", unidad_medida: 0 }],
                      }))
                    }
                    style={{ fontSize: 13, padding: "6px 12px", justifySelf: "start" }}
                  >
                    + Agregar medida
                  </button>
                </div>
              </Field>
              <Field label="Precio" hint="Precio de referencia (opcional)" error={errors.precio}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio ?? ""}
                  onChange={(e) => set("precio", e.target.value)}
                />
              </Field>
              <Field label="Moneda" error={errors.moneda}>
                <select
                  value={form.moneda ?? "PEN"}
                  onChange={(e) => set("moneda", e.target.value as Moneda)}
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </Field>
              <Field label="Ubicación física" error={errors.ubicacion_fisica} wide>
                <input
                  type="text"
                  value={form.ubicacion_fisica}
                  onChange={(e) => set("ubicacion_fisica", e.target.value)}
                />
              </Field>

              {categorias.find((c) => c.id === categoriaId)?.requiere_inspeccion && (
                <Field label="Frecuencia de inspección" hint="Cada cuánto debe inspeccionarse este material" wide>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      value={form.periodicidad_valor}
                      onChange={(e) => set("periodicidad_valor", Number(e.target.value))}
                      style={{ maxWidth: 100 }}
                    />
                    <select
                      value={form.periodicidad_unidad}
                      onChange={(e) => set("periodicidad_unidad", e.target.value as "dias" | "meses")}
                    >
                      <option value="dias">Días</option>
                      <option value="meses">Meses</option>
                    </select>
                  </div>
                </Field>
              )}
            </div>
          </div>

          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 3</span>
              <h2>Control de stock</h2>
            </div>
            <Field label="Tipo de control" required error={errors.tipo_control}>
              <select
                value={form.tipo_control}
                onChange={(e) => set("tipo_control", e.target.value as TipoControl)}
              >
                <option value="retornable">Retornable</option>
                <option value="no_retornable">No retornable</option>
              </select>
            </Field>

            <div className="switch-row" style={{ marginTop: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                id="control_individual"
                checked={form.control_individual}
                onChange={(e) => set("control_individual", e.target.checked)}
              />
              <label htmlFor="control_individual" style={{ cursor: "pointer" }}>
                <strong>Control por pieza individual</strong>
                <small>
                  Activa si cada unidad tiene código propio (herramientas, equipos).
                  Desactiva para consumibles (tornillos, tuercas).
                </small>
              </label>
            </div>

            {form.tipo_control === "no_retornable" && !form.control_individual && (
              <div
                style={{
                  marginTop: 20,
                  padding: "16px",
                  background: "var(--surface-raised, #f9fafb)",
                  borderRadius: 8,
                  border: "1px solid var(--border, #e5e7eb)",
                }}
              >
                <strong style={{ fontSize: 14, display: "block", marginBottom: 6 }}>
                  Stock inicial
                </strong>
                <small style={{ color: "var(--muted)", display: "block", marginBottom: 12 }}>
                  Los materiales no retornables se consumen. Indica cómo se maneja
                  el stock y cuánto hay disponible actualmente.
                </small>
                <Field label="Manejo de stock" required hint="Elige cómo se cuenta este consumible en el almacén.">
                  <select
                    value={form.unidad_manejo || ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      set("unidad_manejo", id);
                      const tipo = tiposManejoStock.find((t) => t.id === id);
                      if (!tipo?.requiere_multiplicador) {
                        set("unidades_por_caja", "");
                        setCajasIniciales("");
                      }
                      if (!tipo?.permite_conversion_unidad) {
                        set("unidad_movimiento_base", null);
                      }
                    }}
                    style={{ maxWidth: 220 }}
                  >
                    <option value="">Seleccionar…</option>
                    {tiposManejoActivos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </Field>

                {requiereMultiplicador && (
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <Field
                      label={`Unidades por ${tipoManejoSeleccionado?.nombre ?? "empaque"}`}
                      required
                      error={errors.unidades_por_caja}
                      hint="¿Cuántas unidades trae cada unidad de manejo?"
                    >
                      <input
                        type="number"
                        min={1}
                        value={form.unidades_por_caja ?? ""}
                        onChange={(e) => {
                          const porCaja = e.target.value;
                          set("unidades_por_caja", porCaja);
                          const cajas = Number(cajasIniciales) || 0;
                          setForm((prev) => ({ ...prev, cantidad_total: cajas * (Number(porCaja) || 0) }));
                        }}
                        placeholder="Ej. 50"
                        style={{ maxWidth: 140 }}
                      />
                    </Field>
                    <Field
                      label={`Cantidad de ${tipoManejoSeleccionado?.nombre ?? "empaques"} iniciales`}
                      hint="Se usa solo para calcular el stock total en unidades."
                    >
                      <input
                        type="number"
                        min={0}
                        value={cajasIniciales}
                        onChange={(e) => {
                          const cajas = e.target.value;
                          setCajasIniciales(cajas);
                          const porCaja = Number(form.unidades_por_caja) || 0;
                          setForm((prev) => ({ ...prev, cantidad_total: (Number(cajas) || 0) * porCaja }));
                        }}
                        placeholder="0"
                        style={{ maxWidth: 140 }}
                      />
                    </Field>
                    <Field label="Total en stock (calculado)" wide>
                      <input
                        type="number"
                        value={form.cantidad_total ?? 0}
                        readOnly
                        style={{ maxWidth: 160, background: "var(--surface, #fff)", color: "var(--muted)" }}
                      />
                    </Field>
                  </div>
                )}

                {permiteConversionUnidad && (
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <Field
                      label="Unidad base de stock"
                      required
                      error={errors.unidad_movimiento_base}
                      hint={`En qué unidad se registrará el stock (ej. centímetros para un ${
                        tipoManejoSeleccionado?.nombre?.toLowerCase() ?? "rollo"
                      } medido en metros).`}
                    >
                      <select
                        value={form.unidad_movimiento_base ?? ""}
                        onChange={(e) => set("unidad_movimiento_base", Number(e.target.value))}
                        style={{ maxWidth: 220 }}
                      >
                        <option value="">Seleccionar…</option>
                        {unidadesMedidaActivas.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.abreviatura})
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cantidad en stock" required error={errors.cantidad_total}>
                      <input
                        type="number"
                        min={0}
                        value={form.cantidad_total ?? 0}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, cantidad_total: Number(e.target.value) }))
                        }
                        placeholder="0"
                        style={{ maxWidth: 140 }}
                      />
                    </Field>
                  </div>
                )}

                {!requiereMultiplicador && !permiteConversionUnidad && (
                  <div style={{ marginTop: 12 }}>
                    <Field label="Cantidad en stock" required error={errors.cantidad_total}>
                      <input
                        type="number"
                        min={0}
                        value={form.cantidad_total ?? 0}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, cantidad_total: Number(e.target.value) }))
                        }
                        placeholder="0"
                        style={{ maxWidth: 140 }}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 4</span>
              <h2>Foto representativa</h2>
            </div>
            <div className="upload-block">
              <div>
                <strong>Imagen del material</strong>
                <small>JPG, PNG o WEBP. Foto genérica del tipo de material.</small>
              </div>
              <label htmlFor={fotoInputId} className="button button-secondary" style={{ width: "fit-content" }}>
                Seleccionar imagen
                <input
                  id={fotoInputId}
                  ref={fotoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFoto}
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                />
              </label>
              {fotoPreview && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={fotoPreview} alt="Vista previa" className="foto-preview" />
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: 12 }}
                    onClick={() => { setFotoFile(null); setFotoPreview(null); if (fotoRef.current) fotoRef.current.value = ""; }}
                  >
                    <Trash size={14} /> Quitar foto
                  </button>
                </div>
              )}
            </div>
          </div>

          {errors.non_field_errors && (
            <div className="aviso-estuche" style={{ borderColor: "var(--error)", background: "#fff5f5", color: "var(--error)" }}>
              {errors.non_field_errors}
            </div>
          )}

          <div className="form-actions">
            <Link to={`/almacen/${almacenId}/catalogo`} className="button button-secondary">
              <ArrowLeft size={15} /> Cancelar
            </Link>
            <button
              type="submit"
              className="button button-primary"
              disabled={guardarMut.isPending}
            >
              {guardarMut.isPending
                ? "Guardando…"
                : isEditMode
                  ? "Guardar cambios"
                  : "Guardar material"}
            </button>
          </div>
        </div>

        <div className="help-panel">
          <h2>Sobre el código</h2>
          <p>
            El código se genera automáticamente según la categoría (ej. <code>H0013</code>
            para Herramientas). No es necesario ingresarlo.
          </p>
          <hr style={{ margin: "16px 0", borderColor: "#dfe6ef" }} />
          <h2>Control individual</h2>
          <p>
            Si activas el control por pieza, después de guardar podrás dar de alta las
            piezas físicas (sueltas o en estuche).
          </p>
        </div>
      </form>

      <Modal
        open={catalogoModalOpen}
        onClose={() => setCatalogoModalOpen(false)}
        title="Gestionar categorías y subcategorías"
        maxWidth={720}
      >
        <GestionCategoriasPanel
          onClose={() => setCatalogoModalOpen(false)}
          onChange={handleCatalogoChange}
        />
      </Modal>
    </section>
  );
}
