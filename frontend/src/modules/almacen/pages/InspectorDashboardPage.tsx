/**
 * Dashboard de inicio para el rol Inspector.
 * Muestra inspecciones vencidas, próximas y accesos directos.
 */
import { CalendarBlank, CalendarPlus, ClipboardText, Files, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { StatCard } from "@/components/shared/StatCard";
import { useAuth } from "@/modules/accounts/AuthContext";
import { listVencidas } from "@/modules/almacen/inspeccionRepository";

export default function InspectorDashboardPage() {
  const { user } = useAuth();

  const { data: vencidas = [], isLoading } = useQuery({
    queryKey: ["inspecciones-vencidas"],
    queryFn: listVencidas,
  });

  const totalMateriales = vencidas.length;
  const totalPiezas = vencidas.reduce(
    (acc, v) => acc + (v.piezas_pendientes?.length ?? (v.cantidad_pendiente ?? 0)),
    0,
  );

  function buildLoteUrl(materialId: number, piezasIds: number[]): string {
    if (piezasIds.length > 0) {
      return `/almacen/inspecciones/nueva?material=${materialId}&piezas_lote=${piezasIds.join(",")}`;
    }
    return `/almacen/inspecciones/nueva?material=${materialId}`;
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Almacén / Inicio</p>
          <h1>Hola, {user?.fullName?.split(" ")[0] || "Inspector"}</h1>
          <p>Inspecciones y cumplimiento SST.</p>
        </div>
      </div>

      <div className="stat-cards-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard
          icon={<WarningCircle size={20} />}
          value={isLoading ? "…" : totalMateriales}
          label="Materiales vencidos"
          variant={totalMateriales > 0 ? "error" : "default"}
        />
        <StatCard icon={<ClipboardText size={20} />} value={isLoading ? "…" : totalPiezas} label="Piezas pendientes" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <Link to="/almacen/inspecciones/nueva" className="button button-primary">
          <ClipboardText size={16} /> Registrar inspección
        </Link>
        <Link to="/almacen/calendario" className="button button-secondary">
          <CalendarBlank size={16} /> Ver calendario
        </Link>
        <Link to="/almacen/plan-anual" className="button button-secondary">
          <CalendarPlus size={16} /> Plan anual
        </Link>
        <Link to="/almacen/plantillas" className="button button-secondary">
          <Files size={16} /> Plantillas SST
        </Link>
      </div>

      <div className="data-panel">
        <div className="table-toolbar">
          <strong style={{ fontSize: 15 }}>
            {totalMateriales > 0 ? "Inspecciones vencidas o pendientes" : "Sin inspecciones vencidas"}
          </strong>
          <Link to="/almacen/inspecciones/vencidas" className="table-action" style={{ fontSize: 13 }}>
            Ver todas
          </Link>
        </div>
        {isLoading ? (
          <p className="empty-row">Cargando…</p>
        ) : vencidas.length === 0 ? (
          <p className="empty-row">No hay inspecciones vencidas. ¡Buen trabajo!</p>
        ) : (
          <div className="table-scroll">
            <table className="tabla-detalle-mobile">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Plantilla</th>
                  <th>Pendiente</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vencidas.slice(0, 8).map((v) => (
                  <tr key={v.material_id}>
                    <td className="col-detalle" data-label="Material" style={{ fontSize: 12 }}>
                      <strong>{v.material_codigo}</strong> — {v.material_nombre}
                    </td>
                    <td className="col-detalle" data-label="Plantilla" style={{ fontSize: 12 }}>{v.plantilla}</td>
                    <td className="col-detalle" data-label="Pendiente" style={{ fontSize: 12 }}>
                      {v.cantidad_pendiente != null
                        ? v.cantidad_pendiente
                        : v.piezas_pendientes.length > 0
                          ? v.piezas_pendientes.length
                          : "—"}
                    </td>
                    <td className="col-action">
                      <Link
                        to={buildLoteUrl(v.material_id, v.piezas_pendientes.map((p) => p.pieza_id))}
                        className="table-action"
                        aria-label={`Inspeccionar ${v.material_nombre}`}
                      >
                        Inspeccionar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}