import {
  Funnel,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  requestPriorityLabels,
  requestStatusLabels,
  requestTypeLabels,
  type RequestStatus,
} from "@/modules/incidents/incidentModel";

import {
  listWorkRequests,
  WORK_REQUESTS_UPDATED_EVENT,
} from "@/modules/incidents/incidentRepository";

const statusClass: Record<RequestStatus, string> = {
  PENDIENTE: "status-warning",
  EN_EVALUACION: "status-neutral",
  APROBADA: "status-success",
  RECHAZADA: "status-error",
  CONVERTIDA_EN_OT: "status-success",
};

export function IncidentListPage() {
  const [search, setSearch] = useState("");
  const [allRequests, setAllRequests] = useState(listWorkRequests);

  useEffect(() => {
    function refreshRequests() {
      setAllRequests(listWorkRequests());
    }

    window.addEventListener(
      WORK_REQUESTS_UPDATED_EVENT,
      refreshRequests,
    );

    return () => {
      window.removeEventListener(
        WORK_REQUESTS_UPDATED_EVENT,
        refreshRequests,
      );
    };
  }, []);

  const requests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return allRequests;
    }

    return allRequests.filter((request) => {
      const searchableText = [
        request.code,
        request.requesterName,
        request.description,
        request.zone,
        request.building,
        request.area,
        request.room,
        requestTypeLabels[request.requestType],
        requestPriorityLabels[request.requesterPriority],
        requestStatusLabels[request.status],
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [search, allRequests]);

  const pendingCount = allRequests.filter(
    (request) => request.status === "PENDIENTE",
  ).length;

  const evaluatingCount = allRequests.filter(
    (request) => request.status === "EN_EVALUACION",
  ).length;

  const urgentCount = allRequests.filter(
    (request) =>
      request.requesterPriority === "URGENTE" ||
      request.requesterPriority === "EMERGENCIA",
  ).length;

  const approvedCount = allRequests.filter(
    (request) =>
      request.status === "APROBADA" ||
      request.status === "CONVERTIDA_EN_OT",
  ).length;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            Mantenimiento / Solicitudes
          </p>

          <h1>Solicitudes de trabajo</h1>

          <p>
            Registra, consulta y realiza seguimiento a las solicitudes de
            mantenimiento.
          </p>
        </div>

        <Link
          className="button button-primary"
          to="/incidencias/nueva"
        >
          <Plus size={19} weight="bold" />
          Nueva solicitud
        </Link>
      </div>

      <div className="metrics-grid">
        <article>
          <span>Pendientes</span>
          <strong>{pendingCount}</strong>
          <small>Esperan revisión del administrador</small>
        </article>

        <article>
          <span>En evaluación</span>
          <strong>{evaluatingCount}</strong>
          <small>Actualmente en proceso de revisión</small>
        </article>

        <article>
          <span>Urgentes o emergencias</span>
          <strong>{urgentCount}</strong>
          <small>Requieren atención prioritaria</small>
        </article>

        <article>
          <span>Aprobadas</span>
          <strong>{approvedCount}</strong>
          <small>
            Listas o convertidas en orden de trabajo
          </small>
        </article>
      </div>

      <div className="data-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <MagnifyingGlass size={19} />

            <input
              aria-label="Buscar solicitudes"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar por código, solicitante, ubicación o descripción"
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
                <th>Código</th>
                <th>Solicitante</th>
                <th>Solicitud</th>
                <th>Ubicación</th>
                <th>Prioridad</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">
                    Acciones
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.code}</strong>
                  </td>

                  <td>{request.requesterName}</td>

                  <td>
                    <strong>
                      {
                        requestTypeLabels[
                          request.requestType
                        ]
                      }
                    </strong>

                    <br />

                    <small>{request.description}</small>
                  </td>

                  <td>
                    {request.building}

                    <br />

                    <small>
                      {request.area} / {request.room}
                    </small>
                  </td>

                  <td>
                    {
                      requestPriorityLabels[
                        request.requesterPriority
                      ]
                    }
                  </td>

                  <td>
                    {new Intl.DateTimeFormat("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(request.reportedAt))}
                  </td>

                  <td>
                    <span
                      className={`status ${
                        statusClass[request.status]
                      }`}
                    >
                      {requestStatusLabels[request.status]}
                    </span>
                  </td>

                  <td>
                    <Link
                      className="table-action"
                      to={`/incidencias/${request.id}`}
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}

              {!requests.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="empty-row"
                  >
                    No encontramos solicitudes con esos
                    criterios.
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