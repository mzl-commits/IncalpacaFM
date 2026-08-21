import { useState, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  Eye, 
  PencilSimple, 
  Copy, 
  Trash, 
  Star, 
  Check, 
  X,
  FilePdf,
  Printer,
  Package,
  Handshake,
  ShoppingCart,
} from "@phosphor-icons/react";

// ── Secciones para las fichas de bienes (3 tipos) ───────────────────────────
export interface AssetFichaSection {
  id: string;
  title: string;
  description: string;
  required?: boolean;
}

export const FICHA_SECTIONS_ASIGNACION: AssetFichaSection[] = [
  { id: "identificacion", title: "Identificación del bien", description: "Nombre, código FM, marca, modelo y serie del activo.", required: true },
  { id: "ubicacion", title: "Ubicación asignada", description: "Espacio físico donde se ubica el bien.", required: true },
  { id: "responsable", title: "Responsable actual", description: "Nombre del custodio o usuario asignado.", required: true },
  { id: "motivo", title: "Motivo de asignación", description: "Razón por la que se asignó el bien a ese responsable." },
  { id: "firma_responsable", title: "Firma del responsable", description: "Espacio para la firma del custodio.", required: true },
  { id: "firma_admin", title: "VB Control Patrimonial", description: "Firma del supervisor de FM/Control Patrimonial.", required: true },
];

export const FICHA_SECTIONS_ENTRADA: AssetFichaSection[] = [
  { id: "identificacion", title: "Identificación del bien", description: "Nombre, código FM, marca, modelo y serie del activo.", required: true },
  { id: "fecha_compra", title: "Fecha de compra", description: "Fecha en que se adquirió el bien.", required: true },
  { id: "costo", title: "Costo de adquisición", description: "Monto pagado y moneda (PEN/USD).", required: true },
  { id: "centro_costo", title: "Centro de costo", description: "Código de área o presupuesto que absorbió el gasto." },
  { id: "proveedor", title: "Proveedor", description: "Nombre del proveedor y número de factura." },
  { id: "espacio_asignado", title: "Espacio inicial asignado", description: "Si se asignó un espacio en el momento de la entrada." },
  { id: "observaciones", title: "Observaciones de entrada", description: "Notas adicionales sobre el estado del bien al ingresar." },
];

export const FICHA_SECTIONS_COMPLETO: AssetFichaSection[] = [
  { id: "identificacion", title: "Identificación del bien", description: "Nombre, código FM, marca, modelo y serie.", required: true },
  { id: "adquisicion", title: "Datos de adquisición", description: "Fecha de compra, costo, centro de costo y proveedor.", required: true },
  { id: "custodio", title: "Custodio y ubicación", description: "Responsable y espacio físico actual.", required: true },
  { id: "historial_asignacion", title: "Historial de asignaciones", description: "Tabla con todos los responsables anteriores." },
  { id: "mantenimiento", title: "Historial de mantenimiento", description: "Órdenes de trabajo ejecutadas sobre el bien." },
  { id: "estado_condicion", title: "Estado y condición operativa", description: "Condición actual (Bueno, Regular, Malo) y criticidad." },
  { id: "foto_bien", title: "Fotografía del bien", description: "Imagen principal del activo." },
  { id: "firma_responsable", title: "Firma del responsable", description: "Espacio para la firma del custodio." },
  { id: "firma_admin", title: "VB Control Patrimonial", description: "Firma del supervisor de FM." },
];

const ASSET_FICHA_TYPES = [
  {
    key: "asignacion",
    label: "Ficha de Asignación",
    icon: Handshake,
    description: "Detalla quién asignó el bien, a quién se asignó, dónde y por qué. Incluye firmas del custodio y FM.",
    sections: FICHA_SECTIONS_ASIGNACION,
    defaultSections: FICHA_SECTIONS_ASIGNACION.filter(s => s.required).map(s => s.id),
  },
  {
    key: "entrada",
    label: "Ficha de Entrada",
    icon: ShoppingCart,
    description: "Registra la compra del bien: costo, proveedor, centro de costo, espacio asignado y observaciones iniciales.",
    sections: FICHA_SECTIONS_ENTRADA,
    defaultSections: FICHA_SECTIONS_ENTRADA.filter(s => s.required).map(s => s.id),
  },
  {
    key: "completo",
    label: "Ficha Detallada",
    icon: Package,
    description: "Vista integral del bien: adquisición, asignación, historial de mantenimiento, estado y firmas.",
    sections: FICHA_SECTIONS_COMPLETO,
    defaultSections: FICHA_SECTIONS_COMPLETO.filter(s => s.required).map(s => s.id),
  },
] as const;

