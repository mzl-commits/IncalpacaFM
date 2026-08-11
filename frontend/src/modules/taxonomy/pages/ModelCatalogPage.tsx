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
      <header className="page-heading taxonomy-page-heading">
        <Link to="/administracion" className="back-link">
          <ArrowLeft size={18} />
          <span>Volver a Administración</span>
        </Link>
        <div>
          <p className="breadcrumb">Administración / Catálogo</p>
          <h1>Modelos de bienes</h1>
          <p>Administra las marcas y referencias disponibles para registrar activos.</p>
        </div>
      </header>

      <div className="taxonomy-container">
        <TaxonomySectionNav />

        <main className="taxonomy-main">
          <header className="taxonomy-toolbar">
            <div><h2 className="taxonomy-toolbar-title">Modelos registrados</h2><p className="taxonomy-toolbar-caption">{models.length} referencias en el catálogo</p></div>
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
                            <span className="status status-success">
                              <CheckCircle size={14} weight="fill" />
                              Activo
                            </span>
                          ) : (
                            <span className="status status-neutral">
                              <WarningCircle size={14} weight="fill" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="action-cell">
                          <div className="model-row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => handleOpenEdit(model)}
                            aria-label={`Editar ${model.brand} ${model.name}`}
                            title="Editar"
                          >
                            <PencilSimple size={18} />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => handleDelete(model.id)}
                            aria-label={`Eliminar ${model.brand} ${model.name}`}
                            style={{ color: "var(--error)" }}
                            title="Eliminar"
                          >
                            <Trash size={18} />
                          </button>
                          </div>
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
        <dialog open className="taxonomy-model-dialog">
          <form className="modal-content form-panel" onSubmit={handleSave}>
            <h2 style={{ marginTop: 0 }}>{editingModel ? "Editar Modelo" : "Nuevo Modelo"}</h2>
            
            <div className="field-group">
              <label htmlFor="model-brand">Marca</label>
              <input 
                id="model-brand"
                type="text" 
                value={formData.brand} 
                onChange={(e) => setFormData({...formData, brand: e.target.value})} 
                required 
              />
            </div>
            
            <div className="field-group">
              <label htmlFor="model-name">Modelo</label>
              <input 
                id="model-name"
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                required 
              />
            </div>
            
            <div className="field-group model-active-toggle">
              <label>
                <input 
                  type="checkbox" 
                  checked={formData.isActive} 
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})} 
                />
                Activo (disponible para selección)
              </label>
            </div>
            
            <div className="form-actions">
              <button type="button" className="button" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="submit" className="button button-primary">Guardar</button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
