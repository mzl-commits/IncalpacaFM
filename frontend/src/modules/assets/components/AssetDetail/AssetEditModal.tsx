import { FloppyDisk, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { updateAssetDetail, type AssetDetailRecord, type AssetDetailUpdate } from "@/modules/assets/assetDetailRepository";
import { ModelCreatableSelect } from "@/modules/assets/components/ModelCreatableSelect";
import { displayCode } from "@/modules/assets/pages/assetDetailUtils";

interface AssetEditModalProps {
  asset: AssetDetailRecord;
  onClose: () => void;
  onSuccess: (updatedAsset: AssetDetailRecord) => void;
}

export function AssetEditModal({ asset, onClose, onSuccess }: AssetEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<AssetDetailUpdate>({
    name: asset.name,
    description: asset.description,
    brand: asset.brand,
    model: asset.model,
    serial_number: asset.serial_number ?? "",
    condition: asset.condition,
    criticality: asset.criticality,
    photo_url: asset.photo_url ?? "",
  });

  useEffect(() => {
    // Esc is handled by the browser sometimes or we could add event listener
  }, []);

  function updateEditField<Key extends keyof AssetDetailUpdate>(field: Key, value: AssetDetailUpdate[Key]) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function saveAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setEditError("");
    try {
      const updated = await updateAssetDetail(asset.id, editForm);
      // Always apply photo_url from the form in case the backend doesn't persist it
      onSuccess({ ...updated, photo_url: editForm.photo_url ?? updated.photo_url ?? null });
    } catch {
      setEditError("No se pudieron guardar los cambios. Revisa los datos e inténtalo nuevamente.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="asset-edit-backdrop" role="presentation">
      <section
        className="asset-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-edit-title"
      >
        <header>
          <div>
            <span>Edición administrativa</span>
            <h2 id="asset-edit-title">Actualizar ficha del bien</h2>
            <p>
              {displayCode(asset)}
              {asset.fm_code && asset.code !== displayCode(asset) && asset.code !== asset.fm_code ? ` · ${asset.code}` : ""}
            </p>
          </div>
          <button type="button" aria-label="Cerrar edición" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={saveAsset}>
          {editError && (
            <div className="asset-edit-error" role="alert">
              {editError}
            </div>
          )}
          <div className="asset-edit-fields">
            <div className="field field-wide" style={{ display: "grid", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Fotografía del bien / equipo</span>
              <div style={{ display: "flex", gap: "14px", alignItems: "center", background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #e4e4e4" }}>
                {editForm.photo_url ? (
                  <div style={{ position: "relative", width: "72px", height: "72px", flexShrink: 0 }}>
                    <img src={editForm.photo_url} alt="Vista previa" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px", border: "1px solid #ddd" }} />
                    <button type="button" onClick={() => updateEditField("photo_url", "")} style={{ position: "absolute", top: "-6px", right: "-6px", background: "#111", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "11px" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ width: "72px", height: "72px", borderRadius: "6px", background: "#eee", display: "grid", placeItems: "center", color: "#888", flexShrink: 0, fontSize: "11px", textAlign: "center" }}>
                    Sin foto
                  </div>
                )}
                <div style={{ flex: 1, display: "grid", gap: "8px" }}>
                  <label className="button button-secondary" style={{ width: "fit-content", cursor: "pointer", padding: "6px 14px", fontSize: "13px", margin: 0 }}>
                    <span>{editForm.photo_url ? "Cambiar imagen" : "Subir imagen"}</span>
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (ev.target?.result) updateEditField("photo_url", ev.target.result as string);
                      };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
              </div>
            </div>
            <label className="field field-wide">
              <span>Nombre del bien *</span>
              <input
                required
                value={editForm.name}
                onChange={(event) => updateEditField("name", event.target.value)}
              />
            </label>
            <label className="field field-wide">
              <span>Descripción *</span>
              <textarea
                required
                rows={3}
                value={editForm.description}
                onChange={(event) => updateEditField("description", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Marca</span>
              <input
                value={editForm.brand}
                onChange={(event) => updateEditField("brand", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Modelo</span>
              <ModelCreatableSelect
                taxonomyId={asset?.taxonomy_detail?.id ?? ""}
                value={editForm.model}
                onChange={(val) => updateEditField("model", val)}
                disabled={!asset?.taxonomy_detail?.id}
              />
            </label>
            <label className="field">
              <span>Número de serie</span>
              <input
                value={editForm.serial_number}
                onChange={(event) => updateEditField("serial_number", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Condición *</span>
              <select
                required
                value={editForm.condition}
                onChange={(event) => updateEditField("condition", event.target.value)}
              >
                {["Nuevo", "Bueno", "Regular", "Requiere revisión"].map((condition) => (
                  <option value={condition} key={condition}>
                    {condition}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Criticidad *</span>
              <select
                required
                value={editForm.criticality}
                onChange={(event) => updateEditField("criticality", event.target.value)}
              >
                {["Baja", "Media", "Alta", "Crítica"].map((criticality) => (
                  <option value={criticality} key={criticality}>
                    {criticality}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <aside className="asset-edit-boundary">
            La ubicación y el responsable se pueden asignar desde la pestaña de Responsables para conservar su
            historial.
          </aside>
          <footer>
            <button
              className="button button-secondary"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="button button-primary" disabled={saving}>
              <FloppyDisk />
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
