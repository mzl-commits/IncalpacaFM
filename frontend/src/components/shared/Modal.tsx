import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
}

/**
 * Modal genérico y reutilizable. Se monta con Portal en document.body para aparecer
 * siempre frente a la vista del usuario, centrado en pantalla.
 * Se cierra con el botón X, click en el overlay, o tecla Escape.
 */
export function Modal({ open, onClose, title, children, maxWidth = 560 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 99999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1px solid #E2E8F0",
          padding: 24,
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: "1px solid #F1F5F9",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              background: "#F8FAFC",
              color: "#64748B",
              width: 30,
              height: 30,
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}