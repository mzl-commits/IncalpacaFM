import { ArrowLeft, Trash, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal } from "@/components/shared/Modal";
import { CategoriaSubcategoriaManager } from "@/components/shared/CategoriaSubcategoriaManager";
import { Field } from "@/modules/almacen/components/shared/Field";
import { GruiaCroquisFormulario } from "@/modules/almacen/components/GuiaCroquisFormulario";

import {
  createMaterial,
  getMaterialDetalle,
  listCategorias,
  listSubcategorias,
  updateMaterial,
} from "@/modules/almacen/catalogoRepository";
import type {
  MaterialCreatePayload,
  TipoControl,
  UnidadMedida,
  UnidadManejo,
} from "@/modules/almacen/types";

// ─── Tipos y constantes del formulario ───────────────────────────────────────
type Fase = "form" | "exito";

export function MaterialFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fotoInputId = useId();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const materialId = Number(id);

  const [fase, setFase] = useState<Fase>("form");
  const [formInicializado, setFormInicializado] = useState(false);
  const [materialCreado, setMaterialCreado] = useState<{ id: number; codigo: string; nombre: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState<MaterialCreatePayload>({
    subcategoria: 0,
    nombre: "",
    marca: "",
    modelo: "",
    medida: "",
    unidad_medida: "mm",
    grosor: "",
    largo: "",
    ubicacion_fisica: "",
    precio: "",
    tipo_control: "retornable",
    control_individual: false,
    periodicidad_valor: 3,
    periodicidad_unidad: "meses",
    unidad_manejo: "unidad",
    unidades_por_caja: "",
  });
  // Solo usado en el paso "Stock inicial" para calcular cantidad_total = cajas × unidades_por_caja.
  const [cajasIniciales, setCajasIniciales] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<number>(0);
  const [catalogoModalOpen, setCatalogoModalOpen] = useState(false);

  // Queries
  const { data: categorias = [] } = useQuery({ queryKey: ["categorias"], queryFn: listCategorias });

  // Subcategorías filtradas por la categoría seleccionada (Paso 1 del formulario)
  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", categoriaId],
    queryFn: () => listSubcategorias(categoriaId),
    enabled: !!categoriaId,
  });

  // Edición: cargar material existente
  const { data: materialExistente, isLoading: isLoadingMaterial } = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => getMaterialDetalle(materialId),
    enabled: isEditMode,
  });
  const { data: todasSubcategorias = [] } = useQuery({
    queryKey: ["subcategorias-todas"],
    queryFn: () => listSubcategorias(),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (isEditMode && materialExistente && todasSubcategorias.length > 0 && !formInicializado) {
      const sub = todasSubcategorias.find((s) => s.id === materialExistente.subcategoria);
      if (sub) setCategoriaId(sub.categoria);
      setForm({
        subcategoria: materialExistente.subcategoria,
        nombre: materialExistente.nombre,
        marca: materialExistente.marca,
        modelo: materialExistente.modelo,
        medida: materialExistente.medida,
        unidad_medida: materialExistente.unidad_medida ?? "mm",
        grosor: materialExistente.grosor ?? "",
        largo: materialExistente.largo ?? "",
        ubicacion_fisica: materialExistente.ubicacion_fisica,
        precio: materialExistente.precio ?? "",
        tipo_control: materialExistente.tipo_control,
        control_individual: materialExistente.control_individual,
        periodicidad_valor: materialExistente.periodicidad_valor ?? 3,
        periodicidad_unidad: materialExistente.periodicidad_unidad ?? "meses",
        unidad_manejo: materialExistente.unidad_manejo ?? "unidad",
        unidades_por_caja: materialExistente.unidades_por_caja ?? "",
        cantidad_total: materialExistente.cantidad_total,
      });
      if (materialExistente.foto) setFotoPreview(materialExistente.foto);
      setFormInicializado(true);
    }
  }, [isEditMode, materialExistente, todasSubcategorias, formInicializado]);

  // Mutations
  const guardarMut = useMutation({
    mutationFn: () =>
      isEditMode
        ? updateMaterial(materialId, form, fotoFile)
        : createMaterial(form, fotoFile),
    onSuccess: (mat) => {
      qc.invalidateQueries({ queryKey: ["materiales"] });
      if (isEditMode) {
        qc.invalidateQueries({ queryKey: ["material", materialId] });
        navigate(`/almacen/catalogo/${mat.id}`);
        return;
      }
      // Material nuevo: si tiene control individual, ir directo a alta de piezas
      if (form.control_individual) {
        navigate(`/almacen/catalogo/${mat.id}/alta-piezas`);
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
    if (
      !form.control_individual &&
      form.unidad_manejo === "caja" &&
      !(Number(form.unidades_por_caja) > 0)
    ) {
      errs.unidades_por_caja = "Indica cuántas unidades trae cada caja.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    guardarMut.mutate();
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
    // Refresca categorías/subcategorías en el formulario tras crear/editar/eliminar
    // desde el modal, para que aparezcan de inmediato en los selects.
    qc.invalidateQueries({ queryKey: ["categorias"] });
    qc.invalidateQueries({ queryKey: ["subcategorias"] });
    qc.invalidateQueries({ queryKey: ["subcategorias-todas"] });
  }

  // ─── Fase: exito ──────────────────────────────────────────────────────────
  if (fase === "exito") {
    return (
      <section className="success-panel">
        <h2>Material registrado</h2>
        <p>
          <code className="pieza-code">{materialCreado?.codigo}</code> —{" "}
          {materialCreado?.nombre}
        </p>
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/catalogo/${materialCreado?.id}`}>
            Ver ficha del material
          </Link>
          <Link className="button button-secondary" to="/almacen/catalogo">
            Volver al catálogo
          </Link>
        </div>
      </section>
    );
  }


  if (isEditMode && (isLoadingMaterial || !formInicializado)) {
    return <div className="loading-panel">Cargando datos del material…</div>;
  }

  // ─── Fase: form ─────────────────────────────────────────────────────────
  return (
    <section>
      <div className="wizard-heading">
        <Link to="/almacen/catalogo" className="back-link">
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
          {/* Clasificación */}
          <div className="form-panel">
            <div
              className="form-section-heading"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
            >
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
            {/* Aviso si no hay categorías */}
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
                  No hay categorías creadas. Haz clic en{" "}
                  <strong>+ Gestionar categorías</strong> para agregar una antes de
                  continuar.
                </span>
              </div>
            )}
          </div>

          {/* Datos del material */}
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
              <Field label="Medida" hint="Solo si aplica (ej. 5/16&quot; o M8)" error={errors.medida}>
                <input
                  type="text"
                  value={form.medida}
                  onChange={(e) => set("medida", e.target.value)}
                />
              </Field>
              <Field label="Unidad de medida" error={errors.unidad_medida}>
                <select
                  value={form.unidad_medida}
                  onChange={(e) => set("unidad_medida", e.target.value as UnidadMedida)}
                >
                  <option value="mm">Milímetros (mm)</option>
                  <option value="cm">Centímetros (cm)</option>
                  <option value="in">Pulgadas (in)</option>
                  <option value="ft">Pies (ft)</option>
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
              <Field label="Precio (S/)" hint="Precio de referencia (opcional)" error={errors.precio}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio ?? ""}
                  onChange={(e) => set("precio", e.target.value)}
                  placeholder="Ej. 150.00"
                />
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

              {/* Guía visual del croquis */}
              <div style={{ gridColumn: "1 / -1" }}>
                <GruiaCroquisFormulario />
              </div>
            </div>
          </div>

          {/* Tipo de control */}
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

            {/* Stock inicial: solo cuando NO es control individual y es no_retornable */}
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
                    value={form.unidad_manejo ?? "unidad"}
                    onChange={(e) => {
                      const manejo = e.target.value as UnidadManejo;
                      set("unidad_manejo", manejo);
                      if (manejo === "unidad") {
                        set("unidades_por_caja", "");
                        setCajasIniciales("");
                      }
                    }}
                    style={{ maxWidth: 220 }}
                  >
                    <option value="unidad">Por unidad suelta</option>
                    <option value="caja">Por caja</option>
                  </select>
                </Field>

                {form.unidad_manejo === "caja" ? (
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <Field
                      label="Unidades por caja"
                      required
                      error={errors.unidades_por_caja}
                      hint="Cuántas unidades trae cada caja cerrada."
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
                      label="Cantidad de cajas iniciales"
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

          {/* Foto */}
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

          {/* Errores generales */}
          {errors.non_field_errors && (
            <div className="aviso-estuche" style={{ borderColor: "var(--error)", background: "#fff5f5", color: "var(--error)" }}>
              {errors.non_field_errors}
            </div>
          )}

          <div className="form-actions">
            <Link to="/almacen/catalogo" className="button button-secondary">
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

        {/* Panel de ayuda */}
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
        <CategoriaSubcategoriaManager onChange={handleCatalogoChange} />
      </Modal>
    </section>
  );
}