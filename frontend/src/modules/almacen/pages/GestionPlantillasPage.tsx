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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plantillas-criterios"] });
      if (selectedPlantillaId === editPlantilla?.id) setSelectedPlantillaId(null);
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
    <section className="gestion-plantillas-page">
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Inspecciones / Plantillas de Criterios</p>
          <h1>Plantillas de Inspección SST</h1>
          <p>Gestiona y reordena los criterios de evaluación binaria (Cumple / No cumple / No aplica).</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, marginTop: 16 }}>
        {/* Columna Izquierda: Lista y Alta de Plantillas */}
        <aside className="data-panel" style={{ padding: 16 }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardText size={20} style={{ color: "var(--accent, #6366f1)" }} />
              <strong style={{ fontSize: 15 }}>Plantillas SST</strong>
            </div>
            {editPlantilla && (
              <button
                type="button"
                onClick={resetPlantillaForm}
                style={{ fontSize: 12, color: "var(--accent)", background: "none", border: 0, cursor: "pointer" }}
              >
                + Nueva
              </button>
            )}
          </header>

          {/* Formulario Plantilla */}
          <div
            style={{
              background: "var(--surface-raised, #f9fafb)",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border, #e5e7eb)",
              marginBottom: 16,
            }}
          >
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              {editPlantilla ? "Editar Nombre" : "Nueva Plantilla"}
            </label>
            <input
              type="text"
              placeholder="Nombre (ej. EPP, Escaleras...)"
              value={plantillaNombre}
              onChange={(e) => setPlantillaNombre(e.target.value)}
              style={{ fontSize: 13, width: "100%", marginBottom: 8 }}
            />
            {plantillaError && (
              <p style={{ fontSize: 12, color: "var(--error, #dc2626)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <WarningCircle size={14} /> {plantillaError}
              </p>
            )}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {editPlantilla && (
                <button
                  type="button"
                  onClick={resetPlantillaForm}
                  className="button button-secondary"
                  style={{ fontSize: 12, padding: "4px 8px" }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={() => plantillaMut.mutate()}
                disabled={plantillaMut.isPending}
                className="button button-primary"
                style={{ fontSize: 12, padding: "4px 12px" }}
              >
                {plantillaMut.isPending ? "Guardando..." : editPlantilla ? "Guardar" : "+ Crear plantilla"}
              </button>
            </div>
          </div>

          {/* Lista de Plantillas */}
          <div style={{ display: "grid", gap: 6 }}>
            {isLoading && <p style={{ fontSize: 13, color: "var(--muted)" }}>Cargando plantillas...</p>}
            {plantillas.map((p) => {
              const isSelected = activePlantilla?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => { setSelectedPlantillaId(p.id); resetCriterioForm(); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: isSelected ? "2px solid var(--accent, #6366f1)" : "1px solid var(--border, #e5e7eb)",
                    background: isSelected ? "rgba(99, 102, 241, 0.06)" : "var(--surface, #fff)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <strong style={{ display: "block" }}>{p.nombre}</strong>
                    <small style={{ color: "var(--muted)" }}>{p.criterios?.length || 0} criterios</small>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEditPlantilla(p); }}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 4 }}
                      title="Renombrar plantilla"
                    >
                      <PencilSimple size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar la plantilla '${p.nombre}'?`)) {
                          delPlantillaMut.mutate(p.id);
                        }
                      }}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "var(--error, #dc2626)", padding: 4 }}
                      title="Eliminar plantilla"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Columna Derecha: Criterios de la Plantilla seleccionada */}
        <section className="data-panel" style={{ padding: 20 }}>
          {!activePlantilla ? (
            <p style={{ color: "var(--muted)" }}>Selecciona una plantilla para ver y editar sus criterios.</p>
          ) : (
            <>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, margin: 0 }}>{activePlantilla.nombre}</h2>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    Lista de preguntas/criterios evaluados en esta plantilla
                  </p>
                </div>
                {editCriterio && (
                  <button
                    type="button"
                    onClick={resetCriterioForm}
                    className="button button-secondary"
                    style={{ fontSize: 12 }}
                  >
                    + Nuevo Criterio
                  </button>
                )}
              </header>

              {/* Formulario Criterio */}
              <div
                style={{
                  background: "var(--surface-raised, #f9fafb)",
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border, #e5e7eb)",
                  marginBottom: 16,
                }}
              >
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {editCriterio ? "Editar Criterio" : "Agregar Nuevo Criterio de Inspección"}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Ej. Estado del casco, Ausencia de grietas..."
                    value={criterioTexto}
                    onChange={(e) => setCriterioTexto(e.target.value)}
                    style={{ fontSize: 13, flex: 1 }}
                  />
                  {editCriterio && (
                    <button
                      type="button"
                      onClick={resetCriterioForm}
                      className="button button-secondary"
                      style={{ fontSize: 13 }}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => criterioMut.mutate()}
                    disabled={criterioMut.isPending}
                    className="button button-primary"
                    style={{ fontSize: 13 }}
                  >
                    <Plus size={16} />
                    {criterioMut.isPending ? "Guardando..." : editCriterio ? "Guardar" : "Agregar Criterio"}
                  </button>
                </div>
                {criterioError && (
                  <p style={{ fontSize: 12, color: "var(--error, #dc2626)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <WarningCircle size={14} /> {criterioError}
                  </p>
                )}
              </div>

              {/* Lista de Criterios */}
              <div className="table-scroll">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px", width: 60 }}>Orden</th>
                      <th style={{ padding: "8px 12px" }}>Texto del Criterio</th>
                      <th style={{ padding: "8px 12px", width: 100, textAlign: "center" }}>Reordenar</th>
                      <th style={{ padding: "8px 12px", width: 80, textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activePlantilla.criterios || []).map((c, index) => (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid var(--border, #f3f4f6)",
                          background: index % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)",
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--muted)" }}>
                          #{c.orden || index + 1}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 14 }}>{c.texto}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 4 }}>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveCriterio(index, "up")}
                              style={{
                                background: "none",
                                border: "1px solid var(--border, #e5e7eb)",
                                borderRadius: 4,
                                padding: "2px 6px",
                                cursor: index === 0 ? "not-allowed" : "pointer",
                                opacity: index === 0 ? 0.3 : 1,
                              }}
                              title="Subir"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={index === (activePlantilla.criterios.length - 1)}
                              onClick={() => moveCriterio(index, "down")}
                              style={{
                                background: "none",
                                border: "1px solid var(--border, #e5e7eb)",
                                borderRadius: 4,
                                padding: "2px 6px",
                                cursor: index === (activePlantilla.criterios.length - 1) ? "not-allowed" : "pointer",
                                opacity: index === (activePlantilla.criterios.length - 1) ? 0.3 : 1,
                              }}
                              title="Bajar"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => handleEditCriterio(c)}
                              style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)" }}
                              title="Editar criterio"
                            >
                              <PencilSimple size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Eliminar criterio '${c.texto}'?`)) {
                                  delCriterioMut.mutate(c.id);
                                }
                              }}
                              style={{ background: "none", border: 0, cursor: "pointer", color: "var(--error, #dc2626)" }}
                              title="Eliminar criterio"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(activePlantilla.criterios || []).length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                          Esta plantilla no contiene criterios asignados aún.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
