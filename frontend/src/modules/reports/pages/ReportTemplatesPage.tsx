import { FileText, Plus } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { api } from "@/services/api";

const options = ["Resumen ejecutivo", "Técnicos y horas", "Costos", "Satisfacción", "Evidencias antes y después", "Trazabilidad"];
type Template = { id: string; name: string; scope: string; sections: string[]; is_active: boolean };
export function ReportTemplatesPage() {
  const [items, setItems] = useState<Template[]>([]); const [name, setName] = useState(""); const [sections, setSections] = useState<string[]>(options);
  async function load() { const { data } = await api.get<Template[]>("/report-templates/"); setItems(data); }
  useEffect(() => { void load(); }, []);
  async function create(event: React.FormEvent) { event.preventDefault(); if (!name.trim()) return; await api.post("/report-templates/", { name, scope: "ORDEN_TRABAJO", sections, is_active: true }); setName(""); await load(); }
  return <section className="report-templates-page"><header className="page-heading"><div><p className="breadcrumb">Informes / Plantillas</p><h1>Gestor de plantillas</h1><p>Define qué información debe incluir cada informe de OT antes de generarlo.</p></div></header><div className="report-template-layout"><form className="form-panel" onSubmit={create}><div className="form-section-heading"><h2>Nueva plantilla</h2><p>Las secciones elegidas se aplicarán a informes posteriores.</p></div><label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Informe de cierre de mantenimiento" required /></label><fieldset className="template-section-picker"><legend>Secciones</legend>{options.map((option) => <label key={option}><input type="checkbox" checked={sections.includes(option)} onChange={() => setSections((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option])}/>{option}</label>)}</fieldset><button className="button button-primary" type="submit"><Plus size={18}/>Guardar plantilla</button></form><section className="data-panel template-list"><header><FileText size={22}/><div><h2>Plantillas disponibles</h2><p>Disponibles para administración.</p></div></header>{items.length ? <ul>{items.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.sections.join(" · ")}</span></li>)}</ul> : <p className="empty-row">Aún no hay plantillas creadas.</p>}</section></div></section>;
}
