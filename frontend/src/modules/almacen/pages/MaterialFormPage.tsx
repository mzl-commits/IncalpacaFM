import { ArrowLeft, CaretDown, CaretUp, Trash, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal } from "@/components/shared/Modal";
import { CategoriaSubcategoriaManager } from "@/components/shared/CategoriaSubcategoriaManager";

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
} from "@/modules/almacen/types";

// ─── Subcomponente Field ───────────────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  error,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
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
      {hint && !error && <small>{hint}</small>}
      {error && (
        <small className="field-error">
          <WarningCircle size={14} />
          {error}
        </small>
      )}
    </label>
  );
}

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
    grosor_mm: "",
    largo_mm: "",
    ubicacion_fisica: "",
    tipo_control: "retornable",
    control_individual: false,
  });
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
        grosor_mm: materialExistente.grosor_mm ?? "",
        largo_mm: materialExistente.largo_mm ?? "",
        ubicacion_fisica: materialExistente.ubicacion_fisica,
        tipo_control: materialExistente.tipo_control,
        control_individual: materialExistente.control_individual,
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
              <Field label="Grosor / Diámetro (mm)" error={errors.grosor_mm}>
                <input
                  type="number"
                  step="0.01"
                  value={form.grosor_mm}
                  onChange={(e) => set("grosor_mm", e.target.value)}
                />
              </Field>
              <Field label="Largo (mm)" error={errors.largo_mm}>
                <input
                  type="number"
                  step="0.01"
                  value={form.largo_mm}
                  onChange={(e) => set("largo_mm", e.target.value)}
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
                  Los materiales no retornables se consumen. Indica cuántas unidades
                  hay disponibles actualmente.
                </small>
                <Field label="Cantidad en stock" required error={errors.cantidad_total}>
                  <input
                    type="number"
                    min={0}
                    value={(form as any).cantidad_total ?? 0}
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

// ─── Gu\u00eda visual de croquis para el formulario ──────────────────────────────

const FORM_SLIDES = [
  {
    src: "/croquis_almacen_3.png",
    titulo: "Mapa de c\u00f3digos de ubicaci\u00f3n",
    desc: "Usa este mapa para elegir el c\u00f3digo de secci\u00f3n correcto (A1, B2, C1\u2026).",
  },
  {
    src: "/croquis_almacen_1.png",
    titulo: "Plano general",
    desc: "Vista superior del almac\u00e9n con todas las zonas demarcadas.",
  },
  {
    src: "/croquis_almacen_2.png",
    titulo: "Zonas por tipo de herramienta",
    desc: "Zona A = Manuales \u00b7 Zona B = El\u00e9ctricas \u00b7 Zona C = Consumibles.",
  },
];

function GruiaCroquisFormulario() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const prev = () => setSlide((s) => (s - 1 + FORM_SLIDES.length) % FORM_SLIDES.length);
  const next = () => setSlide((s) => (s + 1) % FORM_SLIDES.length);
  const current = FORM_SLIDES[slide];

  return (
    <div
      style={{
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--surface-raised, #f9fafb)",
      }}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: "transparent", border: 0, cursor: "pointer",
          fontSize: 13, fontWeight: 500, color: "var(--primary, #2563eb)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          \ud83d\uddfa\ufe0f Ver croquis del almac\u00e9n \u2014 gu\u00eda para elegir ubicaci\u00f3n
        </span>
        {open ? <CaretUp size={15} /> : <CaretDown size={15} />}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
          {/* Mini carrusel */}
          <div style={{ position: "relative", background: "#f1f5f9" }}>
            <img
              src={current.src}
              alt={current.titulo}
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
            />
            <button
              type="button"
              onClick={prev}
              style={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,.88)", border: "1px solid #d1d5db",
                borderRadius: "50%", width: 30, height: 30,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.1)",
              }}
            >
              <CaretDown size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
            <button
              type="button"
              onClick={next}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,.88)", border: "1px solid #d1d5db",
                borderRadius: "50%", width: 30, height: 30,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.1)",
              }}
            >
              <CaretUp size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
          </div>

          {/* Pie */}
          <div style={{ padding: "10px 14px" }}>
            <strong style={{ fontSize: 13, display: "block", marginBottom: 3 }}>{current.titulo}</strong>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>{current.desc}</p>
            <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
              {FORM_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlide(i)}
                  style={{
                    width: i === slide ? 18 : 6, height: 6,
                    borderRadius: 3, padding: 0, border: "none", cursor: "pointer",
                    background: i === slide ? "var(--primary, #2563eb)" : "#d1d5db",
                    transition: "width .18s, background .18s",
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0", textAlign: "center" }}>
              \u26a0\ufe0f Im\u00e1genes de prueba. Se reemplazar\u00e1n con el croquis real del almac\u00e9n.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}