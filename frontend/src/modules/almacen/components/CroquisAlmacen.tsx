import { MapPin, X } from "@phosphor-icons/react";
import { useState } from "react";

// ─── Datos del croquis real del almacén ───────────────────────────────────────
// Zona = número del anaquel/sector físico. Cada zona tiene un color (igual a la
// leyenda del plano en papel), un nombre de categoría, y la lista de tipos de
// producto que van en esa zona. Si la lista está vacía, aún no se ha definido
// qué productos van ahí — se puede completar más adelante sin tocar el diagrama.

export interface ZonaAlmacen {
  numero: number;
  nombre: string;
  color: string;
  colorTexto: string;
  productos: string[];
}

export const ZONAS_ALMACEN: ZonaAlmacen[] = [
  {
    numero: 1,
    nombre: "Herramientas manuales 1",
    color: "#f59e0b",
    colorTexto: "#ffffff",
    productos: [
      "Comba de metal", "Comba de goma", "Comba de acero", "Cargador", "Batería",
      "Formones para madera", "Llave ajustable", "Formón para madera", "Cintas",
      "Desarmadores", "Cinceles", "Cúter",
    ],
  },
  {
    numero: 2,
    nombre: "Herramientas eléctricas y luminarias",
    color: "#facc15",
    colorTexto: "#1f2937",
    productos: [
      "Rozadora de pared", "Rotomartillo verde", "Rotomartillo amarillo", "Caja de perforación",
      "Esmeriladora angular", "Taladro rojo", "Pulverizador de pintura", "Esmeriladora",
      "Atornillador de impacto", "Pulidora", "Pistola de calor", "Amoladoras",
      "Juego de tarraja #1", "Taladro mezclador", "Sierra caladora", "Sierra circular",
      "Cortadora de metal", "Ruteadora fresadora", "Lijadora pequeña", "Lijadora de pared",
      "Cepilladora", "Martillo m/fibra de vidrio",
    ],
  },
  {
    numero: 3,
    nombre: "Herramientas manuales 2",
    color: "#111827",
    colorTexto: "#ffffff",
    productos: [
      "Nivel láser de líneas", "Flexómetro", "Llave", "Escuadras", "Escuadra magnética",
      "Serrucho costilla", "Nivelador", "Remachadora", "Juego de dados y llaves",
      "Pinza para tierra", "Engrapadora", "Arco de sierra", "Caja accesorios taladro",
      "Rozadora RD105", "Rozadora RD125", "Disco diamante pulidor", "Broquero",
      "Fresa de enrasar", "Broca", "Caja transporte de tornillos",
      "Juego de brocas para ruteadora", "Barreta pata de cabra", "Llave hexagonal",
      "Caja punta broca", "Cinceles de rotomartillo", "Llave ajuste amoladora",
      "Tortol amarrador de varilla", "Llave torx (sueltas)", "Serrucho para Drywall",
      "Estuche punta cincel", "Mango auxiliar",
    ],
  },
  {
    numero: 4,
    nombre: "Generales",
    color: "#f3f4f6",
    colorTexto: "#1f2937",
    productos: [],
  },
  {
    numero: 5,
    nombre: "Gasfitería",
    color: "#9ca3af",
    colorTexto: "#ffffff",
    productos: [
      "Prensa de barra", "Mini arco de sierra", "Abrazaderas de esquina 90°",
      "Caños de lavamanos", "Caños de jardinería", "Llaves de lavatorio", "Llave angular",
      "Llave angular sin contratuerca", "Llave de ducha", "Llaves de jardinería",
      "Anillo para taza de cera", "Pernos de anclaje para inodoro",
      "Equipo para tanque de inodoro", "Válvula de descarga", "Canastilla de desagüe",
      "Sumidero", "Bloqueo de desagüe", "Unión universal", "Uniones de jardinería",
      "Niples", "Codos", "Tubo tee hidro", "Fluxómetro", "Chicote de baño",
    ],
  },
  {
    numero: 6,
    nombre: "Acabados",
    color: "#ef4444",
    colorTexto: "#ffffff",
    productos: [
      "Cemento azul para PVC", "Pistola para silicona", "Sellador salchicha", "Sellador tubo",
      "Espuma expansora", "Adhesivo epóxico", "Masilla", "Tiza azul", "Pasta elástica",
      "Masilla elástica", "Masilla de madera", "Masilla de pared", "Súper porcelana",
      "Cemento blanco", "Pegamento PVC", "Lubricante", "Pintura spray", "Limpiador multiuso",
      "Tinte para madera", "Abrillantador de acero inoxidable", "Cemento transparente para PVC",
    ],
  },
  {
    numero: 7,
    nombre: "Carpintería",
    color: "#92400e",
    colorTexto: "#ffffff",
    productos: [
      "Chapas de puerta", "Cerradura de muebles", "Bisagra de doble acción (cangrejo)",
      "Pistón hidra", "Correderas", "Manijas de muebles", "Engrampadora", "Perchero",
    ],
  },
  {
    numero: 8,
    nombre: "EPP",
    color: "#22c55e",
    colorTexto: "#ffffff",
    productos: [
      "Destornilladores", "Pelacable", "Desarmador de presición", "Alicate", "Prensa para cajón",
      "Llave stilson", "Tenazas", "Tijera de aviación", "Cortador de tubo", "Espátula de empaste",
      "Paleta de PVC", "Paleta de yeso con dientes", "Badilejo", "Bruña de canto", "Bruña de centro",
      "Fraguador de caucho", "Paleta esquinera", "Paleta de acero", "Rodillo de púas", "Rodillo",
      "Brocha", "Paleta de madera", "Espátula de acero", "Casaca para soldadura",
      "Guantes de nitrilo con puño tejido", "Zapatos con clavos", "Botas de lluvia",
      "Ponchos (para lluvia)", "Porta taladro", "Mascarilla KN95", "Mascarilla media cara",
      "Arnés de seguridad", "Líneas de vida", "Tambor o retráctil", "Lentes de seguridad",
      "Mascarilla facial", "Rodilleras",
    ],
  },
  {
    numero: 9,
    nombre: "Tornillería, Abrazaderas y Suministros eléctricos",
    color: "#3b82f6",
    colorTexto: "#ffffff",
    productos: [
      "Tornillo", "Pernos", "Tarugos", "Bolandas", "Clavos", "Uniones", "Terminales",
      "Conectores", "Codos metálicos", "Codos PVC", "Abrazadera", "Canaletas", "Caja de paso",
      "Caja de pop up", "Kit instalación", "Caja universal", "Interruptores", "Tomacorrientes",
      "Cables", "Seguro luminaria (gancho)", "Seguro luminaria (barra)", "Kit de suspensión",
      "Luces de emergencia", "Spot LED (luz blanca)", "Foco 40W", "Spot LED (luz cálida)",
      "Foco 80W", "Panel LED", "Panel LED cuadrado", "Panel LED rectangular", "Foco 4W",
      "Tubo de luz", "Placa para internet", "RJ45 y RJ11", "Roseta telefónico",
      "Cabezas de RJ45 o RJ11", "Cable UTP",
    ],
  },
  {
    numero: 10,
    nombre: "Sobrantes eléctricos",
    color: "#6b7280",
    colorTexto: "#ffffff",
    productos: [],
  },
];

