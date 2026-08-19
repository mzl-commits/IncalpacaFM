import { useEffect, useState } from "react";

import { ListFilterPanel } from "@/components/filters/ListFilterPanel";
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

  return (
    <section className="registry-page">
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Personas</p>
          <h1>Usuarios que reportaron</h1>
          <p>Personas que han registrado solicitudes y reportes en la plataforma.</p>
        </div>
      </header>
      
      <ListFilterPanel
          title="Usuarios que reportaron"
        description="El DNI y el código de trabajador se conservan solo para trazabilidad administrativa."
        searchLabel="Búsqueda"
        searchPlaceholder="Buscar por nombre, DNI o código"
        searchValue={query}
        onSearchChange={setQuery}
        resultCount={items.length}
        totalCount={items.length}
        activeFilters={[]}
        onClear={() => setQuery("")}
      >
        <></>
      </ListFilterPanel>

      <article className="data-panel">
        {loading ? (
          <div className="loading-panel">Cargando registro…</div>
        ) : !items.length ? (
          <div className="empty-state">No hay reportantes que coincidan con la búsqueda.</div>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Usuario que reportó</th>
                  <th>DNI</th>
                  <th>Códigos registrados</th>
                  <th>Reportes</th>
                  <th>Último reporte</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.full_name}</strong>
                      <small>{item.email || "Sin correo"}</small>
                    </td>
                    <td>{item.dni}</td>
                    <td>{item.workerCodes.join(", ")}</td>
                    <td>{item.reportsCount}</td>
                    <td>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(item.lastReportedAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
