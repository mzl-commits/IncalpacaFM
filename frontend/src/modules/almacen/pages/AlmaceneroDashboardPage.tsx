import { ArrowRight, ListChecks, ListDashes, Package, WarningCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/modules/accounts/AuthContext";
import { listMateriales } from "@/modules/almacen/catalogoRepository";
import { listChecklistPrestados, listMovimientos } from "@/modules/almacen/inventarioRepository";
import { STOCK_MINIMO } from "@/modules/almacen/types";

export default function AlmaceneroDashboardPage() {
  const { user } = useAuth();
  const almacenId = user?.almacenId ?? null;

  const { data: materiales = [], isLoading: loadingMateriales } = useQuery({
    queryKey: ["materiales", almacenId],
    queryFn: () => listMateriales(almacenId!),
    enabled: !!almacenId,
  });

  const { data: movimientos = [], isLoading: loadingMovimientos } = useQuery({
    queryKey: ["movimientos", almacenId],
    queryFn: () => listMovimientos(almacenId!),
    enabled: !!almacenId,
  });

  const { data: prestadas = [] } = useQuery({
    queryKey: ["checklist-prestados", almacenId],
    queryFn: () => listChecklistPrestados(almacenId!),
    enabled: !!almacenId,
  });

  if (!almacenId) {
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">Almacén / Inicio</p>
            <h1>Hola, {user?.fullName?.split(" ")[0] || "Almacenero"}</h1>
            <p>Tu cuenta no tiene un almacén asignado todavía. Contacta al administrador.</p>
          </div>
        </div>
      </section>
    );
  }

  const loading = loadingMateriales || loadingMovimientos;
  const stockCritico = materiales.filter((m) => !m.control_individual && m.cantidad_total < STOCK_MINIMO);
  const movimientosRecientes = [...movimientos]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 8);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Almacén / Inicio</p>
          <h1>Hola, {user?.fullName?.split(" ")[0] || "Almacenero"}</h1>
          <p>Gestión de stock y materiales del almacén.</p>
        </div>
      </div>

      <div
        className="stat-cards-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard icon={<Package size={20} />} value={loading ? "…" : materiales.length} label="Materiales en catálogo" />
        <StatCard
          icon={<WarningCircle size={20} />}
          value={loading ? "…" : stockCritico.length}
          label="Con stock bajo"
          variant={stockCritico.length > 0 ? "error" : "default"}
        />
        <StatCard icon={<ArrowRight size={20} />} value={loading ? "…" : movimientos.length} label="Movimientos registrados" />
        <StatCard icon={<ListChecks size={20} />} value={prestadas.length} label="Piezas prestadas" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <Link to={`/almacen/${almacenId}/catalogo`} className="button button-secondary">
          <ListDashes size={16} /> Ver catálogo
        </Link>
        <Link to={`/almacen/${almacenId}/movimientos/nuevo`} className="button button-primary">
          <ArrowRight size={16} /> Registrar movimiento
        </Link>
        <Link to={`/almacen/${almacenId}/checklist`} className="button button-secondary">
          <ListChecks size={16} /> Devolución
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="data-panel">
          <div className="table-toolbar">
            <strong style={{ fontSize: 15 }}>Materiales con stock bajo</strong>
            <Link to={`/almacen/${almacenId}/catalogo`} className="table-action" style={{ fontSize: 13 }}>
              Ver catálogo
            </Link>
          </div>
          {loading ? (
            <p className="empty-row">Cargando…</p>
          ) : stockCritico.length === 0 ? (
            <p className="empty-row">Todos los materiales tienen stock suficiente.</p>
          ) : (
            <div className="table-scroll">
              <table className="tabla-detalle-mobile">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Material</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {stockCritico.slice(0, 8).map((m) => (
                    <tr key={m.id}>
                      <td className="col-fecha" style={{ fontSize: 12 }}>
                        <Link to={`/almacen/${almacenId}/catalogo/${m.id}`}>{m.codigo}</Link>
                      </td>
                      <td className="col-detalle" data-label="Material" style={{ fontSize: 12 }}>
                        {m.nombre}
                      </td>
                      <td className="col-detalle" data-label="Cantidad" style={{ fontSize: 12, color: "var(--error)" }}>
                        {m.cantidad_total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="data-panel">
          <div className="table-toolbar">
            <strong style={{ fontSize: 15 }}>Movimientos recientes</strong>
            <Link to={`/almacen/${almacenId}/movimientos`} className="table-action" style={{ fontSize: 13 }}>
              Ver todos
            </Link>
          </div>
          {loading ? (
            <p className="empty-row">Cargando…</p>
          ) : movimientosRecientes.length === 0 ? (
            <p className="empty-row">No hay movimientos registrados aún.</p>
          ) : (
            <div className="table-scroll">
              <table className="tabla-detalle-mobile">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Material</th>
                    <th>Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosRecientes.map((mov) => (
                    <tr key={mov.id}>
                      <td className="col-fecha" style={{ fontSize: 12 }}>
                        {new Date(mov.fecha).toLocaleDateString("es-PE")}
                      </td>
                      <td className="col-tipo">
                        <StatusBadge value={mov.tipo} label={mov.tipo_display} />
                      </td>
                      <td className="col-detalle" data-label="Material" style={{ fontSize: 12 }}>
                        {mov.pieza_codigo ?? mov.material_nombre}
                      </td>
                      <td className="col-detalle" data-label="Cant." style={{ fontSize: 12 }}>
                        {mov.cantidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}