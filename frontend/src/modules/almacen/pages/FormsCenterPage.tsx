import { ClipboardText, ListChecks, PencilSimple, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listPlantillasCriterios } from "@/modules/almacen/inspeccionRepository";

export function FormsCenterPage() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["plantillas-criterios"],
    queryFn: listPlantillasCriterios,
  });
  const questions = templates.reduce((total, template) => total + template.criterios.length, 0);

  return (
    <section className="page-shell" style={{ maxWidth: 1240 }}>
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Formularios</p>
          <h1>Centro de formularios</h1>
          <p>Selecciona el flujo que deseas administrar. Cada formulario conserva sus preguntas y cambios de forma independiente.</p>
        </div>
        <Link className="button button-primary" to="/administracion/formularios/inspecciones"><Plus size={18} />Nuevo formulario</Link>
      </header>

      <section className="data-panel" aria-labelledby="forms-summary-title">
        <header><h2 id="forms-summary-title">Formularios configurables</h2><p>Los cambios aplican a registros nuevos; los expedientes ya emitidos mantienen su evidencia original.</p></header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
          <div className="stat-card"><small>Formularios activos</small><strong>{isLoading ? "…" : templates.length}</strong><span>Plantillas de inspección</span></div>
          <div className="stat-card"><small>Preguntas configuradas</small><strong>{isLoading ? "…" : questions}</strong><span>Criterios editables</span></div>
          <div className="stat-card"><small>Áreas conectadas</small><strong>1</strong><span>Almacén e inspecciones</span></div>
        </div>
      </section>

      <section style={{ marginTop: 22 }} aria-labelledby="form-areas-title">
        <h2 id="form-areas-title">Selecciona un formulario</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(285px, 1fr))", gap: 18, marginTop: 14 }}>
          <article className="data-panel">
            <ListChecks size={30} weight="duotone" />
            <h3 style={{ marginTop: 12 }}>Inspecciones de materiales</h3>
            <p>Gestiona las plantillas que usan inspectores y almacén: crea preguntas, cambia el orden o retira criterios obsoletos.</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18 }}><span className="status status-success">Configurable</span><Link className="button button-secondary" to="/administracion/formularios/inspecciones"><PencilSimple size={17} />Administrar</Link></div>
          </article>
          <article className="data-panel">
            <ClipboardText size={30} weight="duotone" />
            <h3 style={{ marginTop: 12 }}>Registro de cambios</h3>
            <p>Las respuestas guardadas no se reescriben al editar un formulario. Esto preserva la trazabilidad de inspecciones ya realizadas.</p>
            <span className="status" style={{ marginTop: 18 }}>Historial protegido</span>
          </article>
        </div>
      </section>
    </section>
  );
}
