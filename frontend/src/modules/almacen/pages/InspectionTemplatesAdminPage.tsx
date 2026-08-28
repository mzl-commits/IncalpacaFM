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
    <section className="inspection-templates-admin">

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

      <div className="templates-grid">
        {/* ── Lista de formularios ───────────────────────────────────────── */}
        <div className="data-panel">
          <div className="table-toolbar">
            <strong className="text-md">Formularios</strong>
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); templateMutation.mutate(); }}
          >
            <label className="field">
              <span>{editingTemplate ? "Editar nombre" : "Nuevo formulario"}</span>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Ej. Inspección de herramientas"
              />
            </label>
            <div>
              <button
                type="submit"
                className="button button-primary"
                disabled={templateMutation.isPending}
              >
                <FloppyDisk size={16} />
                {editingTemplate ? "Guardar" : "Crear"}
              </button>
              {editingTemplate && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => { setEditingTemplate(null); setTemplateName(""); }}
                >
                  <X size={16} /> Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="grid-gap-6" style={{ padding: "0 16px 16px" }}>
            {isLoading && <span className="text-muted-sm">Cargando formularios…</span>}
            {templates.map((template) => {
              const activo = selectedId === template.id;
              return (
                <div
                  key={template.id}
                  className={`template-item ${activo ? "is-active" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(template.id);
                      setQuestion({
                        plantilla: template.id,
                        texto: "",
                        orden: template.criterios.length + 1,
                      });
                      setEditingQuestion(null);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{template.nombre}</strong>
                    <small style={{ display: "block", marginTop: 2, color: "var(--muted)" }}>
                      {template.criterios.length} pregunta(s)
                    </small>
                  </button>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      onClick={() => openTemplateEdit(template)}
                    >
                      <PencilSimple size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el formulario “${template.nombre}”?`)) {
                          removeTemplate.mutate(template.id);
                        }
                      }}
                    >
                      <Trash size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Preguntas del formulario seleccionado ──────────────────────── */}
        <div className="data-panel">
          {selected ? (
            <>
              <div className="table-toolbar">
                <div>
                  <strong style={{ fontSize: 15 }}>{selected.nombre}</strong>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                    Preguntas del formulario
                  </p>
                </div>
                <span className="badge badge-secondary">
                  {selected.criterios.length} pregunta(s)
                </span>
              </div>

              <form
                onSubmit={(event) => { event.preventDefault(); questionMutation.mutate(); }}
                style={{ padding: "0 16px 16px", display: "grid", gap: 10, borderBottom: "1px solid var(--border)" }}
              >
                <label className="field">
                  <span>{editingQuestion ? "Editar pregunta" : "Nueva pregunta"}</span>
                  <input
                    value={question.texto}
                    onChange={(event) => setQuestion((current) => ({ ...current, texto: event.target.value }))}
                    placeholder="Ej. Verificar aislamiento del cable"
                  />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={questionMutation.isPending}
                  >
                    <Plus size={16} />
                    {editingQuestion ? "Actualizar" : "Agregar pregunta"}
                  </button>
                  {editingQuestion && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setEditingQuestion(null);
                        setQuestion({
                          plantilla: selected.id,
                          texto: "",
                          orden: selected.criterios.length + 1,
                        });
                      }}
                    >
                      <X size={16} /> Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div style={{ padding: 16 }}>
                {selected.criterios.length === 0 ? (
                  <p className="text-center-empty">
                    Aún no hay preguntas. Agrega la primera arriba.
                  </p>
                ) : (
                  <ol style={{ display: "grid", gap: 8, margin: 0, paddingLeft: 20 }}>
                    {selected.criterios.map((item) => (
                      <li key={item.id} className="question-item">
                        <div className="question-content">
                          <span className="question-text">{item.texto}</span>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="icon-button"
                              title="Editar"
                              onClick={() => openQuestionEdit(item)}
                            >
                              <PencilSimple size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              title="Eliminar"
                              onClick={() => {
                                if (window.confirm("¿Eliminar esta pregunta?")) {
                                  removeQuestion.mutate(item.id);
                                }
                              }}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
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
