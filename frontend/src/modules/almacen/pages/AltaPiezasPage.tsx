import {
  ArrowLeft,
  CheckCircle,
  Package,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { labelPieza } from "@/utils/pieza";

import {
  altaEstucheInline,
  altaPiezasSueltas,
  getMaterialDetalle,
} from "@/modules/almacen/catalogoRepository";
import type {
  AltaEstucheInlinePayload,
  PiezaHijaInlineSpec,
} from "@/modules/almacen/catalogoRepository";
import type { PiezaBase } from "@/modules/almacen/types";

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Modo = "elegir" | "sueltas" | "estuche" | "exito";

// ─── Página principal ─────────────────────────────────────────────────────────
export function AltaPiezasPage() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [modo, setModo] = useState<Modo>("elegir");
  const [piezasCreadas, setPiezasCreadas] = useState<PiezaBase[]>([]);

  // ── Alta sueltas ──
  const [cantPiezas, setCantPiezas] = useState(1);

  // ── Alta estuche inline ──
  const [numEstuches, setNumEstuches] = useState(1);
  const [hijasSpec, setHijasSpec] = useState<PiezaHijaInlineSpec[]>([
    { nombre: "", medida: "", cantidad: 1 },
  ]);

  const { data: material, isLoading } = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => getMaterialDetalle(materialId),
    enabled: !!materialId,
  });

  // ── Mutación sueltas ──
  const altaPiezasMut = useMutation({
    mutationFn: () => altaPiezasSueltas({ material_id: materialId, cantidad: cantPiezas }),
    onSuccess: (piezas) => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setPiezasCreadas(piezas);
      setModo("exito");
    },
  });

  // ── Mutación estuche inline ──
  const altaEstucheMut = useMutation({
    mutationFn: () => {
      const hijasValidas = hijasSpec.filter((h) => h.nombre.trim() !== "");
      const payload: AltaEstucheInlinePayload = {
        material_contenedor_id: materialId,
        piezas_hijas: hijasValidas.map((h) => ({
          nombre: h.nombre.trim(),
          medida: h.medida?.trim() || undefined,
          cantidad: h.cantidad,
        })),
        num_estuches: numEstuches,
      };
      return altaEstucheInline(payload);
    },
    onSuccess: (piezas) => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setPiezasCreadas(piezas);
      setModo("exito");
    },
  });

  if (isLoading) return <div className="loading-panel">Cargando material…</div>;
  if (!material) {
    return (
      <div className="loading-panel">
        Material no encontrado.{" "}
        <button className="button button-secondary" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>
    );
  }

  // ─── Cabecera común ──────────────────────────────────────────────────────────
  const Header = ({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) => (
    <div className="wizard-heading">
      <Link to={`/almacen/catalogo/${materialId}`} className="back-link">
        <ArrowLeft size={16} /> {material.codigo} — {material.nombre}
      </Link>
      <div>
        <p className="breadcrumb">Almacén / Catálogo / {material.codigo} / Alta de piezas</p>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
    </div>
  );

  // ─── Fase: éxito ─────────────────────────────────────────────────────────────
  if (modo === "exito") {
    // Agrupar piezas por material_nombre para mostrar con sus códigos
    const esEstuche = piezasCreadas.some((p) => p.padre !== null);
    // Piezas contenedoras (sin padre)
    const contenedoras = piezasCreadas.filter((p) => p.padre === null);
    // Piezas hijas
    const hijas = piezasCreadas.filter((p) => p.padre !== null);

    return (
      <section>
        <Header titulo="Piezas registradas" />
        <div className="wizard-layout">
          <div className="form-panel">
            <div className="alta-success-banner">
              <CheckCircle size={28} weight="fill" />
              <div>
                <strong className="text-md">
                  {piezasCreadas.length} pieza{piezasCreadas.length !== 1 ? "s" : ""} creada
                  {piezasCreadas.length !== 1 ? "s" : ""} correctamente
                </strong>
                {esEstuche && (
                  <p className="alta-success-count">
                    {contenedoras.length} estuche{contenedoras.length !== 1 ? "s" : ""}{" "}
                    · {hijas.length} item{hijas.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {esEstuche ? (
              // Mostrar árbol de estuche → hijas (reutiliza .pieza-tree de MaterialDetailPage)
              <div className="pieza-tree">
                {contenedoras.map((cont) => {
                  const misHijas = hijas.filter((h) => h.padre === cont.id);
                  return (
                    <div key={cont.id}>
                      {/* Fila estuche */}
                      <div className="pieza-tree-row is-container">
                        <Package size={16} className="text-muted" />
                        <code className="pieza-code">{cont.codigo}</code>
                        <span className="text-base">Estuche — {material.nombre}</span>
                        <span className="ml-auto text-muted-xs">
                          {misHijas.length} item{misHijas.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {/* Filas hijas */}
                      <div className="pieza-tree-children">
                        {misHijas.map((hija) => (
                          <div key={hija.id} className="pieza-tree-hija">
                            <Package size={13} className="text-muted" style={{ flexShrink: 0 }} />
                            <code className="pieza-code">{labelPieza(hija)}</code>
                            <span className="text-muted-sm">Item</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Piezas sueltas
              <div className="alta-piezas-chips">
                {piezasCreadas.map((p) => (
                  <div key={p.id} className="alta-pieza-chip">
                    <code className="pieza-code">{p.codigo}</code>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-row mt-24">
              <Link
                className="button button-primary"
                to={`/almacen/catalogo/${materialId}`}
              >
                Ver ficha del material
              </Link>
              <button
                className="button button-secondary"
                onClick={() => {
                  setPiezasCreadas([]);
                  setModo("elegir");
                  setCantPiezas(1);
                  setNumEstuches(1);
                  setHijasSpec([{ nombre: "", medida: "", cantidad: 1 }]);
                }}
              >
                Agregar más piezas
              </button>
            </div>
          </div>

          <div className="help-panel">
            <h2>¿Qué sigue?</h2>
            <p className="text-base">
              Las piezas ya están registradas en el inventario con estado{" "}
              <strong>Disponible</strong>. Puedes registrar un movimiento de
              préstamo desde la ficha del material.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ─── Fase: elegir modo ────────────────────────────────────────────────────────
  if (modo === "elegir") {
    return (
      <section>
        <Header
          titulo="Alta de piezas"
          subtitulo="¿Cómo quieres registrar las piezas de este material?"
        />
        <div className="wizard-layout">
          <div className="option-cards-stack">
            {/* Opción A: sueltas */}
            <div
              className="form-panel option-card"
              onClick={() => setModo("sueltas")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setModo("sueltas")}
            >
              <div className="form-section-heading">
                <span>Opción A</span>
                <h2>Piezas sueltas</h2>
                <p>
                  Unidades independientes del mismo material. Ej: 3 taladros idénticos,
                  4 destornilladores planos.
                </p>
              </div>
              <div className="mt-8">
                <span className="option-hint">
                  <Package size={13} />
                  Cada pieza recibe un código único (ej. 3WADV).
                </span>
              </div>
            </div>

            {/* Opción B: estuche */}
            <div
              className="form-panel option-card"
              onClick={() => setModo("estuche")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setModo("estuche")}
            >
              <div className="form-section-heading">
                <span>Opción B</span>
                <h2>Estuche con items</h2>
                <p>
                  Contenedor que agrupa piezas de distintos tipos. Ej: set de llaves
                  Allen con varias medidas, estuche de mecánico.
                </p>
              </div>
              <div className="mt-8">
                <span className="option-hint">
                  <Package size={13} />
                  El estuche y cada item reciben su propio código.
                </span>
              </div>
            </div>
          </div>

          <div className="help-panel">
            <h2>¿Cuál elegir?</h2>
            <ul className="info-list">
              <li>
                <strong>Sueltas</strong> → cuando cada unidad es independiente aunque
                sean del mismo tipo (varios taladros iguales).
              </li>
              <li>
                <strong>Estuche</strong> → cuando el material es un contenedor con
                piezas internas que también se prestan individualmente (set de llaves,
                estuche de brocas, etc.).
              </li>
            </ul>
          </div>
        </div>
      </section>
    );
  }

  // ─── Fase: sueltas ────────────────────────────────────────────────────────────
  if (modo === "sueltas") {
    return (
      <section>
        <Header
          titulo="Piezas sueltas"
          subtitulo={`Material: ${material.codigo} — ${material.nombre}`}
        />
        <div className="wizard-layout">
          <div className="form-panel">
            <div className="form-section-heading">
              <h2>¿Cuántas piezas quieres dar de alta?</h2>
              <p>
                Cada pieza recibirá un código único de 5 caracteres (ej. 3WADV, K9MXT).
              </p>
            </div>
            <div className="form-grid mt-16">
              <Field
                label="Cantidad de piezas"
                required
                hint="Se generará un código por cada unidad"
              >
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={cantPiezas}
                  onChange={(e) => setCantPiezas(Math.max(1, Number(e.target.value)))}
                />
              </Field>
            </div>
            <div className="info-box mt-16">
              Se crearán <strong>{cantPiezas}</strong> pieza
              {cantPiezas !== 1 ? "s" : ""} de{" "}
              <strong>
                {material.codigo} — {material.nombre}
              </strong>
              , cada una con su código único.
            </div>
            <div className="form-actions mt-20">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setModo("elegir")}
              >
                ← Volver
              </button>
              <button
                className="button button-primary"
                onClick={() => altaPiezasMut.mutate()}
                disabled={altaPiezasMut.isPending}
              >
                {altaPiezasMut.isPending
                  ? "Creando…"
                  : `Dar de alta ${cantPiezas} pieza${cantPiezas !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          <div className="help-panel">
            <h2>Ejemplo</h2>
            <p className="text-base">
              Si tienes 3 taladros iguales (mismo modelo), ingresa <strong>3</strong>.
              Se generarán automáticamente 3 piezas: <code>A1B2C</code>, <code>D3E4F</code>,{" "}
              <code>G5H6I</code>.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ─── Fase: estuche (inline) ───────────────────────────────────────────────────
  const totalHijasEnEsperado = hijasSpec
    .filter((h) => h.nombre.trim())
    .reduce((acc, h) => acc + h.cantidad, 0);
  const totalPiezasPorEstuche = totalHijasEnEsperado;
  const totalPiezasGlobal = numEstuches * totalPiezasPorEstuche;
  const hayHijasValidas = hijasSpec.some((h) => h.nombre.trim() !== "");

  function addFila() {
    setHijasSpec((prev) => [...prev, { nombre: "", medida: "", cantidad: 1 }]);
  }
  function removeFila(idx: number) {
    setHijasSpec((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateFila<K extends keyof PiezaHijaInlineSpec>(
    idx: number,
    key: K,
    value: PiezaHijaInlineSpec[K],
  ) {
    setHijasSpec((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  return (
    <section>
      <Header
        titulo="Estuche con items"
        subtitulo={`Estuche: ${material.codigo} — ${material.nombre}`}
      />
      <div className="wizard-layout">
        <div className="grid-gap-20">
          {/* Número de estuches */}
          <div className="form-panel">
            <div className="form-section-heading">
              <h2>¿Cuántos estuches idénticos?</h2>
              <p>Si tienes varios estuches del mismo modelo, indica la cantidad.</p>
            </div>
            <div className="form-grid mt-12">
              <Field label="Número de estuches" required>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={numEstuches}
                  onChange={(e) => setNumEstuches(Math.max(1, Number(e.target.value)))}
                />
              </Field>
            </div>
          </div>

          {/* Piezas hijas */}
          <div className="form-panel">
            <div className="form-section-heading">
              <h2>Piezas dentro del estuche</h2>
              <p>
                Define cada tipo de pieza. Si hay 3 destornilladores planos, pon{" "}
                <strong>cantidad 3</strong> — el sistema les asignará un código a cada uno.
              </p>
            </div>

            <div className="hijas-list">
              {/* Cabecera de columnas */}
              <div className="hijas-grid-cols hijas-grid-header">
                <span>Nombre de la pieza</span>
                <span>Medida (opc.)</span>
                <span>Cantidad</span>
                <span />
              </div>

              {hijasSpec.map((hija, idx) => (
                <div key={idx} className="hijas-grid-cols hijas-grid-row">
                  <input
                    type="text"
                    placeholder="Ej: Destornillador punta plana"
                    value={hija.nombre}
                    onChange={(e) => updateFila(idx, "nombre", e.target.value)}
                    aria-label="Nombre de la pieza"
                  />
                  <input
                    type="text"
                    placeholder="Ej: 5 mm"
                    value={hija.medida || ""}
                    onChange={(e) => updateFila(idx, "medida", e.target.value)}
                    aria-label="Medida"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={hija.cantidad}
                    onChange={(e) =>
                      updateFila(idx, "cantidad", Math.max(1, Number(e.target.value)))
                    }
                    aria-label="Cantidad"
                  />
                  <button
                    type="button"
                    className="icon-button-danger"
                    onClick={() => removeFila(idx)}
                    disabled={hijasSpec.length === 1}
                    aria-label="Eliminar fila"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="button button-secondary add-fila-btn"
                onClick={addFila}
              >
                <Plus size={14} /> Agregar tipo de pieza
              </button>
            </div>

            {/* Resumen */}
            {hayHijasValidas && (
              <div className="info-box is-plain mt-16">
                <strong>Resumen:</strong>{" "}
                {numEstuches} estuche{numEstuches !== 1 ? "s" : ""} × {totalPiezasPorEstuche} pieza
                {totalPiezasPorEstuche !== 1 ? "s" : ""} ={" "}
                <strong>
                  {totalPiezasGlobal} item{totalPiezasGlobal !== 1 ? "s" : ""}
                </strong>{" "}
                + {numEstuches} estuche{numEstuches !== 1 ? "s" : ""} contenedor
                {numEstuches !== 1 ? "es" : ""} ={" "}
                <strong>{totalPiezasGlobal + numEstuches} piezas totales</strong>.
              </div>
            )}

            {altaEstucheMut.isError && (
              <div className="error-box mt-12">
                Error al crear el estuche. Verifica los datos e intenta de nuevo.
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setModo("elegir")}
            >
              ← Volver
            </button>
            <button
              className="button button-primary"
              onClick={() => altaEstucheMut.mutate()}
              disabled={altaEstucheMut.isPending || !hayHijasValidas}
            >
              {altaEstucheMut.isPending
                ? "Creando…"
                : `Crear ${numEstuches} estuche${numEstuches !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        <div className="help-panel">
          <h2>Cómo funciona</h2>
          <ul className="info-list">
            <li>
              <strong>Nombre</strong>: el tipo de pieza (ej. "Llave Allen", "Broca espiral").
            </li>
            <li>
              <strong>Medida</strong>: opcional, diferencia piezas del mismo tipo
              (ej. "4 mm", "6 mm", "8 mm").
            </li>
            <li>
              <strong>Cantidad</strong>: cuántas piezas de ese tipo contiene el estuche.
              Cada una recibe un código único.
            </li>
            <li>
              Si el mismo tipo+medida ya existe en el catálogo, se reutiliza
              en lugar de crear un duplicado.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}