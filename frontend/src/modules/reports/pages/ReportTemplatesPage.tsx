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
  FilePdf
} from "@phosphor-icons/react";
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
    description: "Valoración del cliente/solicitante, encuesta de conformidad y comentarios.",
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
                        <div><strong>Comentarios del Solicitante:</strong> Atención rápida y trabajo conforme en oficina.</div>
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
    </section>
  );
}
