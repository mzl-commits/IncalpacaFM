import { useEffect, useState } from "react";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import type { Categoria, Subcategoria } from "@/modules/almacen/types";
import {
  listCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  listSubcategorias,
  createSubcategoria,
  updateSubcategoria,
  deleteSubcategoria,
} from "@/modules/almacen/catalogoRepository";

interface Props {
  /** Se llama después de crear/editar/eliminar, para que el formulario padre
   * pueda refrescar sus listas de categorías/subcategorías. */
  onChange?: () => void;
}

type Tab = "categorias" | "subcategorias";

export function CategoriaSubcategoriaManager({ onChange }: Props) {
  const { almacenId } = useAlmacenActivo();
  const [tab, setTab] = useState<Tab>("categorias");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!almacenId) return;
    setLoading(true);
    setError(null);
    try {
      const [cats, subs] = await Promise.all([
        listCategorias(almacenId),
        listSubcategorias(almacenId),
      ]);
      setCategorias(cats);
      setSubcategorias(subs);
    } catch {
      setError("No se pudo cargar el catálogo. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [almacenId]);

  function notifyChange() {
    reload();
    onChange?.();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={tab === "categorias" ? "button button-primary" : "button button-secondary"}
          onClick={() => setTab("categorias")}
        >
          Categorías
        </button>
        <button
          type="button"
          className={tab === "subcategorias" ? "button button-primary" : "button button-secondary"}
          onClick={() => setTab("subcategorias")}
        >
          Subcategorías
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : tab === "categorias" ? (
        <CategoriasTab categorias={categorias} almacenId={almacenId} onChange={notifyChange} />
      ) : (
        <SubcategoriasTab
          categorias={categorias}
          subcategorias={subcategorias}
          onChange={notifyChange}
        />
      )}
    </div>
  );
}

// ─── Categorías ───────────────────────────────────────────────────────────────

function CategoriasTab({
  categorias,
  almacenId,
  onChange,
}: {
  categorias: Categoria[];
  almacenId: number;
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [requiereInspeccion, setRequiereInspeccion] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function startCreate() {
    setEditingId(0); // 0 = modo creación
    setNombre("");
    setPrefijo("");
    setDescripcion("");
    setRequiereInspeccion(true);
    setFormError(null);
  }

  function startEdit(cat: Categoria) {
    setEditingId(cat.id);
    setNombre(cat.nombre);
    setPrefijo(cat.prefijo ?? "");
    setDescripcion(cat.descripcion ?? "");
    setRequiereInspeccion(cat.requiere_inspeccion);
    setFormError(null);
  }

  function cancel() {
    setEditingId(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!nombre.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId === 0) {
        await createCategoria({
          almacen: almacenId,
          nombre,
          prefijo,
          descripcion,
          activo: true,
          requiere_inspeccion: requiereInspeccion,
        });
      } else if (editingId) {
        await updateCategoria(editingId, { nombre, prefijo, descripcion, requiere_inspeccion: requiereInspeccion });
      }
      setEditingId(null);
      onChange();
    } catch {
      setFormError("No se pudo guardar. Revisa que el nombre/prefijo no esté repetido.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Categoria) {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Esto puede fallar si tiene subcategorías asociadas.`)) {
      return;
    }
    try {
      await deleteCategoria(cat.id);
      onChange();
    } catch {
      alert("No se pudo eliminar. Probablemente tiene subcategorías o materiales asociados.");
    }
  }

  return (
    <div>
      {editingId !== null ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>
            {editingId === 0 ? "Nueva categoría" : "Editar categoría"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label>
              Nombre *
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Prefijo (ej: HER, EPP)
              <input
                type="text"
                value={prefijo}
                onChange={(e) => setPrefijo(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Descripción
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
                rows={2}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={requiereInspeccion}
                onChange={(e) => setRequiereInspeccion(e.target.checked)}
              />
              Requiere inspección periódica
            </label>
          </div>
          {formError && <p style={{ color: "#b91c1c" }}>{formError}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="button button-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="button button-secondary" onClick={cancel}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="button button-primary" onClick={startCreate} style={{ marginBottom: 16 }}>
          + Nueva categoría
        </button>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: 8 }}>Nombre</th>
            <th style={{ padding: 8 }}>Prefijo</th>
            <th style={{ padding: 8 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((cat) => (
            <tr key={cat.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: 8 }}>{cat.nombre}</td>
              <td style={{ padding: 8 }}>{cat.prefijo}</td>
              <td style={{ padding: 8, display: "flex", gap: 8 }}>
                <button type="button" className="button button-secondary" onClick={() => startEdit(cat)}>
                  Editar
                </button>
                <button type="button" className="button button-secondary" onClick={() => handleDelete(cat)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {categorias.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 8, color: "#6b7280" }}>
                No hay categorías todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Subcategorías ────────────────────────────────────────────────────────────

function SubcategoriasTab({
  categorias,
  subcategorias,
  onChange,
}: {
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function startCreate() {
    setEditingId(0);
    setNombre("");
    setCategoriaId(categorias[0]?.id ?? "");
    setFormError(null);
  }

  function startEdit(sub: Subcategoria) {
    setEditingId(sub.id);
    setNombre(sub.nombre);
    setCategoriaId(sub.categoria);
    setFormError(null);
  }

  function cancel() {
    setEditingId(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!nombre.trim() || !categoriaId) {
      setFormError("Nombre y categoría son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId === 0) {
        await createSubcategoria({ nombre, categoria: Number(categoriaId), activo: true, plantilla_inspeccion: null });
      } else if (editingId) {
        await updateSubcategoria(editingId, { nombre, categoria: Number(categoriaId) });
      }
      setEditingId(null);
      onChange();
    } catch {
      setFormError("No se pudo guardar. Revisa que el nombre no esté repetido en esa categoría.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sub: Subcategoria) {
    if (!confirm(`¿Eliminar la subcategoría "${sub.nombre}"? Esto puede fallar si tiene materiales asociados.`)) {
      return;
    }
    try {
      await deleteSubcategoria(sub.id);
      onChange();
    } catch {
      alert("No se pudo eliminar. Probablemente tiene materiales asociados.");
    }
  }

  return (
    <div>
      {editingId !== null ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>
            {editingId === 0 ? "Nueva subcategoría" : "Editar subcategoría"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label>
              Categoría *
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(Number(e.target.value))}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              >
                <option value="" disabled>
                  Selecciona una categoría
                </option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre *
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
          </div>
          {formError && <p style={{ color: "#b91c1c" }}>{formError}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="button button-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="button button-secondary" onClick={cancel}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="button button-primary"
          onClick={startCreate}
          style={{ marginBottom: 16 }}
          disabled={categorias.length === 0}
        >
          + Nueva subcategoría
        </button>
      )}
      {categorias.length === 0 && (
        <p style={{ color: "#6b7280" }}>Primero crea al menos una categoría.</p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: 8 }}>Nombre</th>
            <th style={{ padding: 8 }}>Categoría</th>
            <th style={{ padding: 8 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {subcategorias.map((sub) => (
            <tr key={sub.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: 8 }}>{sub.nombre}</td>
              <td style={{ padding: 8 }}>{sub.categoria_nombre}</td>
              <td style={{ padding: 8, display: "flex", gap: 8 }}>
                <button type="button" className="button button-secondary" onClick={() => startEdit(sub)}>
                  Editar
                </button>
                <button type="button" className="button button-secondary" onClick={() => handleDelete(sub)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {subcategorias.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 8, color: "#6b7280" }}>
                No hay subcategorías todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}