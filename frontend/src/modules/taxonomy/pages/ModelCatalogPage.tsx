import {
  ArrowLeft,
  Barcode,
  CheckCircle,
  Plus,
  Trash,
  WarningCircle,
  PencilSimple,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import { useModelList, useCreateModel, useUpdateModel, useDeleteModel } from "../modelQueries";
import type { AssetModel } from "../modelRepository";

export function ModelCatalogPage() {
  const { data: models = [], isLoading } = useModelList();
  const createModelMutation = useCreateModel();
  const updateModelMutation = useUpdateModel("");
  const deleteModelMutation = useDeleteModel();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AssetModel | null>(null);
  
  const [formData, setFormData] = useState({ name: "", brand: "", isActive: true });

  const handleOpenNew = () => {
    setEditingModel(null);
    setFormData({ name: "", brand: "", isActive: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (model: AssetModel) => {
    setEditingModel(model);
    setFormData({ name: model.name, brand: model.brand, isActive: model.isActive });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingModel) {
      await updateModelMutation.mutateAsync({ ...formData, id: editingModel.id });
    } else {
      await createModelMutation.mutateAsync(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Está seguro que desea eliminar este modelo?")) {
      await deleteModelMutation.mutateAsync(id);
    }
  };

  return (
    <div className="taxonomy-layout">
      <header className="page-heading">
        <Link to="/administracion" className="back-link">
          <ArrowLeft size={18} />
          <span>Volver a Administración</span>
        </Link>
        <h1>Modelos de Bienes</h1>
        <p>Gestiona el catálogo de marcas y modelos disponibles para los bienes.</p>
      </header>

      <div className="taxonomy-container">
        <TaxonomySectionNav />

        <main className="taxonomy-main">
          <header className="taxonomy-toolbar">
            <h2 className="taxonomy-toolbar-title">Modelos Registrados</h2>
            <button className="button button-primary" onClick={handleOpenNew}>
              <Plus size={18} weight="bold" />
              <span>Nuevo modelo</span>
            </button>
          </header>

          <div className="data-panel">
            {isLoading ? (
              <div className="table-loading">Cargando modelos...</div>
            ) : models.length === 0 ? (
              <div className="table-empty">
                <Barcode size={32} />
                <p>No hay modelos registrados en el catálogo.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Estado</th>
                      <th className="action-cell">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.id}>
                        <td>{model.brand}</td>
                        <td>
                          <strong>{model.name}</strong>
                        </td>
                        <td>
                          {model.isActive ? (
                            <span className="status-badge status-success">
                              <CheckCircle size={14} weight="fill" />
                              Activo
                            </span>
                          ) : (
                            <span className="status-badge status-neutral">
                              <WarningCircle size={14} weight="fill" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="action-cell">
                          <button
                            className="icon-button"
                            onClick={() => handleOpenEdit(model)}
                            title="Editar"
                          >
                            <PencilSimple size={18} />
                          </button>
                          <button
                            className="icon-button"
                            onClick={() => handleDelete(model.id)}
                            style={{ color: "var(--error)" }}
                            title="Eliminar"
                          >
                            <Trash size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {isModalOpen && (
        <dialog open className="modal-backdrop" style={{ display: "grid", placeItems: "center", background: "rgba(0,0,0,0.5)", position: "fixed", inset: 0, zIndex: 100 }}>
          <form className="modal-content form-panel" onSubmit={handleSave} style={{ minWidth: 400, padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>{editingModel ? "Editar Modelo" : "Nuevo Modelo"}</h2>
            
            <div className="field-group" style={{ marginBottom: 16 }}>
              <label>Marca</label>
              <input 
                type="text" 
                value={formData.brand} 
                onChange={(e) => setFormData({...formData, brand: e.target.value})} 
                required 
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            
            <div className="field-group" style={{ marginBottom: 16 }}>
              <label>Modelo</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                required 
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            
            <div className="field-group" style={{ marginBottom: 24 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input 
                  type="checkbox" 
                  checked={formData.isActive} 
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})} 
                />
                Activo (disponible para selección)
              </label>
            </div>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="button" className="button" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="submit" className="button button-primary">Guardar</button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
