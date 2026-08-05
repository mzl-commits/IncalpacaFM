import { MagnifyingGlass, UsersThree } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { api } from "@/services/api";

interface ReporterProfile {
  id: string;
  dni: string;
  full_name: string;
  email: string;
  workerCodes: string[];
  reportsCount: number;
  lastReportedAt: string;
}

export function ReporterRegistryPage() {
  const [items, setItems] = useState<ReporterProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      api.get<ReporterProfile[]>("/organization/reporters/", { params: query ? { q: query } : {} })
        .then(({ data }) => setItems(data))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query]);

  return <section className="registry-page">
    <header className="page-heading"><div><p className="breadcrumb">Administración / Personas</p><h1>Historial de reportantes</h1><p>Personas identificadas al emitir solicitudes sin crear una cuenta de acceso.</p></div></header>
    <article className="data-panel"><header className="data-panel-header"><div><UsersThree size={24} /><div><h2>Registro de reportantes</h2><p>El DNI y el código de trabajador se conservan solo para trazabilidad administrativa.</p></div></div></header>
      <label className="filter-search"><MagnifyingGlass size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, DNI o código" /></label>
      {loading ? <div className="loading-panel">Cargando registro…</div> : !items.length ? <div className="empty-state">No hay reportantes que coincidan con la búsqueda.</div> : <div className="responsive-table"><table><thead><tr><th>Reportante</th><th>DNI</th><th>Códigos registrados</th><th>Reportes</th><th>Último reporte</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.full_name}</strong><small>{item.email || "Sin correo"}</small></td><td>{item.dni}</td><td>{item.workerCodes.join(", ")}</td><td>{item.reportsCount}</td><td>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(item.lastReportedAt))}</td></tr>)}</tbody></table></div>}
    </article>
  </section>;
}
