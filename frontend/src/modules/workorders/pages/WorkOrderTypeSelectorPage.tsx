import { ArrowLeft, ArrowRight, CalendarBlank, ClipboardText, Package, Wrench } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { useAuth } from "@/modules/accounts/AuthContext";

export function WorkOrderTypeSelectorPage() {
  const { user } = useAuth();
  const backTarget = user?.role === "USUARIO" ? "/incidencias" : "/ordenes-trabajo";

  return (
    <section className="order-type-selector-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Nueva orden</p>
          <h1>Crear orden</h1>
          <p>Elige el tipo de orden según cómo se atenderá el trabajo.</p>
        </div>
        <Link className="button button-secondary" to={backTarget}>
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <div className="order-type-grid">
        <Link className="order-type-card is-enabled is-ot" to="/ordenes-trabajo/nueva/ot">
          <span className="order-type-icon">
            <Wrench size={28} />
          </span>
          <span className="order-type-code">OT</span>
          <strong>Orden de trabajo</strong>
          <small>
            Para mantenimiento, reparaciones o atención técnica interna.
          </small>
          <b>
            Continuar con OT
            <ArrowRight size={17} />
          </b>
        </Link>

        <Link className="order-type-card is-enabled is-ol" to="/ordenes-trabajo/nueva/ol">
          <span className="order-type-icon">
            <ClipboardText size={28} />
          </span>
          <span className="order-type-code">OL</span>
          <strong>Orden de limpieza</strong>
          <small>
            Para una limpieza puntual en un ambiente específico.
          </small>
          <b>
            OL puntual
            <ArrowRight size={17} />
          </b>
        </Link>


        <Link className="order-type-card is-enabled is-ol-routine" to="/ordenes-trabajo/nueva/ol-rutinaria">
          <span className="order-type-icon">
            <CalendarBlank size={28} />
          </span>
          <span className="order-type-code">OL</span>
          <strong>Limpieza rutinaria</strong>
          <small>
            Para generar varias OL por días, hora y rango de fechas.
          </small>
          <b>
            OL rutinaria
            <ArrowRight size={17} />
          </b>
        </Link>
        <Link className="order-type-card is-enabled is-os" to="/ordenes-trabajo/nueva/os">
          <span className="order-type-icon">
            <Package size={28} />
          </span>
          <span className="order-type-code">OS</span>
          <strong>Orden de servicio</strong>
          <small>
            Para registrar proveedor, documento y monto de un servicio externo.
          </small>
          <b>
            Continuar con OS
            <ArrowRight size={17} />
          </b>
        </Link>
      </div>
    </section>
  );
}
