import { ClipboardText, Plus, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { listInspecciones, listVencidas } from "@/modules/almacen/inspeccionRepository";
import type { VencidaItem } from "@/modules/almacen/types";

export function InspeccionVencidasPage() {
  const { data: vencidas = [], isLoading } = useQuery({
    queryKey: ["inspecciones-vencidas"],
    queryFn: listVencidas,
  });

  // Para cada material vencido, intentamos conseguir la última inspección real
  const { data: inspecciones = [] } = useQuery({
    queryKey: ["inspecciones"],
    queryFn: () => listInspecciones(),
  });

  function getUltimaInspeccion(materialId: number): { fecha: string; periodicidadDias: number } | null {
    const ins = inspecciones
      .filter((i) => i.material === materialId)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const ultima = ins[0];
    if (!ultima) return null;
    return { fecha: ultima.fecha, periodicidadDias: ultima.material_periodicidad_inspeccion_dias ?? 0 };
  }

  function buildLoteUrl(item: VencidaItem): string {
    if (item.piezas_pendientes.length > 0) {
      const ids = item.piezas_pendientes.map((p) => p.pieza_id).join(",");
      return `/almacen/inspecciones/nueva?material=${item.material_id}&piezas_lote=${ids}`;
    }
    return `/almacen/inspecciones/nueva?material=${item.material_id}`;
  }

  if (isLoading) return <div className="loading-panel">Cargando vencidas…</div>;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Almacén / Inspecciones / Vencidas</p>
          <h1>Inspecciones vencidas</h1>
          <p>
            Materiales con más de 90 días sin inspección o que nunca han sido inspeccionados.
          </p>
        </div>
        <Link to="/almacen/inspecciones" className="button button-secondary">
          ← Inspecciones
        </Link>
      </div>

      {vencidas.length === 0 && (
        <div className="data-panel">
          <p className="empty-row" style={{ padding: 40 }}>
            ✓ No hay materiales con inspecciones vencidas. ¡Todo al día!
          </p>
        </div>
      )}

      {vencidas.length > 0 && (
        <>
          <div className="alert-banner alert-banner-warning" style={{ marginBottom: 20 }}>
            <WarningCircle size={20} />
            <div>
              <strong>{vencidas.length} materiales requieren inspección</strong>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                Usa el botón "Inspeccionar" en cada card para iniciar una nueva inspección
                pre-cargada con las piezas pendientes.
              </p>
            </div>
          </div>

          <div className="vencidas-grid">
            {vencidas.map((item) => {
              const ultima = getUltimaInspeccion(item.material_id);
              return (
                <VencidaCard
                  key={item.material_id}
                  item={item}
                  ultimaInspeccionFecha={ultima?.fecha ?? null}
                  ultimaInspeccionPeriodicidad={ultima?.periodicidadDias ?? 0}
                  inspeccionarUrl={buildLoteUrl(item)}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

// ─── Subcomponente: card de material vencido ─────────────────────────────────
function VencidaCard({
  item,
  ultimaInspeccionFecha,
  ultimaInspeccionPeriodicidad,
  inspeccionarUrl,
}: {
  item: VencidaItem;
  ultimaInspeccionFecha: string | null;
  ultimaInspeccionPeriodicidad: number;
  inspeccionarUrl: string;
}) {
  return (
    <div className="vencida-card">
      <div className="vencida-card-header">
        <div>
          <h3>
            <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--muted)", marginRight: 8 }}>
              {item.material_codigo}
            </code>
            {item.material_nombre}
          </h3>
          <small style={{ color: "var(--muted)", fontSize: 12 }}>
            Plantilla: {item.plantilla}
          </small>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {ultimaInspeccionFecha ? (
            <TrimestreBadge fecha={ultimaInspeccionFecha} periodicidadDias={ultimaInspeccionPeriodicidad} showLabel />
          ) : (
            <span
              style={{
                padding: "2px 10px",
                borderRadius: 999,
                background: "#f8d7da",
                color: "#842029",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Nunca inspeccionado
            </span>
          )}
          <Link to={inspeccionarUrl} className="button button-primary" style={{ fontSize: 12 }}>
            <Plus size={14} /> Inspeccionar
            {item.cantidad_pendiente !== null && ` (${item.cantidad_pendiente})`}
          </Link>
        </div>
      </div>

      {item.piezas_pendientes.length > 0 && (
        <div className="vencida-card-body">
          {item.piezas_pendientes.map((pieza) => (
            <span key={pieza.pieza_id} className="vencida-pieza-chip">
              <ClipboardText size={12} />
              {pieza.pieza_codigo}
            </span>
          ))}
        </div>
      )}

      {item.piezas_pendientes.length === 0 && item.cantidad_pendiente === null && (
        <div className="vencida-card-body">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Material consumible — inspección grupal pendiente.</span>
        </div>
      )}
    </div>
  );
}