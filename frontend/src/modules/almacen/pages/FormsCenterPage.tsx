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
    <section className="page-shell forms-center-page">
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Formularios</p>
          <h1>Centro de formularios</h1>
          <p>Selecciona el flujo que deseas administrar. Cada formulario conserva sus preguntas y cambios de forma independiente.</p>
        </div>
        <Link className="button button-primary" to="/administracion/formularios/inspecciones"><Plus size={18} />Nuevo formulario</Link>
      </header>

      <section className="data-panel forms-summary" aria-labelledby="forms-summary-title">
        <header className="forms-summary-header"><h2 id="forms-summary-title">Formularios configurables</h2><p>Los cambios aplican a registros nuevos; los expedientes ya emitidos mantienen su evidencia original.</p></header>
        <div className="forms-summary-metrics">
          <div className="stat-card"><small>Formularios activos</small><strong>{isLoading ? "…" : templates.length}</strong><span>Plantillas de inspección</span></div>
          <div className="stat-card"><small>Preguntas configuradas</small><strong>{isLoading ? "…" : questions}</strong><span>Criterios editables</span></div>
          <div className="stat-card"><small>Áreas conectadas</small><strong>1</strong><span>Almacén e inspecciones</span></div>
        </div>
      </section>

      <section className="forms-directory" aria-labelledby="form-areas-title">
        <h2 id="form-areas-title">Selecciona un formulario</h2>
        <div className="forms-flow-grid">
          <article className="data-panel forms-flow-card">
            <header><ListChecks size={26} weight="duotone" /><div><h3>Inspecciones de materiales</h3><p>Plantillas para la evaluación de materiales.</p></div></header>
            <p>Gestiona las plantillas que usan inspectores y almacén: crea preguntas, cambia el orden o retira criterios obsoletos.</p>
            <footer><span className="status status-success">Configurable</span><Link className="button button-secondary" to="/administracion/formularios/inspecciones"><PencilSimple size={17} />Administrar</Link></footer>
          </article>
          <article className="data-panel forms-flow-card forms-flow-card--info">
            <header><ClipboardText size={26} weight="duotone" /><div><h3>Registro de cambios</h3><p>Protección de la evidencia emitida.</p></div></header>
            <p>Las respuestas guardadas no se reescriben al editar un formulario. Esto preserva la trazabilidad de inspecciones ya realizadas.</p>
            <footer><span className="status">Historial protegido</span></footer>
          </article>
        </div>
      </section>
    </section>
  );
}