import { api } from "@/services/api";

export interface SectionOption {
  id: string;
  number: number;
  title: string;
  description: string;
  required?: boolean;
}

export const OFFICIAL_REPORT_SECTIONS: SectionOption[] = [
  {
    id: "1. Datos de identificación y ubicación del bien",
    number: 1,
    title: "1. Datos de identificación y ubicación del bien",
    description: "Información de la OT, bien/activo, ubicación física, técnico asignado y supervisor.",
    required: true,
  },
  {
    id: "2. Programación y registro de cronograma",
    number: 2,
    title: "2. Programación y registro de cronograma",
    description: "Fechas programadas, duración estimada, tiempo efectivo y registro de inicio/fin.",
  },
  {
    id: "3. Desglose de costos y recursos utilizados",
    number: 3,
    title: "3. Desglose de costos y recursos utilizados",
    description: "Detalle de repuestos, insumos, servicios de terceros y costos totales.",
  },
  {
    id: "4. Indicaciones técnicas y diagnóstico de campo",
    number: 4,
    title: "4. Indicaciones técnicas y diagnóstico de campo",
    description: "Observaciones del técnico, causa raíz del fallo y procedimiento realizado.",
  },
  {
    id: "5. Evidencia fotográfica de campo",
    number: 5,
    title: "5. Evidencia fotográfica de campo",
    description: "Registro fotográfico del estado inicial (antes) y estado final (después).",
  },
  {
    id: "6. Firmas y aprobaciones",
    number: 6,
    title: "6. Firmas y aprobaciones",
    description: "Espacios oficiales para firma del técnico responsable y V°B° de administración/control patrimonial.",
  },
  {
    id: "7. Satisfacción y conformidad",
    number: 7,
    title: "7. Satisfacción y conformidad",
    description: "Valoración del cliente/usuario, encuesta de conformidad y comentarios.",
  },
  {
    id: "8. Observaciones y recomendaciones",
    number: 8,
    title: "8. Observaciones y recomendaciones",
    description: "Recomendaciones preventivas adicionales y próximos mantenimientos sugeridos.",
  },
  {
    id: "9. Trazabilidad y verificación QR",
    number: 9,
    title: "9. Trazabilidad y verificación QR",
    description: "Código QR institucional vinculado al ID técnico único para validación pública.",
  },
];

