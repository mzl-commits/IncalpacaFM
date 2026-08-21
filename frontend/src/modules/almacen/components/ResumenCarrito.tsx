import type { Material } from "@/modules/almacen/types";

// ── Tipos del carrito unificado ─────────────────────────────────────────────

export interface ItemCarritoConsumible {
  tipo: "consumible";
  id: string;
  materialId: number;
  materialLabel: string;
  cantidad: number;
  cantidadCajas: number;
  esEmpaque: boolean;
  unidadNombre: string | null;
  unidadesPorCaja: number | null;
}

export interface ItemCarritoPieza {
  tipo: "pieza";
  id: string;
  piezaId: number;
  piezaLabel: string;
  todasHijas: boolean;
  hijasCount: number;
}

export interface ItemCarritoPiezaSuelta {
  tipo: "pieza_suelta";
  id: string;
  piezaId: number;
  piezaLabel: string;
}

export type ItemCarrito = ItemCarritoConsumible | ItemCarritoPieza | ItemCarritoPiezaSuelta;

// ── Componente ───────────────────────────────────────────────────────────────

interface Props {
  items: ItemCarrito[];
  onQuitarConsumible: (id: string) => void;
  onQuitarEstuche: (id: string) => void;
  onQuitarPiezaSuelta: (piezaId: number) => void;
}

export function ResumenCarrito({ items, onQuitarConsumible, onQuitarEstuche, onQuitarPiezaSuelta }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="resumen-carrito">
      <div className="resumen-carrito-header">
        <span className="resumen-carrito-titulo">
          Resumen del movimiento
          <span className="resumen-carrito-badge">{items.length}</span>
        </span>
      </div>
      <ul className="resumen-carrito-lista">
        {items.map((item) => (
          <li key={item.id} className="resumen-carrito-item">
            {item.tipo === "consumible" ? (
              <>
                <span className="rci-tipo rci-tipo-consumible">Consumible</span>
                <span className="rci-label">{item.materialLabel}</span>
                <span className="rci-cantidad">
                  {item.esEmpaque
                      ? `${item.cantidadCajas} x u.`
                      : `${item.cantidad} u.`}
                </span>
                <button
                  type="button"
                  className="rci-quitar"
                  onClick={() => onQuitarConsumible(item.id)}
                  title="Quitar"
                  aria-label={`Quitar ${item.materialLabel}`}
                >
                  x
                </button>
              </>
            ) : item.tipo === "pieza" ? (
              <>
                <span className="rci-tipo rci-tipo-pieza">
                  {item.todasHijas ? "Estuche" : "Estuche parcial"}
                </span>
                <span className="rci-label">{item.piezaLabel || "Estuche sin seleccionar"}</span>
                {item.piezaId > 0 && (
                  <span className="rci-cantidad">
                    {item.todasHijas
                      ? `Todas las piezas disponibles`
                      : `${item.hijasCount} piezas seleccionadas`}
                  </span>
                )}
                <button
                  type="button"
                  className="rci-quitar"
                  onClick={() => onQuitarEstuche(item.id)}
                  title="Quitar estuche"
                  aria-label="Quitar estuche"
                >
                  x
                </button>
              </>
            ) : (
              <>
                <span className="rci-tipo rci-tipo-pieza">Pieza</span>
                <span className="rci-label">{item.piezaLabel}</span>
                <button
                  type="button"
                  className="rci-quitar"
                  onClick={() => onQuitarPiezaSuelta(item.piezaId)}
                  title="Quitar pieza"
                  aria-label={`Quitar ${item.piezaLabel}`}
                >
                  x
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}