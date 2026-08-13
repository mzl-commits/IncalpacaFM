import { FloppyDisk, PencilSimple, Plus, Trash, WarningCircle, X } from "@phosphor-icons/react";
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
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Formularios / Inspecciones</p>
          <h1>Formularios de inspección</h1>
          <p>Crea formularios y administra sus preguntas. Los cambios aplican a nuevas inspecciones; el historial ya emitido se conserva.</p>
        </div>
        <Link className="button button-secondary" to="/administracion/formularios">Volver al centro</Link>
      </div>

      {error && (
        <div className="alert-banner alert-banner-error mb-16">
          <WarningCircle size={18} />
          <span>No se pudieron cargar los formularios.</span>
        </div>
      )}
      {notice && <p className="text-muted-sm mb-16" role="status">{notice}</p>}

      <div className="grid-2col" style={{ gridTemplateColumns: "minmax(280px, .8fr) minmax(0, 1.6fr)", alignItems: "start" }}>
        {/* ── Lista de formularios ───────────────────────────────────────── */}
        <div className="data-panel">
          <div className="table-toolbar">
            <strong style={{ fontSize: 15 }}>Formularios</strong>
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); templateMutation.mutate(); }}
            style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}
          >
            <label className="field">
              <span>{editingTemplate ? "Editar nombre" : "Nuevo formulario"}</span>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Ej. Inspección eléctrica"
              />
            </label>
            <div className="flex-row">
              <button className="button button-primary" disabled={templateMutation.isPending}>
                <FloppyDisk size={18} />{editingTemplate ? "Guardar" : "Crear"}
              </button>
              {editingTemplate && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => { setEditingTemplate(null); setTemplateName(""); }}
                >
                  <X size={18} />Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="checklist-list" style={{ paddingTop: 0 }}>
            {isLoading && <span className="text-muted-sm">Cargando formularios…</span>}
            {!isLoading && templates.length === 0 && (
              <p className="empty-row">Aún no hay formularios creados.</p>
            )}
            {templates.map((template) => (
              <div
                key={template.id}
                className="checklist-row"
                style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(template.id);
                    setQuestion({ plantilla: template.id, texto: "", orden: template.criterios.length + 1 });
                    setEditingQuestion(null);
                  }}
                  style={{ textAlign: "left", border: 0, background: "transparent", cursor: "pointer", padding: 0 }}
                >
                  <strong style={{ fontSize: 13, color: selectedId === template.id ? "var(--accent)" : "var(--text)" }}>
                    {template.nombre}
                  </strong>
                  <small className="text-muted-sm" style={{ display: "block", marginTop: 2 }}>
                    {template.criterios.length} pregunta(s)
                  </small>
                </button>
                <div className="flex-row">
                  <button
                    type="button"
                    className="button button-sm button-secondary"
                    aria-label={`Editar ${template.nombre}`}
                    onClick={() => openTemplateEdit(template)}
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button-danger"
                    aria-label={`Eliminar ${template.nombre}`}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el formulario "${template.nombre}"?`)) removeTemplate.mutate(template.id);
                    }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Preguntas del formulario seleccionado ──────────────────────── */}
        <div className="data-panel">
          {selected ? (
            <>
              <div className="table-toolbar">
                <div>
                  <strong style={{ fontSize: 15 }}>{selected.nombre}</strong>
                  <p className="text-muted-sm" style={{ margin: "2px 0 0" }}>Define el orden y texto de cada pregunta.</p>
                </div>
                <span className="text-muted-sm">{selected.criterios.length} preguntas</span>
              </div>

              <form
                onSubmit={(event) => { event.preventDefault(); questionMutation.mutate(); }}
                style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}
              >
                <div className="form-grid">
                  <label className="field field-wide">
                    <span>{editingQuestion ? "Editar pregunta" : "Nueva pregunta"}</span>
                    <input
                      value={question.texto}
                      onChange={(event) => setQuestion((current) => ({ ...current, texto: event.target.value }))}
                      placeholder="Ej. Verificar que el cable no tenga cortes"
                    />
                  </label>
                  <label className="field" style={{ maxWidth: 150 }}>
                    <span>Orden</span>
                    <input
                      type="number"
                      min="1"
                      value={question.orden}
                      onChange={(event) => setQuestion((current) => ({ ...current, orden: Number(event.target.value) }))}
                    />
                  </label>
                </div>
                <div className="flex-row">
                  <button className="button button-primary" disabled={questionMutation.isPending}>
                    <Plus size={18} />{editingQuestion ? "Actualizar" : "Agregar pregunta"}
                  </button>
                  {editingQuestion && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setEditingQuestion(null);
                        setQuestion({ plantilla: selected.id, texto: "", orden: selected.criterios.length + 1 });
                      }}
                    >
                      <X size={18} />Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="table-scroll">
                <table className="tabla-detalle-mobile">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Orden</th>
                      <th>Pregunta</th>
                      <th style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.criterios.length === 0 && (
                      <tr><td colSpan={3} className="empty-row">Aún no hay preguntas. Agrega la primera para activar este formulario.</td></tr>
                    )}
                    {selected.criterios.map((item) => (
                      <tr key={item.id}>
                        <td className="text-muted-sm">{item.orden}</td>
                        <td className="text-base">{item.texto}</td>
                        <td>
                          <div className="flex-row">
                            <button
                              type="button"
                              className="button button-sm button-secondary"
                              aria-label={`Editar pregunta ${item.orden}`}
                              onClick={() => openQuestionEdit(item)}
                            >
                              <PencilSimple size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-button-danger"
                              aria-label={`Eliminar pregunta ${item.orden}`}
                              onClick={() => { if (window.confirm("¿Eliminar esta pregunta?")) removeQuestion.mutate(item.id); }}
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-center-empty">Selecciona o crea un formulario para administrar sus preguntas.</p>
          )}
        </div>
      </div>
    </section>
  );
}