export interface Template {
  id: string;
  name: string;
  scope: string;
  sections: string[];
  version: string;
  status: string;
  is_active: boolean;
  is_default: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function ReportTemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [sections, setSections] = useState<string[]>(
    OFFICIAL_REPORT_SECTIONS.map((s) => s.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<{
    name: string;
    sections: string[];
  } | null>(null);

  async function loadTemplates() {
    try {
      const { data } = await api.get<Template[]>("/report-templates/");
      setItems(data);
    } catch {
      setMessage("Error al cargar las plantillas de informes.");
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  function toggleSection(sectionId: string, required?: boolean) {
    if (required) return;
    setSections((current) =>
      current.includes(sectionId)
        ? current.filter((item) => item !== sectionId)
        : [...current, sectionId]
    );
  }

  function startEdit(template: Template) {
    setEditingId(template.id);
    setName(template.name);
    setIsDefault(template.is_default);
    setSections(template.sections.length ? template.sections : OFFICIAL_REPORT_SECTIONS.map((s) => s.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setIsDefault(false);
    setSections(OFFICIAL_REPORT_SECTIONS.map((s) => s.id));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (editingId) {
        await api.patch(`/report-templates/${editingId}/`, {
          name: name.trim(),
          scope: "ORDEN_TRABAJO",
          sections,
          is_default: isDefault,
          is_active: true,
        });
        setMessage("Plantilla actualizada correctamente.");
      } else {
        await api.post("/report-templates/", {
          name: name.trim(),
          scope: "ORDEN_TRABAJO",
          sections,
          is_default: isDefault,
          is_active: true,
        });
        setMessage("Nueva plantilla registrada correctamente.");
      }
      cancelEdit();
      await loadTemplates();
    } catch {
      setMessage("Error al guardar la plantilla en la base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDuplicate(template: Template) {
    try {
      setIsSubmitting(true);
      await api.post("/report-templates/", {
        name: `Copia de ${template.name}`,
        scope: "ORDEN_TRABAJO",
        sections: template.sections,
        is_default: false,
        is_active: true,
      });
      setMessage("Plantilla duplicada correctamente.");
      await loadTemplates();
    } catch {
      setMessage("Error al duplicar la plantilla.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetDefault(template: Template) {
    try {
      await api.patch(`/report-templates/${template.id}/`, {
        is_default: true,
      });
      setMessage(`"${template.name}" ahora es la plantilla predeterminada.`);
      await loadTemplates();
    } catch {
      setMessage("Error al marcar como predeterminada.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Está seguro de eliminar esta plantilla de informe?")) return;
    try {
      await api.delete(`/report-templates/${id}/`);
      setMessage("Plantilla eliminada correctamente.");
      await loadTemplates();
    } catch {
      setMessage("No se pudo eliminar la plantilla.");
    }
  }

  // ── Estado para fichas de bienes ──────────────────────────────────────────
  const [editingFichaKey, setEditingFichaKey] = useState<string | null>(null);
  const [fichaSections, setFichaSections] = useState<string[]>([]);
  const [fichaMessage, setFichaMessage] = useState<string | null>(null);
  const [fichaTemplates, setFichaTemplates] = useState<Record<string, Template>>({});

  async function loadFichaTemplates() {
    try {
      const { data } = await api.get<Template[]>("/report-templates/?scope=FICHA_BIEN");
      const map: Record<string, Template> = {};
      for (const t of data) {
        const match = t.name.match(/^FICHA_BIEN_(asignacion|entrada|completo)$/i);
        if (match) map[match[1].toLowerCase()] = t;
      }
      setFichaTemplates(map);
    } catch {
      // silencioso — puede no existir aún
    }
  }

  useEffect(() => { void loadFichaTemplates(); }, []);

  function startFichaEdit(fichaKey: string) {
    const fichaType = ASSET_FICHA_TYPES.find(f => f.key === fichaKey);
    if (!fichaType) return;
    const existing = fichaTemplates[fichaKey];
    setEditingFichaKey(fichaKey);
    setFichaSections(existing?.sections?.length ? existing.sections : fichaType.defaultSections);
  }

  function toggleFichaSection(sectionId: string, required?: boolean) {
    if (required) return;
    setFichaSections(prev =>
      prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
    );
  }

  async function saveFichaTemplate() {
    if (!editingFichaKey) return;
    const templateName = `FICHA_BIEN_${editingFichaKey}`;
    const existing = fichaTemplates[editingFichaKey];
    try {
      if (existing) {
        await api.patch(`/report-templates/${existing.id}/`, {
          sections: fichaSections,
          is_active: true,
        });
      } else {
        await api.post("/report-templates/", {
          name: templateName,
          scope: "FICHA_BIEN",
          sections: fichaSections,
          is_default: false,
          is_active: true,
        });
      }
      setFichaMessage("Plantilla de ficha guardada correctamente.");
      setEditingFichaKey(null);
      await loadFichaTemplates();
    } catch {
      setFichaMessage("Error al guardar la plantilla de ficha.");
    }
  }

  return (
    <section className="report-templates-page">
      {/* CABECERA INSTITUCIONAL */}
      <header className="page-heading">
        <p className="breadcrumb">Informes / Configuración Documental</p>
        <h1>GESTOR DE PLANTILLAS DE INFORMES TÉCNICOS</h1>
        <p style={{ fontSize: "14px", color: "#555555" }}>
          Define la estructura y secciones oficiales para la generación de informes técnicos A4 en IncalpacaFM.
        </p>
      </header>

      {message && (
        <div 
          style={{ 
            background: "#F0F8FF", 
            border: "1px solid #000000", 
            padding: "10px 16px", 
            marginBottom: "20px", 
            fontWeight: 600,
            fontSize: "13px"
          }}
        >
          {message}
        </div>
      )}

      {/* CONTENEDOR DE 2 ÁREAS PRINCIPALES */}
      <div className="report-template-layout">
        {/* ÁREA 1: NUEVA PLANTILLA / EDICIÓN */}
        <form className="document-panel" onSubmit={handleSubmit}>
          <div className="document-panel-header">
            <div>
              <h2>{editingId ? "Editar plantilla" : "Nueva plantilla"}</h2>
              <p>Configura las secciones documentales que incluirá el informe técnico.</p>
            </div>
            {editingId && (
              <button 
                type="button" 
                className="button-doc-action" 
                onClick={cancelEdit}
                title="Cancelar edición"
              >
                <X size={14} /> Cancelar
              </button>
            )}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
              Nombre de la plantilla *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Informe Técnico de Mantenimiento Preventivo"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #000000",
                fontSize: "14px",
                fontFamily: "system-ui, sans-serif"
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "#000000" }}
              />
              Marcar como plantilla predeterminada del sistema
            </label>
          </div>

          {/* SECCIONES CONFIGURABLES (BLOQUES DOCUMENTALES) */}
          <div style={{ borderTop: "1px solid #000000", paddingTop: "16px", marginBottom: "20px" }}>
            <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "15px", fontWeight: "bold", textTransform: "uppercase" }}>
              SECCIONES DEL INFORME TÉCNICO
            </h3>
            <p style={{ fontSize: "12px", color: "#666666", marginBottom: "12px" }}>
              Selecciona las secciones que se renderizarán en el informe PDF final.
            </p>

            <div className="section-config-grid">
              {OFFICIAL_REPORT_SECTIONS.map((sec) => {
                const active = sections.includes(sec.id);
                return (
                  <div
                    key={sec.id}
                    className={`section-config-block ${active ? "active" : ""}`}
                    onClick={() => toggleSection(sec.id, sec.required)}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={sec.required}
                      onChange={() => toggleSection(sec.id, sec.required)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="section-config-content">
                      <div className="section-config-title">
                        <span>{sec.title}</span>
                        {sec.required && <span className="badge-required">Requerida</span>}
                      </div>
                      <div className="section-config-desc">{sec.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", borderTop: "1px solid #000000", paddingTop: "16px" }}>
            <button 
              type="submit" 
              className="button-doc-action" 
              disabled={isSubmitting}
              style={{ background: "#000000", color: "#FFFFFF", padding: "10px 18px", fontSize: "13px" }}
            >
              <Check size={16} />
              {editingId ? "Guardar Cambios" : "Guardar Plantilla"}
            </button>

            <button
              type="button"
              className="button-doc-action"
              onClick={() => setPreviewTemplate({ name: name || "Vista Previa de Plantilla", sections })}
              style={{ padding: "10px 18px", fontSize: "13px" }}
            >
              <Eye size={16} />
              Vista Previa del Informe
            </button>
          </div>
        </form>

        {/* ÁREA 2: PLANTILLAS DISPONIBLES (CONECTADA A LA BD) */}
        <div className="document-panel">
          <div className="document-panel-header">
            <div>
              <h2>Plantillas disponibles</h2>
              <p>Estructuras registradas en la base de datos para la emisión de informes.</p>
            </div>
            <FileText size={22} />
          </div>

          {items.length ? (
            <div>
              {items.map((t) => (
                <div key={t.id} className={`template-item-card ${t.is_default ? "is-default" : ""}`}>
                  <div className="template-card-header">
                    <span className="template-card-title">{t.name}</span>
                    {t.is_default && (
                      <span className="badge-default-template">
                        <Star size={11} weight="fill" style={{ marginRight: "3px" }} />
                        Predeterminada
                      </span>
                    )}
                  </div>

                  <div className="template-card-sections">
                    <strong>Secciones incluidas ({t.sections.length || 0}):</strong>
                    <br />
                    {t.sections.length
                      ? t.sections.map((s) => s.split(".")[0]).join(" · ") + "."
                      : "Sin secciones seleccionadas."}
                  </div>

                  <div className="template-card-actions">
                    <button
                      type="button"
                      className="button-doc-action"
                      onClick={() => startEdit(t)}
                    >
                      <PencilSimple size={14} /> Editar
                    </button>

                    <button
                      type="button"
                      className="button-doc-action"
                      onClick={() => void handleDuplicate(t)}
                    >
                      <Copy size={14} /> Duplicar
                    </button>

                    <button
                      type="button"
                      className="button-doc-action"
                      onClick={() => setPreviewTemplate({ name: t.name, sections: t.sections })}
                    >
                      <Eye size={14} /> Vista previa
                    </button>

                    {!t.is_default && (
                      <button
                        type="button"
                        className="button-doc-action"
                        onClick={() => void handleSetDefault(t)}
                      >
                        <Star size={14} /> Predeterminada
                      </button>
                    )}

                    <button
                      type="button"
                      className="button-doc-action danger"
                      onClick={() => void handleDelete(t.id)}
                    >
                      <Trash size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "30px", textAlign: "center", color: "#666666", fontSize: "14px" }}>
              <FilePdf size={36} style={{ margin: "0 auto 10px auto", opacity: 0.4 }} />
              <p>Aún no hay plantillas registradas en el sistema.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE VISTA PREVIA DEL INFORME A4 */}
      {previewTemplate && (
        <div className="preview-modal-backdrop" onClick={() => setPreviewTemplate(null)}>
          <div className="preview-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h3>VISTA PREVIA DE INFORME TÉCNICO: {previewTemplate.name.toUpperCase()}</h3>
              <button 
                type="button" 
                className="preview-modal-close" 
                onClick={() => setPreviewTemplate(null)}
                aria-label="Cerrar vista previa"
              >
                <X size={20} />
              </button>
            </div>

            <div className="preview-modal-body">
              <div className="simulated-a4-document">
                {/* SIMULATED HEADER */}
                <div className="simulated-header">
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>INCALPACA FM S.A.</div>
                    <div style={{ fontSize: "10px", color: "#555555" }}>Sistema de Gestión Técnica y Bienes</div>
                    <div className="simulated-title" style={{ marginTop: "4px" }}>
                      INFORME TÉCNICO DE ORDEN N° OL-2026-0002
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "10px" }}>
                    <div>Fecha: 19 de agosto de 2026</div>
                    <div>Estado: EMITIDO</div>
                    <div>Plantilla: <strong>{previewTemplate.name}</strong></div>
                  </div>
                </div>

                {/* DINAMIC SECTIONS BASED ON PREVIEW TEMPLATE */}
                {previewTemplate.sections.map((secStr) => {
                  const secNum = parseInt(secStr.split(".")[0], 10);

                  if (secNum === 1) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">1. DATOS DE IDENTIFICACIÓN Y UBICACIÓN DEL BIEN</div>
                        <div className="simulated-grid-2">
                          <div><strong>Código de Orden:</strong> OL-2026-0002</div>
                          <div><strong>Solicitud Origen:</strong> SOL-2026-0009</div>
                          <div><strong>ID Técnico Bien:</strong> INC-BIEN-2026-000215</div>
                          <div><strong>Código Taxonomía (9 Niveles):</strong> INC1-AD-MKT-MT04-MOB-SE-BA-6A-SKU10</div>
                          <div><strong>Bien / Activo:</strong> Silla Ergonómica Tipo 1</div>
                          <div><strong>Ubicación Física:</strong> Casona / MKT / Módulo 4</div>
                        </div>
                      </div>
                    );
                  }

                  if (secNum === 2) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">2. PROGRAMACIÓN Y REGISTRO DE CRONOGRAMA</div>
                        <div className="simulated-grid-2">
                          <div><strong>Fecha/Hora Programada:</strong> 19/08/2026 08:30 AM</div>
                          <div><strong>Duración Estimada:</strong> 2.5 horas</div>
                          <div><strong>Tiempo Efectivo Registrado:</strong> 2.0 horas</div>
                          <div><strong>Estado de Ejecución:</strong> COMPLETADA</div>
                        </div>
                      </div>
                    );
                  }

                  if (secNum === 3) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">3. DESGLOSE DE COSTOS Y RECURSOS UTILIZADOS</div>
                        <table className="simulated-table">
                          <thead>
                            <tr>
                              <th>Categoría</th>
                              <th>Descripción de Recurso / Repuesto</th>
                              <th style={{ textAlign: "right" }}>Monto (S/)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Materiales</td>
                              <td>Rueda garrucha giratoria de nylon tipo A</td>
                              <td style={{ textAlign: "right" }}>S/ 44.00</td>
                            </tr>
                            <tr>
                              <td>Mano de obra</td>
                              <td>Servicio especializado de mantenimiento mecánico</td>
                              <td style={{ textAlign: "right" }}>S/ 150.00</td>
                            </tr>
                            <tr>
                              <td colSpan={2} style={{ textAlign: "right", fontWeight: "bold" }}>TOTAL:</td>
                              <td style={{ textAlign: "right", fontWeight: "bold" }}>S/ 194.00</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  if (secNum === 4) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">4. INDICACIONES TÉCNICAS Y DIAGNÓSTICO DE CAMPO</div>
                        <p style={{ fontSize: "10.5px" }}>
                          Se realizó la inspección general y ajuste de la base giratoria. Se reemplazaron 2 garruchas desgastadas por sobreuso operativo en oficina. Se aplicó lubricación y verificación funcional sin ruidos extraños.
                        </p>
                      </div>
                    );
                  }

                  if (secNum === 5) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">5. EVIDENCIA FOTOGRÁFICA DE CAMPO</div>
                        <div className="simulated-photo-grid">
                          <div className="simulated-photo-box">[ FOTOGRAFÍA ESTADO INICIAL (ANTES) ]</div>
                          <div className="simulated-photo-box">[ FOTOGRAFÍA ESTADO FINAL (DESPUÉS) ]</div>
                        </div>
                      </div>
                    );
                  }

                  if (secNum === 6) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">6. FIRMAS Y APROBACIONES</div>
                        <div className="simulated-signatures">
                          <div>
                            <div className="simulated-sig-line">Firma del Técnico Responsable</div>
                            <div style={{ fontSize: "9.5px", color: "#444444" }}>Luis Fernández — Técnico Especialista</div>
                          </div>
                          <div>
                            <div className="simulated-sig-line">V°B° Supervisor / Administración</div>
                            <div style={{ fontSize: "9.5px", color: "#444444" }}>Rosa Medina — Control Patrimonial & FM</div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (secNum === 7) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">7. SATISFACCIÓN Y CONFORMIDAD</div>
                        <div><strong>Valoración de Servicio:</strong> ★★★★★ (5/5 Excelente)</div>
                        <div><strong>Comentarios del Usuario:</strong> Atención rápida y trabajo conforme en oficina.</div>
                      </div>
                    );
                  }

                  if (secNum === 8) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">8. OBSERVACIONES Y RECOMENDACIONES</div>
                        <p style={{ fontSize: "10.5px" }}>
                          Revisar nivelación de superficie en módulo de trabajo para reducir desgaste desproporcionado de garruchas.
                        </p>
                      </div>
                    );
                  }

                  if (secNum === 9) {
                    return (
                      <div key={secStr} className="simulated-section">
                        <div className="simulated-section-title">9. TRAZABILIDAD Y VERIFICACIÓN QR</div>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <div style={{ width: "60px", height: "60px", border: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>QR</div>
                          <div>
                            <div><strong>ID Técnico Único (QR):</strong> INC-BIEN-2026-000215</div>
                            <div><strong>Normas aplicables:</strong> APA 7 · ISO 55000 · NTP-ISO 55001</div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          SECCIÓN: FICHAS DE BIENES (3 plantillas independientes)
      ──────────────────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <div className="document-panel" style={{ marginBottom: 0 }}>
          <div className="document-panel-header">
            <div>
              <h2>Plantillas de Fichas de Bienes</h2>
              <p>Configura las secciones de cada tipo de reporte imprimible desde la ficha del bien.</p>
            </div>
            <Printer size={22} />
          </div>

          {fichaMessage && (
            <div style={{ background: "#F0FFF4", border: "1px solid #2E7D32", padding: "10px 16px", fontSize: "13px", marginBottom: 12, borderRadius: 4 }}>
              {fichaMessage}
              <button type="button" onClick={() => setFichaMessage(null)} style={{ marginLeft: 8, cursor: "pointer", background: "none", border: "none", fontWeight: "bold" }}>✕</button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, padding: "16px 0" }}>
            {ASSET_FICHA_TYPES.map((fichaType) => {
              const Icon = fichaType.icon;
              const existing = fichaTemplates[fichaType.key];
              const savedCount = existing?.sections?.length ?? fichaType.defaultSections.length;
              const isEditing = editingFichaKey === fichaType.key;

              return (
                <div key={fichaType.key} className="document-panel" style={{ margin: 0, border: "1px solid #e0e0e0", borderRadius: 8, padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <Icon size={26} weight="duotone" style={{ color: "#1a237e", marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 15, display: "block", marginBottom: 4 }}>{fichaType.label}</strong>
                      <p style={{ fontSize: 12, color: "#555", margin: 0 }}>{fichaType.description}</p>
                    </div>
                  </div>

                  {!isEditing ? (
                    <div style={{ padding: "12px 20px" }}>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
                        <strong>{savedCount}</strong> secciones activas
                        {existing ? <span style={{ marginLeft: 8, color: "#2e7d32", fontWeight: 600 }}>· Configurada</span> : <span style={{ marginLeft: 8, color: "#888" }}>· Config. por defecto</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                        {fichaType.sections.map(sec => {
                          const active = existing?.sections?.includes(sec.id) ?? fichaType.defaultSections.includes(sec.id);
                          return (
                            <span key={sec.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: active ? "#e3f2fd" : "#f5f5f5", color: active ? "#0d47a1" : "#999", fontWeight: active ? 600 : 400 }}>
                              {active ? <Check size={10} weight="bold" style={{ marginRight: 3 }} /> : <X size={10} style={{ marginRight: 3 }} />}
                              {sec.title}
                            </span>
                          );
                        })}
                      </div>
                      <button type="button" className="button button-secondary" onClick={() => startFichaEdit(fichaType.key)} style={{ width: "100%", justifyContent: "center" }}>
                        <PencilSimple size={14} /> Editar plantilla
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: "16px 20px" }}>
                      <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Activa o desactiva las secciones que aparecerán en el PDF:</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                        {fichaType.sections.map(sec => {
                          const active = fichaSections.includes(sec.id);
                          return (
                            <div
                              key={sec.id}
                              className={`section-config-block ${active ? "active" : ""}`}
                              onClick={() => toggleFichaSection(sec.id, sec.required)}
                              style={{ cursor: sec.required ? "not-allowed" : "pointer" }}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                disabled={sec.required}
                                onChange={() => toggleFichaSection(sec.id, sec.required)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="section-config-content">
                                <div className="section-config-title">
                                  <span>{sec.title}</span>
                                  {sec.required && <span className="badge-required">Requerida</span>}
                                </div>
                                <div className="section-config-desc">{sec.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="button button-primary" onClick={() => void saveFichaTemplate()} style={{ flex: 1, justifyContent: "center" }}>
                          <Check size={14} /> Guardar
                        </button>
                        <button type="button" className="button button-secondary" onClick={() => setEditingFichaKey(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
