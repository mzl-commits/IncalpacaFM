import { useState, useId } from "react";
import { REQUEST_PRIORITIES, REQUEST_TYPES, requestPriorityLabels, requestTypeLabels, type RequestPriority, type RequestType } from "../incidentModel";
import { createWorkRequest } from "../incidentRepository";
import { currentUser } from "@/modules/accounts/currentUser";
import { DashboardAsset } from "@/modules/accounts/api/userDashboardApi";
import { WarningCircle, X } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

interface ReportIncidentModalProps {
  onClose: () => void;
  prefilledAssetId: string | null;
  assignedAssets?: DashboardAsset[];
}

export function ReportIncidentModal({ onClose, prefilledAssetId, assignedAssets = [] }: ReportIncidentModalProps) {
  const navigate = useNavigate();
  const errorId = useId();
  
  const [assetId, setAssetId] = useState<string>(prefilledAssetId || "general");
  const [requestType, setRequestType] = useState<RequestType | "">("");
  const [description, setDescription] = useState("");
  const [requesterPriority, setRequesterPriority] = useState<RequestPriority>("NORMAL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assetId === "general") {
      navigate("/incidencias/nueva");
      onClose();
      return;
    }

    if (!requestType || description.trim().length < 10) {
      setError("Completa el tipo de solicitud y describe el problema con al menos 10 caracteres.");
      return;
    }

    const selectedAsset = assignedAssets.find(a => a.id === assetId);
    if (!selectedAsset || !selectedAsset.location_id) {
      setError("El bien seleccionado no tiene una ubicación válida.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await createWorkRequest({
        requesterId: currentUser.id,
        requesterName: currentUser.fullName,
        requesterEmail: currentUser.email,
        assetId: selectedAsset.id,
        locationId: selectedAsset.location_id,
        zone: "",
        building: "",
        area: "",
        room: "",
        requestType,
        description: description.trim(),
        requesterPriority,
        project: false,
        evidence: [],
        status: "PENDIENTE",
      });
      onClose();
      navigate("/incidencias");
    } catch (err) {
      setError("No se pudo registrar la solicitud. Inténtalo nuevamente.");
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div className="data-panel" style={{ width: "100%", maxWidth: "500px", position: "relative", padding: "1.5rem" }}>
        <button 
          onClick={onClose} 
          style={{ position: "absolute", right: "1rem", top: "1rem", background: "transparent", border: "none", cursor: "pointer", color: "var(--color-text-light)" }}
        >
          <X size={24} />
        </button>
        
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem 0" }}>Reportar Incidencia</h2>
          <p style={{ margin: 0, color: "var(--color-text-light)", fontSize: "0.875rem" }}>
            Describe el problema para que el equipo de mantenimiento pueda atenderlo.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <label className="field">
            <span>Bien Afectado</span>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="general">Ninguno / Otro bien (Reporte General)</option>
              {assignedAssets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.fm_code || asset.code})
                </option>
              ))}
            </select>
          </label>

          {assetId !== "general" ? (
            <>
              <label className="field">
                <span>Tipo de solicitud *</span>
                <select required value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType)}>
                  <option value="">Seleccionar tipo</option>
                  {REQUEST_TYPES.map(type => (
                    <option key={type} value={type}>
                      {requestTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Prioridad sugerida *</span>
                <select required value={requesterPriority} onChange={(e) => setRequesterPriority(e.target.value as RequestPriority)}>
                  {REQUEST_PRIORITIES.map(priority => (
                    <option key={priority} value={priority}>
                      {requestPriorityLabels[priority]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field-wide">
                <span>Descripción del problema *</span>
                <textarea
                  required
                  placeholder="Describe qué ocurre, desde cuándo y detalles importantes."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
                <small style={{ textAlign: "right", display: "block", marginTop: "0.25rem" }}>
                  {description.length} / 1000
                </small>
              </label>

              {error && (
                <div className="form-error" id={errorId} role="alert" aria-live="assertive">
                  <WarningCircle />{error}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "1rem", backgroundColor: "var(--color-background-soft)", borderRadius: "8px", fontSize: "0.875rem", color: "var(--color-text-light)", textAlign: "center" }}>
              Serás redirigido al formulario completo para buscar la ubicación oficial del problema o el código de otro bien.
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "0.5rem" }}>
            <button className="button button-secondary" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {assetId === "general" ? "Ir al formulario completo" : (isSubmitting ? "Registrando..." : "Registrar solicitud")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
