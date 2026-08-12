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
  updateMaterial,
} from "@/modules/almacen/catalogoRepository";

import type {
  MaterialCreatePayload,
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
    marca: "",
    modelo: "",
    medida: "",
    unidad_medida: 0,
    grosor: "",
    largo: "",
    ubicacion_fisica: "",
    precio: "",
    tipo_control: "retornable",
    control_individual: false,
    periodicidad_valor: 3,
    periodicidad_unidad: "meses",
    unidad_manejo: 0,
    unidades_por_caja: "",
    moneda: "PEN",
    unidad_movimiento_base: null,
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

  const { data: unidadesMedida = [] } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: listUnidadesMedida,
  });

  const { data: tiposManejo = [] } = useQuery({
    queryKey: ["tipos-manejo-stock"],
    queryFn: listTiposManejoStock,
  });

  const unidadesLongitud = unidadesMedida.filter(
    (u) => u.familia === "longitud" && u.activo,
  );
  const tipoManejoSeleccionado = tiposManejo.find(
    (t) => t.id === form.unidad_manejo,
  );

  useEffect(() => {
    if (isEditMode) return;

    if (!form.unidad_medida && unidadesMedida.length > 0) {
      const mm = unidadesMedida.find((u) => u.codigo === "mm") ?? unidadesMedida[0];
      if (mm) set("unidad_medida", mm.id);
    }

    if (!form.unidad_manejo && tiposManejo.length > 0) {
      const unidad = tiposManejo.find((t) => t.codigo === "unidad") ?? tiposManejo[0];
      if (unidad) set("unidad_manejo", unidad.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, unidadesMedida, tiposManejo, form.unidad_medida, form.unidad_manejo]);

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", almacenId, categoriaId],
    queryFn: () => listSubcategorias(almacenId, categoriaId),
    enabled: !!almacenId && !!categoriaId,
  });

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
        marca: materialExistente.marca,
        modelo: materialExistente.modelo,
        medida: materialExistente.medida,
        unidad_medida: materialExistente.unidad_medida ?? 0,
        grosor: materialExistente.grosor ?? "",
        largo: materialExistente.largo ?? "",
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
    const usaEmpaque =
      form.tipo_control === "no_retornable" &&
      !form.control_individual &&
      !!tipoManejoSeleccionado?.requiere_multiplicador;
    if (usaEmpaque && !(Number(form.unidades_por_caja) > 0)) {
      errs.unidades_por_caja = "Indica cuántas unidades trae cada empaque.";
    }
    const usaConversion =
      form.tipo_control === "no_retornable" &&
      !form.control_individual &&
      !!tipoManejoSeleccionado?.permite_conversion_unidad;
    if (usaConversion && !form.unidad_movimiento_base) {
      errs.unidad_movimiento_base = "Indica en qué unidad se guarda el stock (ej. centímetros).";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload(): MaterialCreatePayload {
    const usaEmpaque =
      form.tipo_control === "no_retornable" &&
      !form.control_individual &&
      !!tipoManejoSeleccionado?.requiere_multiplicador;
    const usaConversion =
      form.tipo_control === "no_retornable" &&
      !form.control_individual &&
      !!tipoManejoSeleccionado?.permite_conversion_unidad;
    return {
      ...form,
      almacen: almacenId,
      unidades_por_caja: usaEmpaque ? Number(form.unidades_por_caja) : null,
      unidad_movimiento_base: usaConversion ? form.unidad_movimiento_base : null,
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
                  placeholder="Ej. Taladro percutor eléctrico"
                />
              </Field>
              <Field label="Marca" error={errors.marca}>
                <input
                  type="text"
                  value={form.marca}
                  onChange={(e) => set("marca", e.target.value)}
                  placeholder="Ej. Bosch"
                />
              </Field>
              <Field label="Modelo" error={errors.modelo}>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                  placeholder="Ej. GSB 550"
                />
              </Field>
              <Field label="Medida" hint='Solo si aplica (ej. 5/16" o M8)' error={errors.medida}>
                <input
                  type="text"
                  value={form.medida}
                  onChange={(e) => set("medida", e.target.value)}
                />
              </Field>
              <Field label="Unidad de medida" error={errors.unidad_medida}>
                <select
                  value={form.unidad_medida || ""}
                  onChange={(e) => set("unidad_medida", Number(e.target.value))}
                >
                  {unidadesLongitud.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>
                  ))}
                </select>
              </Field>
              <Field label="Grosor / Diámetro" error={errors.grosor}>
                <input
                  type="number"
                  step="0.01"
                  value={form.grosor}
                  onChange={(e) => set("grosor", e.target.value)}
                />
              </Field>
              <Field label="Largo" error={errors.largo}>
                <input
                  type="number"
                  step="0.01"
                  value={form.largo}
                  onChange={(e) => set("largo", e.target.value)}
                />
              </Field>
              <Field label="Precio" hint="Precio de referencia (opcional)" error={errors.precio}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio ?? ""}
                  onChange={(e) => set("precio", e.target.value)}
                  placeholder="Ej. 150.00"
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
              <Field label="Ubicación física" hint="Ej. A1, Estante 3, Caja de brocas" error={errors.ubicacion_fisica} wide>
                <input
                  type="text"
                  value={form.ubicacion_fisica}
                  onChange={(e) => set("ubicacion_fisica", e.target.value)}
                  placeholder="Ej. A1, B2, Estante-3…"
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
                      const manejoId = Number(e.target.value);
                      set("unidad_manejo", manejoId);
                      const tipo = tiposManejo.find((t) => t.id === manejoId);
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
                    {tiposManejo.filter((t) => t.activo).map((t) => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </Field>

                {tipoManejoSeleccionado?.permite_conversion_unidad && (
                  <div style={{ marginTop: 12 }}>
                    <Field
                      label="Unidad base de stock"
                      required
                      error={errors.unidad_movimiento_base}
                      hint="En qué unidad se guarda internamente el stock de este rollo (ej. centímetros). En cada movimiento se podrá elegir esa unidad u otra compatible (ej. metros)."
                    >
                      <select
                        value={form.unidad_movimiento_base ?? ""}
                        onChange={(e) => set("unidad_movimiento_base", e.target.value ? Number(e.target.value) : null)}
                        style={{ maxWidth: 220 }}
                      >
                        <option value="">Selecciona…</option>
                        {unidadesMedida.filter((u) => u.activo).map((u) => (
                          <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}

                {tipoManejoSeleccionado?.requiere_multiplicador ? (
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <Field
                      label={`Unidades por ${tipoManejoSeleccionado?.nombre?.replace(/^Por /, "") ?? "empaque"}`}
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
                      label={`Cantidad de ${tipoManejoSeleccionado?.nombre?.replace(/^Por /, "") ?? "empaques"} iniciales`}
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
                ) : (
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