import { useState } from "react";
import { TaxonomyPicker } from "@/modules/taxonomy/components/TaxonomyPicker";
import { classifyAsset, type AssetDetailRecord } from "@/modules/assets/assetDetailRepository";

interface AssetClassificationPanelProps {
  asset: AssetDetailRecord;
  onClose: () => void;
  onSuccess: (updatedAsset: AssetDetailRecord) => void;
}

export function AssetClassificationPanel({ asset, onClose, onSuccess }: AssetClassificationPanelProps) {
  const [classificationTaxonomyId, setClassificationTaxonomyId] = useState("");
  const [classificationError, setClassificationError] = useState("");
  const [classifying, setClassifying] = useState(false);

  async function completeClassification() {
    if (!asset || !classificationTaxonomyId) {
      setClassificationError("Selecciona una taxonomía activa.");
      return;
    }
    setClassifying(true);
    setClassificationError("");
    try {
      const updated = await classifyAsset(asset.id, classificationTaxonomyId);
      onSuccess(updated);
    } catch {
      setClassificationError("No se pudo clasificar el bien. La taxonomía puede haber cambiado; actualiza la selección e inténtalo nuevamente.");
      setClassifying(false);
    }
  }

  return (
    <section className="asset-classification-panel" aria-labelledby="asset-classification-title">
      <header>
        <div>
          <span>Administración</span>
          <h2 id="asset-classification-title">Asignar taxonomía y código FM</h2>
          <p>El código se reservará transaccionalmente al confirmar.</p>
        </div>
        <code>{asset.code}</code>
      </header>
      <TaxonomyPicker
        selectedId={classificationTaxonomyId}
        onSelect={(taxonomy) => {
          setClassificationTaxonomyId(taxonomy.id);
          setClassificationError("");
        }}
        error={classificationError}
      />
      <footer>
        <button className="button button-secondary" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={classifying || !classificationTaxonomyId}
          onClick={completeClassification}
        >
          {classifying ? "Clasificando…" : "Confirmar clasificación"}
        </button>
      </footer>
    </section>
  );
}
