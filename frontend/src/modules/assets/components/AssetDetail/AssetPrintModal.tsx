import { Printer } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { printAssetPdf } from "@/modules/assets/assetDetailRepository";

interface AssetPrintModalProps {
  asset: AssetDetailRecord;
  userName: string | undefined;
  onClose: () => void;
}

export function AssetPrintModal({ asset, userName, onClose }: AssetPrintModalProps) {
  return createPortal(
    <div
      className="print-modal-overlay"
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
      <div className="print-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="print-modal-header">
          <div className="print-modal-title-group">
            <Printer size={20} weight="duotone" />
            <div>
              <h2>Imprimir ficha del bien</h2>
              <p>Elige el tipo de reporte a generar en PDF</p>
            </div>
          </div>
          <button className="print-modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="print-modal-body">
          <button
            className="print-modal-option"
            onClick={() => {
              onClose();
              void printAssetPdf(asset.id, "print", userName, "asignacion");
            }}
          >
            <div className="print-modal-option-icon">
              <Printer size={18} />
            </div>
            <div className="print-modal-option-text">
              <strong>Ficha de Asignación</strong>
              <span>Responsables, ubicación, motivo y firmas</span>
            </div>
          </button>
          <button
            className="print-modal-option"
            onClick={() => {
              onClose();
              void printAssetPdf(asset.id, "print", userName, "entrada");
            }}
          >
            <div className="print-modal-option-icon">
              <Printer size={18} />
            </div>
            <div className="print-modal-option-text">
              <strong>Ficha de Entrada</strong>
              <span>Fecha de compra, costo y centro de costo</span>
            </div>
          </button>
          <button
            className="print-modal-option print-modal-option--featured"
            onClick={() => {
              onClose();
              void printAssetPdf(asset.id, "print", userName, "completo");
            }}
          >
            <div className="print-modal-option-icon">
              <Printer size={18} />
            </div>
            <div className="print-modal-option-text">
              <strong>Ficha Detallada</strong>
              <span>Información completa del bien</span>
            </div>
          </button>
        </div>
        <div className="print-modal-footer">
          <button className="button button-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
