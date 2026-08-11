import { useState, useMemo, useEffect, useCallback } from "react";
import { 
  FileText, 
  UserFocus, 
  Wrench, 
  ArrowsLeftRight, 
  ShieldCheck,
  DownloadSimple,
  CalendarBlank,
  Funnel,
  ArrowClockwise
} from "@phosphor-icons/react";

import { fetchAuditEvents, type AuditEvent } from "@/modules/audit/auditRepository";
import { listAssignments, type AssignmentRecord } from "@/modules/assignments/assignmentRepository";
import { listWorkOrders } from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";
import { useLocations } from "@/modules/assets/locationMapQueries";
import { downloadExcel } from "@/utils/exportCsv";

type ReportTab = "technicians" | "users" | "movements" | "environments" | "audit";

function formatDate(isoStr: string) {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

export function DetailedReportsSection() {
  const [activeTab, setActiveTab] = useState<ReportTab>("technicians");
  const [loading, setLoading] = useState(false);

  // Filtros globales/compartidos
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Datos
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const locationsQuery = useLocations();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "audit") {
        const filters: Record<string, string> = {};
        if (dateFrom) filters.date_from = dateFrom;
        if (dateTo) filters.date_to = dateTo;
        if (searchQuery) filters.q = searchQuery;
        const logs = await fetchAuditEvents(filters);
        setAuditLogs(logs);
      } else if (activeTab === "technicians") {
        const orders = await listWorkOrders();
        setWorkOrders(orders);
      } else if (activeTab === "users" || activeTab === "movements") {
        const asgs = await listAssignments();
        setAssignments(asgs);
      }
    } catch (e) {
      console.error("Error cargando reporte", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Procesamiento Técnicos
  const techniciansData = useMemo(() => {
    let filtered = workOrders;
    if (dateFrom) filtered = filtered.filter(o => o.createdAt >= dateFrom);
    if (dateTo) filtered = filtered.filter(o => o.createdAt <= dateTo);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o => o.operatorName.toLowerCase().includes(q) || o.code.toLowerCase().includes(q));
    }
    return filtered;
  }, [workOrders, dateFrom, dateTo, searchQuery]);

  // Procesamiento Usuarios
  const usersData = useMemo(() => {
    let filtered = assignments;
    if (dateFrom) filtered = filtered.filter(a => a.start_date >= dateFrom);
    if (dateTo) filtered = filtered.filter(a => a.start_date <= dateTo);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.responsible.name.toLowerCase().includes(q) || 
        a.asset.code.toLowerCase().includes(q) ||
        a.responsible.area.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [assignments, dateFrom, dateTo, searchQuery]);

  const environmentsData = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("es-PE");
    return (locationsQuery.data ?? []).filter((location) => !q || `${location.zone} ${location.building} ${location.area} ${location.room}`.toLocaleLowerCase("es-PE").includes(q));
  }, [locationsQuery.data, searchQuery]);

  function exportExcel() {
    let headers: string[] = [];
    let rows: string[][] = [];
    const filename = `reporte-${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    if (activeTab === "audit") {
      headers = ["Fecha", "Actor", "Acción", "Entidad", "ID Entidad", "IP"];
      rows = auditLogs.map(l => [
        formatDate(l.created_at), l.actor_name, l.action, l.entity, l.entity_id, l.ip_address ?? ""
      ]);
    } else if (activeTab === "technicians") {
      headers = ["Código", "Técnico", "Especialidad", "Estado", "Fecha", "Minutos Efectivos", "Calificación"];
      rows = techniciansData.map(w => [
        w.code, w.operatorName, w.specialty, w.status, formatDate(w.createdAt), 
        String(w.effectiveWorkMinutes ?? 0), String(w.satisfaction?.rating ?? "N/A")
      ]);
    } else if (activeTab === "users" || activeTab === "movements") {
      headers = ["Bien", "Usuario", "Área", "Estado Asignación", "Fecha Inicio", "Fecha Fin"];
      rows = usersData.map(a => [
        a.asset.code, a.responsible.name, a.responsible.area, a.status, formatDate(a.start_date), a.end_date ? formatDate(a.end_date) : "Vigente"
      ]);
    } else if (activeTab === "environments") {
      headers = ["Ambiente", "Ubicación", "Usuarios", "Aforo", "Superficie (m²)"];
      rows = environmentsData.map((location) => [
        location.room, `${location.zone} / ${location.building} / ${location.area}`,
        String(location.assignedUsers.length), location.headcount == null ? "Sin definir" : String(location.headcount),
        location.squareMeters == null ? "Sin registrar" : String(location.squareMeters),
      ]);
    }

    if (!rows.length) return;
    downloadExcel(filename, headers, rows, activeTab);
  }

  return (
    <section className="reports-section detailed-reports-section" aria-labelledby="detailed-reports-title">
      <header className="reports-panel-heading" style={{ marginTop: "2rem", marginBottom: "1rem" }}>
        <div>
          <h2 id="detailed-reports-title">Informes Detallados y Auditoría</h2>
          <p>Filtra y exporta datos granulares según la dimensión seleccionada.</p>
        </div>
      </header>

      <div className="reports-controls" aria-label="Controles" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
        <label className="reports-period">
          <CalendarBlank size={19} aria-hidden="true" />
          <span>Desde</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </label>
        <label className="reports-period">
          <CalendarBlank size={19} aria-hidden="true" />
          <span>Hasta</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </label>
        
        <div className="search-field">
           <Funnel size={18} />
           <input type="search" placeholder="Filtrar por texto..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <button
          className="button button-secondary reports-icon-action"
          onClick={loadData}
          disabled={loading}
        >
          <ArrowClockwise size={19} className={loading ? "is-spinning" : ""} />
          <span>Actualizar</span>
        </button>

        <button
          className="button button-primary reports-icon-action"
          onClick={exportExcel}
          disabled={loading}
        >
          <DownloadSimple size={19} />
          <span>Exportar Excel</span>
        </button>
      </div>

      <div className="reports-analysis-grid" style={{ gridTemplateColumns: "250px 1fr", alignItems: "start" }}>
        
        {/* Tabs / Sidebar */}
        <nav className="reports-panel" style={{ padding: "1rem" }}>
           <h3 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 600 }}>Tipos de Reporte</h3>
           <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
             <li>
               <button 
                  onClick={() => setActiveTab("technicians")}
                  className={`button ${activeTab === "technicians" ? "button-primary" : "button-secondary"}`}
                  style={{ width: "100%", justifyContent: "flex-start" }}
                >
                 <Wrench size={18} /> Técnicos
              </button>
             </li>
             <li>
               <button onClick={() => setActiveTab("environments")} className={`button ${activeTab === "environments" ? "button-primary" : "button-secondary"}`} style={{ width: "100%", justifyContent: "flex-start" }}>
                 <FileText size={18} /> Ambientes
               </button>
             </li>
             <li>
               <button 
                  onClick={() => setActiveTab("users")}
                  className={`button ${activeTab === "users" ? "button-primary" : "button-secondary"}`}
                  style={{ width: "100%", justifyContent: "flex-start" }}
                >
                 <UserFocus size={18} /> Usuarios y Áreas
               </button>
             </li>
             <li>
               <button 
                  onClick={() => setActiveTab("movements")}
                  className={`button ${activeTab === "movements" ? "button-primary" : "button-secondary"}`}
                  style={{ width: "100%", justifyContent: "flex-start" }}
                >
                 <ArrowsLeftRight size={18} /> Movimientos
               </button>
             </li>
             <li>
               <button 
                  onClick={() => setActiveTab("audit")}
                  className={`button ${activeTab === "audit" ? "button-primary" : "button-secondary"}`}
                  style={{ width: "100%", justifyContent: "flex-start" }}
                >
                 <ShieldCheck size={18} /> Logs de Auditoría
               </button>
             </li>
           </ul>
        </nav>

        {/* Contenido principal */}
        <section className="reports-panel data-panel" style={{ minHeight: "500px" }}>
          {loading ? (
             <div className="reports-loading"><div /><div /><div /></div>
          ) : (
             <div className="table-responsive">
                <table className="data-table">
                  <thead>
                     {activeTab === "audit" && (
                        <tr>
                           <th>Fecha</th>
                           <th>Actor</th>
                           <th>Acción</th>
                           <th>Entidad</th>
                           <th>Detalle ID</th>
                        </tr>
                     )}
                     {activeTab === "technicians" && (
                        <tr>
                           <th>OT</th>
                           <th>Técnico</th>
                           <th>Especialidad</th>
                           <th>Fecha</th>
                           <th>Calificación</th>
                        </tr>
                     )}
                     {(activeTab === "users" || activeTab === "movements") && (
                        <tr>
                           <th>Bien</th>
                           <th>Usuario</th>
                           <th>Área</th>
                           <th>Estado</th>
                           <th>Fecha Inicio</th>
                        </tr>
                     )}
                     {activeTab === "environments" && (
                        <tr><th>Ambiente</th><th>Ubicación</th><th>Usuarios</th><th>Aforo</th><th>Superficie</th></tr>
                     )}
                  </thead>
                  <tbody>
                     {activeTab === "audit" && auditLogs.map(log => (
                        <tr key={log.id}>
                           <td>{formatDate(log.created_at)}</td>
                           <td>{log.actor_name}</td>
                           <td>{log.action}</td>
                           <td>{log.entity}</td>
                           <td>{log.entity_id}</td>
                        </tr>
                     ))}
                     {activeTab === "audit" && auditLogs.length === 0 && <tr><td colSpan={5}>No se encontraron logs de auditoría.</td></tr>}

                     {activeTab === "technicians" && techniciansData.map(w => (
                        <tr key={w.id}>
                           <td>{w.code}</td>
                           <td>{w.operatorName}</td>
                           <td>{w.specialty}</td>
                           <td>{formatDate(w.createdAt)}</td>
                           <td>{w.satisfaction?.rating ? `${w.satisfaction.rating} / 5` : "N/A"}</td>
                        </tr>
                     ))}
                     {activeTab === "technicians" && techniciansData.length === 0 && <tr><td colSpan={5}>No se encontraron OT de técnicos.</td></tr>}

                     {(activeTab === "users" || activeTab === "movements") && usersData.map(a => (
                        <tr key={a.id}>
                           <td>{a.asset.code}</td>
                           <td>{a.responsible.name}</td>
                           <td>{a.responsible.area}</td>
                           <td>{a.status}</td>
                           <td>{formatDate(a.start_date)}</td>
                        </tr>
                     ))}
                     {(activeTab === "users" || activeTab === "movements") && usersData.length === 0 && <tr><td colSpan={5}>No se encontraron registros.</td></tr>}

                     {activeTab === "environments" && environmentsData.map((location) => <tr key={location.id}><td><strong>{location.room}</strong></td><td>{location.zone} / {location.building} / {location.area}</td><td>{location.assignedUsers.length}</td><td>{location.headcount == null ? "Sin definir" : location.headcount}</td><td>{location.squareMeters == null ? "Sin registrar" : `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(location.squareMeters)} m²`}</td></tr>)}
                     {activeTab === "environments" && !locationsQuery.isLoading && environmentsData.length === 0 && <tr><td colSpan={5}>No se encontraron ambientes.</td></tr>}
                  </tbody>
                </table>
             </div>
          )}
        </section>

      </div>
    </section>
  );
}
