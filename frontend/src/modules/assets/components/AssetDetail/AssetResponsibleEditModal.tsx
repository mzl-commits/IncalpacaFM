import { FloppyDisk, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { displayCode, toInputDate, type ResponsibleItem } from "@/modules/assets/pages/assetDetailUtils";

interface AssetResponsibleEditModalProps {
  asset: AssetDetailRecord;
  editingItem: ResponsibleItem;
  onClose: () => void;
  onSuccess: (updatedAsset: AssetDetailRecord) => void;
}

export function AssetResponsibleEditModal({ asset, editingItem, onClose, onSuccess }: AssetResponsibleEditModalProps) {
  const [editRespForm, setEditRespForm] = useState({
    responsible: editingItem.responsible,
    area: editingItem.area || "",
    status: editingItem.status?.toUpperCase() === "ACTIVA" ? "ACTIVA" : "FINALIZADA",
    start_date: toInputDate(editingItem.start_date),
    end_date: toInputDate(editingItem.end_date),
    reason: editingItem.reason || "",
  });

  function saveEditResponsible(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startDateIso = editRespForm.start_date
      ? new Date(editRespForm.start_date).toISOString()
      : editingItem.start_date;
    const endDateIso = editRespForm.end_date ? new Date(editRespForm.end_date).toISOString() : null;

    const isNewActive = editRespForm.status === "ACTIVA";

    const updatedHistory = asset.responsible_history.map((item) => {
      if (item.id === editingItem.id) {
        return {
          ...item,
          responsible: editRespForm.responsible.trim(),
          area: editRespForm.area.trim(),
          status: editRespForm.status,
          start_date: startDateIso,
          end_date: isNewActive ? null : endDateIso,
          reason: editRespForm.reason.trim(),
        };
      }
      if (isNewActive && (item.status?.toUpperCase() === "ACTIVA" || !item.end_date)) {
        return {
          ...item,
          status: "FINALIZADA",
          end_date: startDateIso,
        };
      }
      return item;
    });

    const updatedAsset: AssetDetailRecord = {
      ...asset,
      assignment_status: updatedHistory.some((i) => i.status === "ACTIVA") ? "Asignado" : "Sin asignar",
      responsible_history: updatedHistory,
    };

    onSuccess(updatedAsset);
  }

  return createPortal(
    <div
      className="asset-edit-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(30, 41, 59, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        margin: 0,
      }}
    >
      <section
        className="asset-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-resp-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "640px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "12px",
          border: "1px solid #000000",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          background: "#FFFFFF",
          padding: 0,
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            background: "#FFFFFF",
            borderBottom: "1px solid #E5E5E5",
            padding: "18px 24px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#525252", textTransform: "uppercase" }}>
              INCALPACA FM S.A. — Historial de Custodia
            </span>
            <h2 id="edit-resp-title" style={{ margin: "4px 0 6px", fontSize: "20px", fontWeight: 800, color: "#000000" }}>
              Editar registro de responsable
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#525252" }}>
              <strong>{displayCode(asset)}</strong> — {editingItem.responsible}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={onClose}
            style={{
              background: "#FFFFFF",
              border: "1px solid #CCCCCC",
              borderRadius: "6px",
              width: "32px",
              height: "32px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#000000",
            }}
          >
            <X size={18} />
          </button>
        </header>
        <form onSubmit={saveEditResponsible} style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                Nombre completo del responsable *
              </label>
              <input
                required
                value={editRespForm.responsible}
                onChange={(e) => setEditRespForm({ ...editRespForm, responsible: e.target.value })}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #737373",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: "13.5px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                Área / Departamento *
              </label>
              <input
                required
                list="area-suggestions"
                value={editRespForm.area}
                onChange={(e) => setEditRespForm({ ...editRespForm, area: e.target.value })}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #737373",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: "13.5px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                Estado de custodia *
              </label>
              <select
                value={editRespForm.status}
                onChange={(e) => setEditRespForm({ ...editRespForm, status: e.target.value })}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #737373",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: "13.5px",
                  fontWeight: 600,
                }}
              >
                <option value="ACTIVA">Actual (Activa)</option>
                <option value="FINALIZADA">Finalizada</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                Fecha de inicio *
              </label>
              <input
                type="date"
                required
                value={editRespForm.start_date}
                onChange={(e) => setEditRespForm({ ...editRespForm, start_date: e.target.value })}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #737373",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: "13.5px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                Fecha de término
              </label>
              <input
                type="date"
                disabled={editRespForm.status === "ACTIVA"}
                value={editRespForm.end_date}
                onChange={(e) => setEditRespForm({ ...editRespForm, end_date: e.target.value })}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #737373",
                  background: editRespForm.status === "ACTIVA" ? "#F5F5F5" : "#FFFFFF",
                  color: "#000000",
                  fontSize: "13.5px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                Motivo / Observaciones *
              </label>
              <textarea
                required
                rows={3}
                value={editRespForm.reason}
                onChange={(e) => setEditRespForm({ ...editRespForm, reason: e.target.value })}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #737373",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: "13.5px",
                  lineHeight: "1.5",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <footer
            style={{
              marginTop: "20px",
              paddingTop: "14px",
              borderTop: "1px solid #E5E5E5",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 20px",
                borderRadius: "6px",
                border: "1px solid #000000",
                background: "#FFFFFF",
                color: "#000000",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: "9px 24px",
                borderRadius: "6px",
                border: "1px solid #000000",
                background: "#000000",
                color: "#FFFFFF",
                fontSize: "13.5px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <FloppyDisk size={16} weight="bold" />
              Guardar cambios
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
