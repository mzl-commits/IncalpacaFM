import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { useState } from "react";

const FORM_SLIDES = [
  {
    src: "/croquis_almacen_3.png",
    titulo: "Mapa de c\u00f3digos de ubicaci\u00f3n",
    desc: "Usa este mapa para elegir el c\u00f3digo de secci\u00f3n correcto (A1, B2, C1\u2026).",
  },
  {
    src: "/croquis_almacen_1.png",
    titulo: "Plano general",
    desc: "Vista superior del almac\u00e9n con todas las zonas demarcadas.",
  },
  {
    src: "/croquis_almacen_2.png",
    titulo: "Zonas por tipo de herramienta",
    desc: "Zona A = Manuales \u00b7 Zona B = El\u00e9ctricas \u00b7 Zona C = Consumibles.",
  },
];

export function GruiaCroquisFormulario() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const prev = () => setSlide((s) => (s - 1 + FORM_SLIDES.length) % FORM_SLIDES.length);
  const next = () => setSlide((s) => (s + 1) % FORM_SLIDES.length);
  const current = FORM_SLIDES[slide];

  return (
    <div
      style={{
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--surface-raised, #f9fafb)",
      }}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: "transparent", border: 0, cursor: "pointer",
          fontSize: 13, fontWeight: 500, color: "var(--primary, #2563eb)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          \ud83d\uddfa\ufe0f Ver croquis del almac\u00e9n \u2014 gu\u00eda para elegir ubicaci\u00f3n
        </span>
        {open ? <CaretUp size={15} /> : <CaretDown size={15} />}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
          {/* Mini carrusel */}
          <div style={{ position: "relative", background: "#f1f5f9" }}>
            <img
              src={current.src}
              alt={current.titulo}
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
            />
            <button
              type="button"
              onClick={prev}
              style={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,.88)", border: "1px solid #d1d5db",
                borderRadius: "50%", width: 30, height: 30,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.1)",
              }}
            >
              <CaretDown size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
            <button
              type="button"
              onClick={next}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,.88)", border: "1px solid #d1d5db",
                borderRadius: "50%", width: 30, height: 30,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.1)",
              }}
            >
              <CaretUp size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
          </div>

          {/* Pie */}
          <div style={{ padding: "10px 14px" }}>
            <strong style={{ fontSize: 13, display: "block", marginBottom: 3 }}>{current.titulo}</strong>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>{current.desc}</p>
            <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
              {FORM_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlide(i)}
                  style={{
                    width: i === slide ? 18 : 6, height: 6,
                    borderRadius: 3, padding: 0, border: "none", cursor: "pointer",
                    background: i === slide ? "var(--primary, #2563eb)" : "#d1d5db",
                    transition: "width .18s, background .18s",
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0", textAlign: "center" }}>
              \u26a0\ufe0f Im\u00e1genes de prueba. Se reemplazar\u00e1n con el croquis real del almac\u00e9n.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}