// ─── Formas del plano (vista en planta) ───────────────────────────────────────
// Coordenadas aproximadas del croquis real (columna izquierda de anaqueles +
// pasillo derecho de dos columnas). No es una réplica pixel-exacta del plano en
// papel, pero conserva el mismo número de sectores, orden y proporciones.

interface ZonaShape {
  numero: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const SHAPES: ZonaShape[] = [
  // Columna izquierda (de arriba hacia abajo, junto a la entrada)
  { numero: 6, x: 10, y: 10, w: 130, h: 56 },
  { numero: 7, x: 10, y: 72, w: 130, h: 56 },
  { numero: 8, x: 10, y: 134, w: 130, h: 56 },
  { numero: 9, x: 10, y: 196, w: 130, h: 56 },
  { numero: 9, x: 10, y: 258, w: 130, h: 56 },
  { numero: 9, x: 10, y: 320, w: 130, h: 56 },
  { numero: 10, x: 10, y: 382, w: 150, h: 76 },
  // Pasillo derecho, sub-columna izquierda
  { numero: 5, x: 175, y: 10, w: 95, h: 128 },
  { numero: 4, x: 175, y: 144, w: 95, h: 78 },
  { numero: 3, x: 175, y: 228, w: 95, h: 128 },
  { numero: 1, x: 175, y: 362, w: 95, h: 96 },
  // Pasillo derecho, sub-columna derecha
  { numero: 5, x: 280, y: 10, w: 90, h: 62 },
  { numero: 5, x: 280, y: 78, w: 90, h: 60 },
  { numero: 2, x: 280, y: 144, w: 90, h: 70 },
  { numero: 2, x: 280, y: 220, w: 90, h: 70 },
  { numero: 2, x: 280, y: 296, w: 90, h: 70 },
];

function zonaByNumero(n: number) {
  return ZONAS_ALMACEN.find((z) => z.numero === n)!;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CroquisAlmacen({ compact }: { compact?: boolean }) {
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const zona = seleccionada != null ? zonaByNumero(seleccionada) : null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: compact ? 12 : 20,
        alignItems: "flex-start",
      }}
    >
      {/* Diagrama SVG clicable */}
      <div style={{ flex: "0 0 auto" }}>
        <svg
          viewBox="0 0 380 480"
          width={compact ? 260 : 340}
          height={compact ? 328 : 428}
          style={{ display: "block" }}
        >
          {SHAPES.map((shape, i) => {
            const z = zonaByNumero(shape.numero);
            const activa = seleccionada === shape.numero;
            return (
              <g
                key={i}
                onClick={() => setSeleccionada(shape.numero)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={shape.w}
                  height={shape.h}
                  rx={6}
                  fill={z.color}
                  stroke={activa ? "#2563eb" : "#ffffff"}
                  strokeWidth={activa ? 3 : 1.5}
                  opacity={seleccionada != null && !activa ? 0.55 : 1}
                />
                <text
                  x={shape.x + shape.w / 2}
                  y={shape.y + shape.h / 2 + 6}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={700}
                  fill={z.colorTexto}
                >
                  {shape.numero}
                </text>
              </g>
            );
          })}
          <text x={190} y={462} textAnchor="middle" fontSize={13} fontWeight={700} fill="#dc2626">
            ENTRADA
          </text>
        </svg>
      </div>

      {/* Leyenda + panel de productos de la zona seleccionada */}
      <div style={{ flex: "1 1 220px", minWidth: 220 }}>
        {!zona && (
          <>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>
              Haz clic en un sector del croquis para ver qué tipo de productos van ahí.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ZONAS_ALMACEN.map((z) => (
                <button
                  key={z.numero}
                  type="button"
                  onClick={() => setSeleccionada(z.numero)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
                    background: "var(--surface, #fff)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 18, height: 18, borderRadius: 4, background: z.color,
                      flexShrink: 0, border: "1px solid rgba(0,0,0,.1)",
                    }}
                  />
                  <span style={{ fontSize: 12.5 }}>
                    <strong>{z.numero}</strong> · {z.nombre}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {zona && (
          <div
            style={{
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--surface, #fff)",
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", background: zona.color,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: zona.colorTexto, fontWeight: 700, fontSize: 13 }}>
                <MapPin size={15} weight="fill" />
                Zona {zona.numero} · {zona.nombre}
              </span>
              <button
                type="button"
                onClick={() => setSeleccionada(null)}
                style={{
                  background: "rgba(255,255,255,.25)", border: "none", borderRadius: "50%",
                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: zona.colorTexto,
                }}
                title="Volver a la lista de zonas"
              >
                <X size={13} />
              </button>
            </div>
            <div style={{ padding: "10px 12px", maxHeight: compact ? 220 : 300, overflowY: "auto" }}>
              {zona.productos.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                  Aún no se ha definido la lista de productos para esta zona.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
                  {zona.productos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
