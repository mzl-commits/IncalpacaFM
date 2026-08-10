import { CaretLeft, CaretRight, MapPin } from "@phosphor-icons/react";
import { useState } from "react";

const SLIDES = [
  {
    src: "/croquis_almacen_1.png",
    titulo: "Plano general del almac\u00e9n",
    desc: "Vista superior con todas las zonas de almacenamiento (A1\u2013A3, B1\u2013B3, C1\u2013C2).",
  },
  {
    src: "/croquis_almacen_2.png",
    titulo: "Vista isom\u00e9trica por zonas",
    desc: "Zona A = Herramientas Manuales \u00b7 Zona B = El\u00e9ctricas \u00b7 Zona C = Consumibles.",
  },
  {
    src: "/croquis_almacen_3.png",
    titulo: "Mapa de ubicaciones por c\u00f3digo",
    desc: "Referencia r\u00e1pida: c\u00f3digo de secci\u00f3n + tipo de herramienta almacenada.",
  },
];

export function CroquisCarrusel() {
  const [slide, setSlide] = useState(0);
  const prev = () => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setSlide((s) => (s + 1) % SLIDES.length);
  const current = SLIDES[slide];

  return (
    <div
      style={{
        background: "var(--surface, #fff)",
        borderRadius: 12,
        border: "1px solid var(--border, #e5e7eb)",
        overflow: "hidden",
        marginBottom: 8,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={18} style={{ color: "var(--primary, #2563eb)" }} weight="fill" />
          <strong style={{ fontSize: 15 }}>Croquis del almac\u00e9n</strong>
          <span
            style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 20,
              background: "#fef3c7", color: "#92400e",
              border: "1px solid #fcd34d",
            }}
          >
            Im\u00e1genes de prueba
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {slide + 1} / {SLIDES.length}
        </span>
      </div>

      {/* Imagen */}
      <div style={{ position: "relative", background: "#f8fafc" }}>
        <img
          src={current.src}
          alt={current.titulo}
          style={{
            width: "100%",
            maxHeight: 480,
            objectFit: "contain",
            display: "block",
          }}
        />

        {/* Botones prev/next */}
        <button
          onClick={prev}
          style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,.9)", border: "1px solid var(--border, #d1d5db)",
            borderRadius: "50%", width: 36, height: 36, display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.1)",
          }}
          title="Anterior"
        >
          <CaretLeft size={18} />
        </button>
        <button
          onClick={next}
          style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,.9)", border: "1px solid var(--border, #d1d5db)",
            borderRadius: "50%", width: 36, height: 36, display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.1)",
          }}
          title="Siguiente"
        >
          <CaretRight size={18} />
        </button>
      </div>

      {/* Pie: t\u00edtulo + descripci\u00f3n + dots */}
      <div style={{ padding: "14px 20px" }}>
        <strong style={{ fontSize: 14, display: "block", marginBottom: 4 }}>
          {current.titulo}
        </strong>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          {current.desc}
        </p>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 22 : 8,
                height: 8,
                borderRadius: 4,
                background: i === slide ? "var(--primary, #2563eb)" : "var(--border, #d1d5db)",
                border: "none",
                cursor: "pointer",
                transition: "width .2s, background .2s",
                padding: 0,
              }}
              title={SLIDES[i].titulo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}