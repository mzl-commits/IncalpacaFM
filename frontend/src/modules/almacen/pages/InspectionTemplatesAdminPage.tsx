import { FloppyDisk, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createCriterio,
  createPlantillaCriterio,
  deleteCriterio,
  deletePlantillaCriterio,
  listPlantillasCriterios,
  updateCriterio,
  updatePlantillaCriterio,
} from "@/modules/almacen/inspeccionRepository";
import type { Criterio, PlantillaCriterio } from "@/modules/almacen/types";

type QuestionDraft = Pick<Criterio, "plantilla" | "texto" | "orden">;

export function InspectionTemplatesAdminPage() {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ["plantillas-criterios"],
    queryFn: listPlantillasCriterios,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<PlantillaCriterio | null>(null);
  const [question, setQuestion] = useState<QuestionDraft>({ plantilla: 0, texto: "", orden: 1 });
  const [editingQuestion, setEditingQuestion] = useState<Criterio | null>(null);
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["plantillas-criterios"] });
  const message = (value: string) => setNotice(value);

  const templateMutation = useMutation({
    mutationFn: async () => {
      const name = templateName.trim();
      if (!name) throw new Error("Indica un nombre para el formulario.");
      return editingTemplate
        ? updatePlantillaCriterio(editingTemplate.id, name)
        : createPlantillaCriterio(name);
    },
    onSuccess: async (template) => {
      await refresh();
      setSelectedId(template.id);
      setTemplateName("");
      setEditingTemplate(null);
      message("Formulario guardado.");
    },
    onError: (cause: Error) => message(cause.message || "No se pudo guardar el formulario."),
  });

  const questionMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecciona un formulario.");
      if (!question.texto.trim()) throw new Error("Escribe la pregunta o criterio.");
      const payload = { ...question, plantilla: selected.id, texto: question.texto.trim(), orden: Number(question.orden) || 1 };
      return editingQuestion ? updateCriterio(editingQuestion.id, payload) : createCriterio(payload);
    },
    onSuccess: async () => {
      await refresh();
      setQuestion({ plantilla: selected?.id ?? 0, texto: "", orden: (selected?.criterios.length ?? 0) + 1 });
      setEditingQuestion(null);
      message("Pregunta guardada.");
    },
    onError: (cause: Error) => message(cause.message || "No se pudo guardar la pregunta."),
  });

  const removeTemplate = useMutation({
    mutationFn: deletePlantillaCriterio,
    onSuccess: async () => { await refresh(); setSelectedId(null); message("Formulario eliminado."); },
    onError: () => message("No se puede eliminar un formulario que ya está vinculado a inspecciones o catálogos."),
  });
  const removeQuestion = useMutation({
    mutationFn: deleteCriterio,
    onSuccess: async () => { await refresh(); message("Pregunta eliminada."); },
    onError: () => message("No se pudo eliminar la pregunta porque ya tiene respuestas registradas."),
  });

  const openTemplateEdit = (template: PlantillaCriterio) => {
    setEditingTemplate(template); setTemplateName(template.nombre); setNotice("");
  };
  const openQuestionEdit = (item: Criterio) => {
    setEditingQuestion(item); setQuestion({ plantilla: item.plantilla, texto: item.texto, orden: item.orden }); setNotice("");
  };

  return (
    <section className="page-shell" style={{ maxWidth: 1240 }}>
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Formularios / Inspecciones</p>
          <h1>Formularios de inspección</h1>
          <p>Crea formularios y administra sus preguntas. Los cambios aplican a nuevas inspecciones; el historial ya emitido se conserva.</p>
        </div>
        <Link className="button button-secondary" to="/administracion/formularios">Volver al centro</Link>
      </header>
      {notice && <p className="form-alert" role="status">{notice}</p>}
      {error && <p className="form-alert" role="alert">No se pudieron cargar los formularios.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, .8fr) minmax(0, 1.6fr)", gap: 20, alignItems: "start" }}>
        <aside className="data-panel">
          <h2>Formularios</h2>
          <form onSubmit={(event) => { event.preventDefault(); templateMutation.mutate(); }} className="stack-form">
            <label className="field"><span>{editingTemplate ? "Editar nombre" : "Nuevo formulario"}</span><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ej. Inspección eléctrica" /></label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button button-primary" disabled={templateMutation.isPending}><FloppyDisk size={18} />{editingTemplate ? "Guardar" : "Crear"}</button>
              {editingTemplate && <button type="button" className="button button-secondary" onClick={() => { setEditingTemplate(null); setTemplateName(""); }}><X size={18} />Cancelar</button>}
            </div>
          </form>
          <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
            {isLoading && <span>Cargando formularios…</span>}
            {templates.map((template) => <div key={template.id} style={{ padding: 12, border: `1px solid ${selectedId === template.id ? "var(--primary)" : "var(--border)"}`, borderRadius: 8, background: selectedId === template.id ? "var(--surface-subtle)" : undefined }}>
              <button type="button" onClick={() => { setSelectedId(template.id); setQuestion({ plantilla: template.id, texto: "", orden: template.criterios.length + 1 }); setEditingQuestion(null); }} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", cursor: "pointer" }}><strong>{template.nombre}</strong><small style={{ display: "block", marginTop: 3 }}>{template.criterios.length} pregunta(s)</small></button>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button type="button" className="icon-button" aria-label={`Editar ${template.nombre}`} onClick={() => openTemplateEdit(template)}><PencilSimple /></button><button type="button" className="icon-button" aria-label={`Eliminar ${template.nombre}`} onClick={() => { if (window.confirm(`¿Eliminar el formulario “${template.nombre}”?`)) removeTemplate.mutate(template.id); }}><Trash /></button></div>
            </div>)}
          </div>
        </aside>
        <article className="data-panel">
          {selected ? <>
            <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}><div><h2>{selected.nombre}</h2><p>Define el orden y texto de cada pregunta.</p></div><span className="status">{selected.criterios.length} preguntas</span></header>
            <form onSubmit={(event) => { event.preventDefault(); questionMutation.mutate(); }} className="stack-form" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <label className="field"><span>{editingQuestion ? "Editar pregunta" : "Nueva pregunta"}</span><input value={question.texto} onChange={(event) => setQuestion((current) => ({ ...current, texto: event.target.value }))} placeholder="Ej. Verificar que el cable no tenga cortes" /></label>
              <label className="field" style={{ maxWidth: 150 }}><span>Orden</span><input type="number" min="1" value={question.orden} onChange={(event) => setQuestion((current) => ({ ...current, orden: Number(event.target.value) }))} /></label>
              <div style={{ display: "flex", gap: 8 }}><button className="button button-primary" disabled={questionMutation.isPending}><Plus size={18} />{editingQuestion ? "Actualizar" : "Agregar pregunta"}</button>{editingQuestion && <button type="button" className="button button-secondary" onClick={() => { setEditingQuestion(null); setQuestion({ plantilla: selected.id, texto: "", orden: selected.criterios.length + 1 }); }}><X size={18} />Cancelar</button>}</div>
            </form>
            <ol style={{ display: "grid", gap: 10, marginTop: 22, paddingLeft: 24 }}>{selected.criterios.map((item) => <li key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}><div style={{ flex: 1 }}><strong>{item.texto}</strong><small style={{ display: "block", marginTop: 3 }}>Orden {item.orden}</small></div><button type="button" className="icon-button" aria-label={`Editar pregunta ${item.orden}`} onClick={() => openQuestionEdit(item)}><PencilSimple /></button><button type="button" className="icon-button" aria-label={`Eliminar pregunta ${item.orden}`} onClick={() => { if (window.confirm("¿Eliminar esta pregunta?")) removeQuestion.mutate(item.id); }}><Trash /></button></li>)}</ol>
            {!selected.criterios.length && <p className="empty-state">Aún no hay preguntas. Agrega la primera para activar este formulario.</p>}
          </> : <div className="empty-state"><h2>Selecciona un formulario</h2><p>Crea o elige un formulario para administrar sus preguntas.</p></div>}
        </article>
      </div>
    </section>
  );
}
