import {
  Funnel,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  adminPriorityLabels,
  specialtyLabels,
  workOrderStatusLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import {
  listWorkOrders,
  WORK_ORDERS_UPDATED_EVENT,
} from "@/modules/workorders/workOrderRepository";

const statusClass: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "status-neutral",
  ASIGNADA: "status-warning",
  EN_PROCESO: "status-warning",
  PENDIENTE_DE_SUPERVISION: "status-neutral",
  REPROCESO: "status-error",
  APROBADA_POR_SUPERVISOR: "status-success",
  CERRADA: "status-success",
  CANCELADA: "status-error",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function WorkOrderListPage() {
  const [search, setSearch] = useState("");
  const [allWorkOrders, setAllWorkOrders] = useState(listWorkOrders);

  useEffect(() => {
    function refreshWorkOrders() {
      setAllWorkOrders(listWorkOrders());
    }

    window.addEventListener(
      WORK_ORDERS_UPDATED_EVENT,
      refreshWorkOrders,
    );

    return () => {
      window.removeEventListener(
        WORK_ORDERS_UPDATED_EVENT,
        refreshWorkOrders,
      );
    };
  }, []);

  const workOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return allWorkOrders;
    }

    return allWorkOrders.filter((workOrder) => {
      const searchableText = [
        workOrder.code,
        workOrder.requestCode,
        workOrder.operatorName,
        workOrder.supervisorName,
        specialtyLabels[workOrder.specialty],
        adminPriorityLabels[workOrder.adminPriority],
        workOrderStatusLabels[workOrder.status],
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [search, allWorkOrders]);

  const programmedCount = allWorkOrders.filter(
    (workOrder) =>
      workOrder.status === "PROGRAMADA" ||
      workOrder.status === "ASIGNADA",
  ).length;

  const inProgressCount = allWorkOrders.filter(
    (workOrder) => workOrder.status === "EN_PROCESO",
  ).length;

  const pendingSupervisionCount = allWorkOrders.filter(
    (workOrder) =>
      workOrder.status === "PENDIENTE_DE_SUPERVISION",
  ).length;

  const closedCount = allWorkOrders.filter(
    (workOrder) =>
      workOrder.status === "CERRADA" ||
      workOrder.status === "APROBADA_POR_SUPERVISOR",
  ).length;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            Mantenimiento / Órdenes de trabajo
          </p>

          <h1>Órdenes de trabajo</h1>

          <p>
            Consulta la programación, responsables, avance y estado de las
            órdenes generadas.
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <article>
          <span>Programadas o asignadas</span>
          <strong>{programmedCount}</strong>
          <small>Pendientes de iniciar su ejecución</small>
        </article>

        <article>
          <span>En proceso</span>
          <strong>{inProgressCount}</strong>
          <small>Actualmente atendidas por el operario</small>
        </article>

        <article>
          <span>Pendientes de supervisión</span>
          <strong>{pendingSupervisionCount}</strong>
          <small>Esperan revisión del supervisor</small>
        </article>

        <article>
          <span>Aprobadas o cerradas</span>
          <strong>{closedCount}</strong>
          <small>Trabajos finalizados correctamente</small>
        </article>
      </div>

      <div className="data-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <MagnifyingGlass size={19} />

            <input
              aria-label="Buscar órdenes de trabajo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código, solicitud, operario o especialidad"
            />
          </label>

          <button
            className="button button-secondary"
            type="button"
          >
            <Funnel size={18} />
            Filtros
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Solicitud</th>
                <th>Especialidad</th>
                <th>Operario</th>
                <th>Supervisor</th>
                <th>Prioridad</th>
                <th>Programación</th>
                <th>Avance</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td>
                    <strong>{workOrder.code}</strong>
                  </td>

                  <td>{workOrder.requestCode}</td>

                  <td>
                    {specialtyLabels[workOrder.specialty]}
                  </td>

                  <td>{workOrder.operatorName}</td>

                  <td>{workOrder.supervisorName}</td>

                  <td>
                    {adminPriorityLabels[workOrder.adminPriority]}
                  </td>

                  <td>{formatDate(workOrder.scheduledDate)}</td>

                  <td>
                    <strong>
                      {workOrder.progressPercentage} %
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`status ${statusClass[workOrder.status]}`}
                    >
                      {workOrderStatusLabels[workOrder.status]}
                    </span>
                  </td>

                  <td>
                    <Link
                      className="table-action"
                      to={`/ordenes-trabajo/${workOrder.id}`}
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}

              {!workOrders.length && (
                <tr>
                  <td colSpan={10} className="empty-row">
                    No encontramos órdenes de trabajo con esos criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}