import { ArrowDown, ArrowUp, ClipboardText, PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createCriterio,
  createPlantillaCriterio,
  deleteCriterio,
  deletePlantillaCriterio,
  listPlantillasCriterios,
  reordenarCriterios,
  updateCriterio,
  updatePlantillaCriterio,
} from "@/modules/almacen/inspeccionRepository";
import type { Criterio, PlantillaCriterio } from "@/modules/almacen/types";

export function GestionPlantillasPage() {
  const queryClient = useQueryClient();
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<number | null>(null);

  // Estados Plantilla
  const [editPlantilla, setEditPlantilla] = useState<PlantillaCriterio | null>(null);
  const [plantillaNombre, setPlantillaNombre] = useState("");
  const [plantillaError, setPlantillaError] = useState("");

  // Estados Criterio
  const [editCriterio, setEditCriterio] = useState<Criterio | null>(null);
  const [criterioTexto, setCriterioTexto] = useState("");
  const [criterioError, setCriterioError] = useState("");

  // Query
  const { data: plantillas = [], isLoading } = useQuery({
    queryKey: ["plantillas-criterios"],
    queryFn: listPlantillasCriterios,
  });

  const selectedPlantilla = plantillas.find((p) => p.id === selectedPlantillaId) || plantillas[0];

  // Mutaciones Plantilla
  const plantillaMut = useMutation({
    mutationFn: async () => {
      setPlantillaError("");
      if (!plantillaNombre.trim()) {
        throw new Error("El nombre de la plantilla es obligatorio.");
      }
      if (editPlantilla) {
        return updatePlantillaCriterio(editPlantilla.id, plantillaNombre.trim());
      }
      return createPlantillaCriterio(plantillaNombre.trim());
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["plantillas-criterios"] });
      if (!editPlantilla && res?.id) {
        setSelectedPlantillaId(res.id);
      }
      resetPlantillaForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || "Error al guardar plantilla.";
      setPlantillaError(msg);
    },
  });

  const delPlantillaMut = useMutation({
    mutationFn: (id: number) => deletePlantillaCriterio(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["plantillas-criterios"] });
      if (selectedPlantillaId === deletedId) setSelectedPlantillaId(null);
      resetPlantillaForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "No se puede eliminar la plantilla si contiene inspecciones asociadas o está asignada a una subcategoría.";
      setPlantillaError(msg);
    },
  });

  // Mutaciones Criterio
  const criterioMut = useMutation({
    mutationFn: async () => {
      setCriterioError("");
      const currentPlantilla = selectedPlantilla;
      if (!currentPlantilla) throw new Error("Selecciona una plantilla primero.");
      if (!criterioTexto.trim()) throw new Error("El texto del criterio es obligatorio.");

      if (editCriterio) {
        return updateCriterio(editCriterio.id, { texto: criterioTexto.trim() });
      }
      const nuevoOrden = (currentPlantilla.criterios?.length || 0) + 1;
      return createCriterio({
        plantilla: currentPlantilla.id,
        texto: criterioTexto.trim(),
        orden: nuevoOrden,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plantillas-criterios"] });
      resetCriterioForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || "Error al guardar criterio.";
      setCriterioError(msg);
    },
  });

  const delCriterioMut = useMutation({
    mutationFn: (id: number) => deleteCriterio(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plantillas-criterios"] }),
    onError: (err: any) => setCriterioError(err.response?.data?.detail || "Error al eliminar criterio."),
  });

  const moveCriterio = async (index: number, direction: "up" | "down") => {
    if (!selectedPlantilla || !selectedPlantilla.criterios) return;
    const items = [...selectedPlantilla.criterios];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    // Reassign orden (1-based)
    const payload = items.map((item, idx) => ({ id: item.id, orden: idx + 1 }));
    try {
      await reordenarCriterios(payload);
      queryClient.invalidateQueries({ queryKey: ["plantillas-criterios"] });
    } catch {
      setCriterioError("No se pudo guardar el nuevo orden.");
    }
  };

  function resetPlantillaForm() {
    setEditPlantilla(null);
    setPlantillaNombre("");
    setPlantillaError("");
  }

  function resetCriterioForm() {
    setEditCriterio(null);
    setCriterioTexto("");
    setCriterioError("");
  }

  function handleEditPlantilla(p: PlantillaCriterio) {
    setEditPlantilla(p);
    setPlantillaNombre(p.nombre);
    setPlantillaError("");
  }

  function handleEditCriterio(c: Criterio) {
    setEditCriterio(c);
    setCriterioTexto(c.texto);
    setCriterioError("");
  }

  const activePlantilla = selectedPlantilla;
  return (
    <section className="gestion-plantillas">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inspecciones / Plantillas de Criterios</p>
          <h1>Plantillas de Inspección SST</h1>
          <p>Gestiona y reordena los criterios de evaluación binaria (Cumple / No cumple / No aplica).</p>
        </div>
      </div>

      <div className="plantillas-grid">
        {/* Columna Izquierda: Lista y Alta de Plantillas */}
        <div className="data-panel">
          <div className="table-toolbar">
            <div className="flex-row">
              <ClipboardText size={20} style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: 15 }}>Plantillas SST</strong>
            </div>
            {editPlantilla && (
              <button
                type="button"
                onClick={resetPlantillaForm}
                className="button button-sm button-secondary"
              >
                + Nueva
              </button>
            )}
          </div>

          {/* Formulario Plantilla */}
          <div className="form-panel" style={{ margin: "0 16px 16px" }}>
            <label className="field">
              <span>{editPlantilla ? "Editar nombre" : "Nueva plantilla"}</span>
              <input
                type="text"
                placeholder="Nombre (ej. EPP, Escaleras...)"
                value={plantillaNombre}
                onChange={(e) => setPlantillaNombre(e.target.value)}
              />
            </label>
            {plantillaError && (
              <small className="field-error mt-8">
                <WarningCircle size={14} /> {plantillaError}
              </small>
            )}
            <div className="flex-row-end mt-8">
              {editPlantilla && (
                <button
                  type="button"
                  onClick={resetPlantillaForm}
                  className="button button-sm button-secondary"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={() => plantillaMut.mutate()}
                disabled={plantillaMut.isPending}
                className="button button-sm button-primary"
              >
                {plantillaMut.isPending ? "Guardando…" : editPlantilla ? "Guardar" : "+ Crear plantilla"}
              </button>
            </div>
          </div>

          {/* Lista de Plantillas */}
          <div className="checklist-list" style={{ paddingTop: 0 }}>
            {isLoading && <p className="text-muted-sm">Cargando plantillas…</p>}
            {!isLoading && plantillas.length === 0 && (
              <p className="empty-row">Aún no hay plantillas creadas.</p>
            )}
            {plantillas.map((p) => {
              const isSelected = activePlantilla?.id === p.id;
              return (
                <div
                  key={p.id}
                  className="checklist-row"
                  onClick={() => { setSelectedPlantillaId(p.id); resetCriterioForm(); }}
                  style={{
                    gridTemplateColumns: "1fr auto",
                    cursor: "pointer",
                    borderColor: isSelected ? "var(--accent)" : undefined,
                    background: isSelected ? "var(--surface-raised, #f9fafb)" : undefined,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong className="text-base" style={{ display: "block", wordBreak: "break-word" }}>{p.nombre}</strong>
                    <small className="text-muted-sm">{p.criterios?.length || 0} criterios</small>
                  </div>
                  <div className="flex-row" style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEditPlantilla(p); }}
                      className="button button-sm button-secondary"
                      title="Renombrar plantilla"
                      aria-label={`Renombrar ${p.nombre}`}
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar la plantilla '${p.nombre}'?`)) {
                          delPlantillaMut.mutate(p.id);
                        }
                      }}
                      className="icon-button-danger"
                      title="Eliminar plantilla"
                      aria-label={`Eliminar ${p.nombre}`}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Criterios de la Plantilla seleccionada */}
        <div className="data-panel">
          {!activePlantilla ? (
            <p className="text-center-empty">Selecciona una plantilla para ver y editar sus criterios.</p>
          ) : (
            <>
              <div className="table-toolbar">
                <div>
                  <strong style={{ fontSize: 15 }}>{activePlantilla.nombre}</strong>
                  <p className="text-muted-sm" style={{ margin: "2px 0 0" }}>
                    Lista de preguntas/criterios evaluados en esta plantilla ({activePlantilla.criterios?.length || 0})
                  </p>
                </div>
                {editCriterio && (
                  <button
                    type="button"
                    onClick={resetCriterioForm}
                    className="button button-sm button-secondary"
                  >
                    + Nuevo criterio
                  </button>
                )}
              </div>

              {/* Formulario Criterio */}
              <div className="form-panel" style={{ margin: "0 16px 16px" }}>
                <label className="field">
                  <span>{editCriterio ? "Editar criterio" : "Agregar nuevo criterio de inspección"}</span>
                  <div className="criterio-form-row">
                    <input
                      type="text"
                      placeholder="Ej. Estado del casco, Ausencia de grietas..."
                      value={criterioTexto}
                      onChange={(e) => setCriterioTexto(e.target.value)}
                    />
                    <div className="criterio-form-actions">
                      {editCriterio && (
                        <button
                          type="button"
                          onClick={resetCriterioForm}
                          className="button button-secondary"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => criterioMut.mutate()}
                        disabled={criterioMut.isPending}
                        className="button button-primary"
                      >
                        <Plus size={16} />
                        {criterioMut.isPending ? "Guardando…" : editCriterio ? "Guardar" : "Agregar criterio"}
                      </button>
                    </div>
                  </div>
                </label>
                {criterioError && (
                  <small className="field-error mt-8">
                    <WarningCircle size={14} /> {criterioError}
                  </small>
                )}
              </div>

              {/* Lista de Criterios — Versión Desktop */}
              <div className="table-scroll">
                <table className="criterios-desktop-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Orden</th>
                      <th>Texto del criterio</th>
                      <th style={{ width: 100, textAlign: "center" }}>Reordenar</th>
                      <th style={{ width: 80, textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activePlantilla.criterios || []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="empty-row">Esta plantilla no contiene criterios asignados aún.</td>
                      </tr>
                    )}
                    {(activePlantilla.criterios || []).map((c, index) => (
                      <tr key={c.id}>
                        <td className="text-muted-sm" style={{ fontWeight: 600 }}>#{c.orden || index + 1}</td>
                        <td className="text-base" style={{ wordBreak: "break-word" }}>{c.texto}</td>
                        <td style={{ textAlign: "center" }}>
                          <div className="flex-row" style={{ justifyContent: "center" }}>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveCriterio(index, "up")}
                              className="button button-sm button-secondary"
                              title="Subir"
                              aria-label={`Subir criterio ${c.orden || index + 1}`}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={index === (activePlantilla.criterios.length - 1)}
                              onClick={() => moveCriterio(index, "down")}
                              className="button button-sm button-secondary"
                              title="Bajar"
                              aria-label={`Bajar criterio ${c.orden || index + 1}`}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="flex-row-end">
                            <button
                              type="button"
                              onClick={() => handleEditCriterio(c)}
                              className="button button-sm button-secondary"
                              title="Editar criterio"
                              aria-label={`Editar criterio ${c.texto}`}
                            >
                              <PencilSimple size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Eliminar criterio '${c.texto}'?`)) {
                                  delCriterioMut.mutate(c.id);
                                }
                              }}
                              className="icon-button-danger"
                              title="Eliminar criterio"
                              aria-label={`Eliminar criterio ${c.texto}`}
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

              {/* Lista de Criterios — Versión Mobile Cards */}
              <div className="criterios-mobile-list">
                {(activePlantilla.criterios || []).length === 0 && (
                  <p className="empty-row">Esta plantilla no contiene criterios asignados aún.</p>
                )}
                {(activePlantilla.criterios || []).map((c, index) => (
                  <div key={c.id} className="criterio-card">
                    <div className="criterio-card-header">
                      <span className="criterio-card-badge">#{c.orden || index + 1}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveCriterio(index, "up")}
                          className="button button-sm button-secondary"
                          title="Subir"
                          aria-label={`Subir criterio ${c.orden || index + 1}`}
                          style={{ padding: "4px 8px" }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={index === (activePlantilla.criterios.length - 1)}
                          onClick={() => moveCriterio(index, "down")}
                          className="button button-sm button-secondary"
                          title="Bajar"
                          aria-label={`Bajar criterio ${c.orden || index + 1}`}
                          style={{ padding: "4px 8px" }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditCriterio(c)}
                          className="button button-sm button-secondary"
                          title="Editar criterio"
                          aria-label={`Editar criterio ${c.texto}`}
                          style={{ padding: "4px 8px" }}
                        >
                          <PencilSimple size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar criterio '${c.texto}'?`)) {
                              delCriterioMut.mutate(c.id);
                            }
                          }}
                          className="icon-button-danger"
                          title="Eliminar criterio"
                          aria-label={`Eliminar criterio ${c.texto}`}
                          style={{ padding: "4px 8px" }}
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="criterio-card-text">{c.texto}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}