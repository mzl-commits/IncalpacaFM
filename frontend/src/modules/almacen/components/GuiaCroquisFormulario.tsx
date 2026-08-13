import { CaretDown, CaretUp, MapPin } from "@phosphor-icons/react";
import { useState } from "react";

/**
 * Guía visual única para ubicar materiales en el almacén.
 * El croquis institucional ya incluye planta, vista isométrica y leyenda;
 * mantenerlo en un solo recurso evita enlaces a imágenes inexistentes.
 */
export function GuiaCroquisFormulario() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
            <MapPin size={20} weight="duotone" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">
              Guía de ubicación del almacén
            </span>
            <span className="block text-sm text-slate-600">
              Consulta el croquis antes de registrar o mover un material.
            </span>
          </span>
        </span>
        {isOpen ? (
          <CaretUp size={20} aria-hidden="true" />
        ) : (
          <CaretDown size={20} aria-hidden="true" />
        )}
      </button>

      {isOpen ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <img
            src="/croquis_almacen.png"
            alt="Croquis institucional del almacén con plano, vista isométrica y leyenda de ubicaciones"
            className="mx-auto max-h-[32rem] w-full rounded-xl border border-slate-200 bg-white object-contain"
          />
        </div>
      ) : null}
    </section>
  );
}
