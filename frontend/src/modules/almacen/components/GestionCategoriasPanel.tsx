import { FolderPlus, PencilSimple, Plus, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createCategoria,
  createSubcategoria,
  deleteCategoria,
  deleteSubcategoria,
  listCategorias,
  listSubcategorias,
  updateCategoria,
  updateSubcategoria,
} from "@/modules/almacen/catalogoRepository";
import { listPlantillasCriterios } from "@/modules/almacen/inspeccionRepository";
import type { Categoria, Subcategoria } from "@/modules/almacen/types";

interface Props {
  onClose: () => void;
}

export function GestionCategoriasPanel({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  // Form states Categoría
  const [editCat, setEditCat] = useState<Categoria | null>(null);
  const [catNombre, setCatNombre] = useState("");
  const [catPrefijo, setCatPrefijo] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catError, setCatError] = useState("");

  // Form states Subcategoría
  const [editSub, setEditSub] = useState<Subcategoria | null>(null);
  const [subNombre, setSubNombre] = useState("");
  const [subPlantilla, setSubPlantilla] = useState<number | undefined>(undefined);
  const [subError, setSubError] = useState("");

  // Queries
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: listCategorias,
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", selectedCatId],
    queryFn: () => listSubcategorias(selectedCatId ?? undefined),
    enabled: selectedCatId !== null,
  });

  const { data: plantillas = [] } = useQuery({
    queryKey: ["plantillas-criterios"],
    queryFn: listPlantillasCriterios,
  });

  // Mutaciones Categoría
  const catMut = useMutation({
    mutationFn: async () => {
      setCatError("");
      if (!catNombre.trim() || !catPrefijo.trim()) {
        throw new Error("Nombre y prefijo son obligatorios.");
      }
      if (editCat) {
        return updateCategoria(editCat.id, {
          nombre: catNombre.trim(),
          prefijo: catPrefijo.trim().toUpperCase(),
          descripcion: catDesc.trim(),
        });
      }
      return createCategoria({
        nombre: catNombre.trim(),
        prefijo: catPrefijo.trim().toUpperCase(),
        descripcion: catDesc.trim(),
        activo: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      resetCatForm();
    },
    onError: (err: Error) => setCatError(err.message || "Error al guardar categoría."),
  });

  const delCatMut = useMutation({
    mutationFn: (id: number) => deleteCategoria(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      if (selectedCatId === editCat?.id) setSelectedCatId(null);
    },
    onError: (err: Error) => setCatError("No se puede eliminar la categoría si contiene subcategorías o materiales."),
  });

  // Mutaciones Subcategoría
  const subMut = useMutation({
    mutationFn: async () => {
      setSubError("");
      if (!selectedCatId) throw new Error("Selecciona una categoría primero.");
      if (!subNombre.trim()) throw new Error("El nombre de la subcategoría es obligatorio.");

      if (editSub) {
        return updateSubcategoria(editSub.id, {
          nombre: subNombre.trim(),
          plantilla_inspeccion: subPlantilla || null,
        });
      }
      return createSubcategoria({
        categoria: selectedCatId,
        nombre: subNombre.trim(),
        plantilla_inspeccion: subPlantilla || null,
        activo: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategorias"] });
      resetSubForm();
    },
    onError: (err: Error) => setSubError(err.message || "Error al guardar subcategoría."),
  });

  const delSubMut = useMutation({
    mutationFn: (id: number) => deleteSubcategoria(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subcategorias"] }),
    onError: () => setSubError("No se puede eliminar la subcategoría si tiene materiales asociados."),
  });

  function resetCatForm() {
    setEditCat(null);
    setCatNombre("");
    setCatPrefijo("");
    setCatDesc("");
    setCatError("");
  }

  function resetSubForm() {
    setEditSub(null);
    setSubNombre("");
    setSubPlantilla(undefined);
    setSubError("");
  }

  function handleEditCat(c: Categoria) {
    setEditCat(c);
    setCatNombre(c.nombre);
    setCatPrefijo(c.prefijo);
    setCatDesc(c.descripcion || "");
    setCatError("");
  }

  function handleEditSub(s: Subcategoria) {
    setEditSub(s);
    setSubNombre(s.nombre);
    setSubPlantilla(s.plantilla_inspeccion || undefined);
    setSubError("");
  }

  return (
    <div
      style={{
        background: "var(--surface, #fff)",
        borderRadius: 12,
        border: "1px solid var(--border, #e5e7eb)",
        padding: 20,
        marginBottom: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FolderPlus size={20} style={{ color: "var(--accent, #6366f1)" }} />
          <strong style={{ fontSize: 16 }}>Gestión de Categorías y Subcategorías</strong>
        </div>
        <button type="button" onClick={onClose} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Columna 1: Categorías */}
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Categorías</span>
            {editCat && (
              <button type="button" onClick={resetCatForm} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: 0, cursor: "pointer" }}>
                + Nueva
              </button>
            )}
          </h3>

          {/* Form Categoría */}
          <div style={{ background: "var(--surface-raised, #f9fafb)", padding: 12, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Nombre (ej. Herramientas)"
                value={catNombre}
                onChange={(e) => setCatNombre(e.target.value)}
                style={{ fontSize: 13 }}
              />
              <input
                type="text"
                placeholder="Prefijo (H)"
                maxLength={3}
                value={catPrefijo}
                onChange={(e) => setCatPrefijo(e.target.value)}
                style={{ fontSize: 13, textTransform: "uppercase" }}
              />
            </div>
            <input
              type="text"
              placeholder="Descripción corta (opcional)"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              style={{ fontSize: 13, width: "100%", marginBottom: 8 }}
            />
            {catError && (
              <p style={{ fontSize: 12, color: "var(--error, #dc2626)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <WarningCircle size={14} /> {catError}
              </p>
            )}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {editCat && (
                <button type="button" onClick={resetCatForm} className="button button-secondary" style={{ fontSize: 12, padding: "4px 8px" }}>
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={() => catMut.mutate()}
                disabled={catMut.isPending}
                className="button button-primary"
                style={{ fontSize: 12, padding: "4px 12px" }}
              >
                {catMut.isPending ? "Guardando…" : editCat ? "Guardar cambios" : "+ Crear categoría"}
              </button>
            </div>
          </div>

          {/* Lista Categorías */}
          <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {categorias.map((c) => {
              const isSelected = selectedCatId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCatId(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: isSelected ? "1px solid var(--accent, #6366f1)" : "1px solid var(--border, #e5e7eb)",
                    background: isSelected ? "rgba(99, 102, 241, 0.05)" : "var(--surface, #fff)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <strong>{c.nombre}</strong> <code style={{ fontSize: 11, color: "var(--muted)" }}>({c.prefijo})</code>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEditCat(c); }}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 2 }}
                      title="Editar"
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar categoría '${c.nombre}'?`)) delCatMut.mutate(c.id); }}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "var(--error, #dc2626)", padding: 2 }}
                      title="Eliminar"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna 2: Subcategorías de la categoría seleccionada */}
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              Subcategorías {selectedCatId ? `(${categorias.find((c) => c.id === selectedCatId)?.nombre})` : ""}
            </span>
            {editSub && (
              <button type="button" onClick={resetSubForm} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: 0, cursor: "pointer" }}>
                + Nueva
              </button>
            )}
          </h3>

          {!selectedCatId ? (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
              ? Selecciona una categoría a la izquierda para administrar sus subcategorías.
            </p>
          ) : (
            <>
              {/* Form Subcategoría */}
              <div style={{ background: "var(--surface-raised, #f9fafb)", padding: 12, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Nombre subcategoría (ej. Manuales)"
                  value={subNombre}
                  onChange={(e) => setSubNombre(e.target.value)}
                  style={{ fontSize: 13, width: "100%", marginBottom: 8 }}
                />
                <select
                  value={subPlantilla || ""}
                  onChange={(e) => setSubPlantilla(e.target.value ? Number(e.target.value) : undefined)}
                  style={{ fontSize: 13, width: "100%", marginBottom: 8 }}
                >
                  <option value="">Sin plantilla de inspección</option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      Plantilla SST: {p.nombre}
                    </option>
                  ))}
                </select>

                {subError && (
                  <p style={{ fontSize: 12, color: "var(--error, #dc2626)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <WarningCircle size={14} /> {subError}
                  </p>
                )}

                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {editSub && (
                    <button type="button" onClick={resetSubForm} className="button button-secondary" style={{ fontSize: 12, padding: "4px 8px" }}>
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => subMut.mutate()}
                    disabled={subMut.isPending}
                    className="button button-primary"
                    style={{ fontSize: 12, padding: "4px 12px" }}
                  >
                    {subMut.isPending ? "Guardando…" : editSub ? "Guardar cambios" : "+ Crear subcategoría"}
                  </button>
                </div>
              </div>

              {/* Lista Subcategorías */}
              <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {subcategorias.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border, #e5e7eb)",
                      background: "var(--surface, #fff)",
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <strong>{s.nombre}</strong>
                      {s.plantilla_inspeccion_nombre && (
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          ?? {s.plantilla_inspeccion_nombre}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleEditSub(s)}
                        style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 2 }}
                        title="Editar"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`¿Eliminar subcategoría '${s.nombre}'?`)) delSubMut.mutate(s.id); }}
                        style={{ background: "none", border: 0, cursor: "pointer", color: "var(--error, #dc2626)", padding: 2 }}
                        title="Eliminar"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {subcategorias.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                    Sin subcategorías en esta categoría.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
