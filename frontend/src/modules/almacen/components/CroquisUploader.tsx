import { useRef, useState } from "react";
import { updateAlmacenCroquis, eliminarAlmacenCroquis } from "@/modules/almacen/catalogoRepository";
import type { Almacen } from "@/modules/almacen/types";

export function CroquisUploader({ almacen, almacenId, onUpdated }: { almacen?: Almacen; almacenId: number; onUpdated: (almacen: Almacen) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [quitando, setQuitando] = useState(false);
  async function subir(file: File) {
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("croquis", file);
      const nuevoAlmacen = await updateAlmacenCroquis(almacenId, formData);
      onUpdated(nuevoAlmacen);
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar() {
    if (!confirm("¿Quitar la foto del croquis?")) return;
    setQuitando(true);
    try {
      const nuevoAlmacen = await eliminarAlmacenCroquis(almacenId);
      onUpdated(nuevoAlmacen);
    } finally {
      setQuitando(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, padding: 12 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) subir(file);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={subiendo}>
        {subiendo ? "Subiendo…" : "Subir foto"}
      </button>
      {almacen?.croquis && (
        <button
          type="button"
          className="btn-secondary"
          onClick={quitar}
          disabled={quitando}
          style={{ color: "var(--error, #dc2626)" }}
        >
          {quitando ? "Quitando…" : "Quitar foto"}
        </button>
      )}
    </div>
  );
}