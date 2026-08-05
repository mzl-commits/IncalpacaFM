import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  listMateriales,
  listPiezas,
} from "@/modules/almacen/catalogoRepository";
import {
  registrarBajaMaterial,
  registrarBajaPieza,
  registrarEntradaMaterial,
  registrarEntradaPieza,
  registrarSalidaMaterial,
  registrarSalidaPieza,
} from "@/modules/almacen/inventarioRepository";
import { listUsuarios } from "@/modules/almacen/inspeccionRepository";
import type { PiezaBase, TipoMovimiento } from "@/modules/almacen/types";

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <label className={`field ${error ? "has-error" : ""}`}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {error && <small className="field-error"><WarningCircle size={14} />{error}</small>}
    </label>
  );
}

export function MovimientoFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const preselMaterial = params.get("material") ? Number(params.get("material")) : 0;

  const [tipo, setTipo] = useState<TipoMovimiento>("salida");
  const [materialId, setMaterialId] = useState<number>(preselMaterial);
  const [piezaId, setPiezaId] = useState<number>(0);
  const [cantidad, setCantidad] = useState(1);
  const [responsableId, setResponsableId] = useState<number>(0);
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [avisoEstuche, setAvisoEstuche] = useState<{ aviso: string; excluidas: number[] } | null>(null);
  const [exito, setExito] = useState(false);

  const tipoId = useId();

  const { data: materiales = [] } = useQuery({
    queryKey: ["materiales"],
    queryFn: () => listMateriales(),
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });

  const material = materiales.find((m) => m.id === materialId);

  const { data: piezas = [] } = useQuery({
    queryKey: ["piezas", materialId, tipo],
    queryFn: () => {
      if (!materialId) return Promise.resolve<PiezaBase[]>([]);
      if (tipo === "salida") return listPiezas({ material: materialId, estado: "Disponible", sin_padre: true });
      if (tipo === "entrada") return listPiezas({ material: materialId, estado: "Prestado" });
      // baja: mostrar disponibles y en mantenimiento
      return listPiezas({ material: materialId });
    },
    enabled: !!materialId && !!material?.control_individual,
  });

  const pieza = piezas.find((p) => p.id === piezaId);
  const esContenedor = pieza && pieza.padre === null; // piezas_hijas no viene en PiezaBase, usamos sin_padre

  const mut = useMutation({
    mutationFn: async () => {
      if (!materialId) throw new Error("Selecciona un material.");
      if (!responsableId) throw new Error("Selecciona un responsable.");

      if (material?.control_individual) {
        if (!piezaId) throw new Error("Selecciona una pieza.");
        if (tipo === "salida") return registrarSalidaPieza({ pieza_id: piezaId, responsable_id: responsableId, referencia_externa: referencia, observaciones });
        if (tipo === "entrada") return registrarEntradaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
        return registrarBajaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
      } else {
        if (tipo === "salida") return registrarSalidaMaterial({ material_id: materialId, cantidad, responsable_id: responsableId, referencia_externa: referencia, observaciones });
        if (tipo === "entrada") return registrarEntradaMaterial({ material_id: materialId, cantidad, responsable_id: responsableId, observaciones });
        return registrarBajaMaterial({ material_id: materialId, cantidad, responsable_id: responsableId, observaciones });
      }
    },
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      // Verificar si es respuesta de estuche con aviso
      if (resp && typeof resp === "object" && "aviso" in resp) {
        const r = resp as { aviso?: string; hijas_excluidas?: number[] };
        if (r.aviso) {
          setAvisoEstuche({ aviso: r.aviso, excluidas: r.hijas_excluidas ?? [] });
          return;
        }
      }
      setExito(true);
    },
    onError: (e: { message?: string; response?: { data?: Record<string, string[]> } }) => {
      const data = e?.response?.data;
      if (data) {
        const msgs = Object.values(data).flat().join(" ");
        setError(msgs);
      } else {
        setError(e.message ?? "Ocurrió un error al registrar el movimiento.");
      }
    },
  });

  if (exito || avisoEstuche) {
    return (
      <section className="success-panel">
        <h2>Movimiento registrado</h2>
        {avisoEstuche && (
          <div className="aviso-estuche" style={{ maxWidth: 480, margin: "0 auto 20px", textAlign: "left" }}>
            <strong>⚠ Estuche incompleto</strong>
            {avisoEstuche.aviso}
            <p style={{ fontSize: 12, marginTop: 8 }}>
              {avisoEstuche.excluidas.length} pieza(s) no salieron por no estar disponibles.
            </p>
          </div>
        )}
        <div className="success-actions">
          <Link className="button button-primary" to="/almacen/movimientos">Ver historial</Link>
          <Link className="button button-secondary" to={`/almacen/catalogo/${materialId}`}>Ver material</Link>
          <button className="button button-secondary" onClick={() => { setExito(false); setAvisoEstuche(null); setPiezaId(0); setCantidad(1); }}>Registrar otro</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="wizard-heading">
        <Link to="/almacen/movimientos" className="back-link">
          <ArrowLeft size={16} /> Movimientos
        </Link>
        <div>
          <p className="breadcrumb">Almacén / Movimientos / Nuevo</p>
          <h1>Registrar movimiento</h1>
        </div>
      </div>

      <form
        className="wizard-layout"
        onSubmit={(e) => { e.preventDefault(); setError(""); mut.mutate(); }}
        noValidate
      >
        <div style={{ display: "grid", gap: 20 }}>
          {/* Tipo de movimiento */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Tipo</span>
              <h2>¿Qué deseas registrar?</h2>
            </div>
            <div className={`segmented-control segmented-3`} role="group" aria-labelledby={tipoId}>
              {(["salida", "entrada", "baja"] as TipoMovimiento[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={tipo === t ? "is-active" : ""}
                  onClick={() => { setTipo(t); setPiezaId(0); }}
                >
                  {t === "salida" ? "Salida" : t === "entrada" ? "Entrada / Devolución" : "Baja"}
                </button>
              ))}
            </div>
          </div>

          {/* Material */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Material</h2>
            </div>
            <div className="form-grid">
              <Field label="Material" required>
                <select
                  value={materialId || ""}
                  onChange={(e) => { setMaterialId(Number(e.target.value)); setPiezaId(0); }}
                >
                  <option value="">Seleccionar material…</option>
                  {materiales.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} — {m.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Si control_individual: selector de pieza */}
              {material?.control_individual ? (
                <Field label="Pieza" required>
                  <select value={piezaId || ""} onChange={(e) => setPiezaId(Number(e.target.value))}>
                    <option value="">Seleccionar pieza…</option>
                    {piezas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} — {p.estado}
                        {p.padre === null ? " (contenedor)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : material ? (
                <Field label="Cantidad" required>
                  <input
                    type="number"
                    min={1}
                    max={tipo === "salida" || tipo === "baja" ? material.cantidad_total : undefined}
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                  />
                </Field>
              ) : null}
            </div>

            {/* Aviso de estuche */}
            {material?.control_individual && piezaId > 0 && esContenedor && tipo === "salida" && (
              <div className="aviso-estuche">
                <strong>Este es un estuche contenedor.</strong>
                Al registrar la salida, se intentarán sacar todas las piezas hijas disponibles.
                Las no disponibles quedarán excluidas y verás un aviso.
              </div>
            )}
          </div>

          {/* Responsable y extras */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 2</span>
              <h2>Responsable y referencia</h2>
            </div>
            <div className="form-grid">
              <Field label="Responsable" required>
                <select value={responsableId || ""} onChange={(e) => setResponsableId(Number(e.target.value))}>
                  <option value="">Seleccionar responsable…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role_display})
                    </option>
                  ))}
                </select>
              </Field>
              {(tipo === "salida") && (
                <Field label="Referencia externa" hint="Ej. OT-2026-045 (opcional)">
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Orden de trabajo u otro código"
                  />
                </Field>
              )}
              <Field label="Observaciones" wide>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  placeholder="Detalles adicionales (opcional)"
                />
              </Field>
            </div>
          </div>

          {error && (
            <div className="alert-banner alert-banner-error">
              <WarningCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-actions">
            <Link to="/almacen/movimientos" className="button button-secondary">
              <ArrowLeft size={15} /> Cancelar
            </Link>
            <button
              type="submit"
              className="button button-primary"
              disabled={mut.isPending}
            >
              {mut.isPending ? "Registrando…" : "Confirmar movimiento"}
            </button>
          </div>
        </div>

        <div className="help-panel">
          <h2>Flujo según tipo</h2>
          <ul>
            <li><strong>Salida:</strong> registra que el material/pieza salió del almacén.</li>
            <li><strong>Entrada:</strong> registra la devolución o reingreso.</li>
            <li><strong>Baja:</strong> da de baja definitiva el material o pieza.</li>
          </ul>
          {material?.control_individual ? (
            <div className="help-note">Selecciona la pieza física específica (por código).</div>
          ) : material ? (
            <div className="help-note">Este material es consumible. Indica la cantidad a mover.</div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
