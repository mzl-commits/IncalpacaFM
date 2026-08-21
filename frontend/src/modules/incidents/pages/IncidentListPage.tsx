import { CaretRight, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  FilterDate,
  FilterSelect,
  ListFilterPanel,
  type ActiveFilter,
} from "@/components/filters/ListFilterPanel";
import {
  buildFilterOptions,
  isDateInRange,
  labelFor,
  useListFilterParams,
} from "@/components/filters/filterUtils";
import {
  requestPriorityLabels,
  requestStatusLabels,
  requestTypeLabels,
  type RequestStatus,
} from "@/modules/incidents/incidentModel";
import {
  getWorkRequestAssetDisplayCode,
  listWorkRequests,
  WORK_REQUESTS_UPDATED_EVENT,
} from "@/modules/incidents/incidentRepository";

const FILTER_KEYS = [
  "q",
  "status",
  "type",
  "priority",
  "building",
  "project",
  "evidence",
  "from",
  "to",
] as const;

const projectLabels: Record<string, string> = {
  yes: "Solo proyectos",
  no: "Excluir proyectos",
};

const evidenceLabels: Record<string, string> = {
  with: "Con evidencias",
  without: "Sin evidencias",
};

const statusClass: Record<RequestStatus, string> = {
  PENDIENTE: "status-warning",
  EN_EVALUACION: "status-neutral",
  APROBADA: "status-success",
  RECHAZADA: "status-error",
  CONVERTIDA_EN_OT: "status-success",
};

export function IncidentListPage() {
  const [allRequests, setAllRequests] = useState<Awaited<ReturnType<typeof listWorkRequests>>>([]);
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  useEffect(() => {
    let active = true;
    async function refreshRequests() {
      const requests = await listWorkRequests();
      if (active) setAllRequests(requests);
    }

    void refreshRequests();
    window.addEventListener(WORK_REQUESTS_UPDATED_EVENT, refreshRequests);

    return () => {
      active = false;
      window.removeEventListener(WORK_REQUESTS_UPDATED_EVENT, refreshRequests);
    };
  }, []);

  const statusOptions = useMemo(
    () =>
      buildFilterOptions(
        allRequests.map((request) => request.status),
        requestStatusLabels,
      ),
    [allRequests],
  );
  const typeOptions = useMemo(
    () =>
      buildFilterOptions(
        allRequests.map((request) => request.requestType),
        requestTypeLabels,
      ),
    [allRequests],
  );
  const priorityOptions = useMemo(
    () =>
      buildFilterOptions(
        allRequests.map((request) => request.requesterPriority),
        requestPriorityLabels,
      ),
    [allRequests],
  );
  const buildingOptions = useMemo(
    () => buildFilterOptions(allRequests.map((request) => request.building)),
    [allRequests],
  );

  const requests = useMemo(() => {
    const query = values.q.toLocaleLowerCase("es").trim();

    return allRequests.filter((request) => {
      const searchable = [
        request.code,
        getWorkRequestAssetDisplayCode(request),
        request.requesterName,
        request.requesterEmail,
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
        .toLocaleLowerCase("es");

      const projectMatches =
        !values.project || (values.project === "yes" ? request.project : !request.project);
      const evidenceMatches =
        !values.evidence ||
        (values.evidence === "with" ? request.evidence.length > 0 : request.evidence.length === 0);

      return (
        (!query || searchable.includes(query)) &&
        (!values.status || request.status === values.status) &&
        (!values.type || request.requestType === values.type) &&
        (!values.priority || request.requesterPriority === values.priority) &&
        (!values.building || request.building === values.building) &&
        projectMatches &&
        evidenceMatches &&
        isDateInRange(request.reportedAt, values.from, values.to)
      );
    });
  }, [allRequests, values]);

  const activeFilters: ActiveFilter[] = [];
  if (values.q) {
    activeFilters.push({
      key: "q",
      label: "Búsqueda",
      value: values.q,
      onRemove: () => setValue("q", ""),
    });
  }
  if (values.status) {
    activeFilters.push({
      key: "status",
      label: "Estado",
      value: labelFor(values.status, requestStatusLabels),
      onRemove: () => setValue("status", ""),
    });
  }
  if (values.type) {
    activeFilters.push({
      key: "type",
      label: "Tipo",
      value: labelFor(values.type, requestTypeLabels),
      onRemove: () => setValue("type", ""),
    });
  }
  if (values.priority) {
    activeFilters.push({
      key: "priority",
      label: "Prioridad",
      value: labelFor(values.priority, requestPriorityLabels),
      onRemove: () => setValue("priority", ""),
    });
  }
  if (values.building) {
    activeFilters.push({
      key: "building",
      label: "Edificio",
      value: values.building,
      onRemove: () => setValue("building", ""),
    });
  }
  if (values.project) {
    activeFilters.push({
      key: "project",
      label: "Proyecto",
      value: labelFor(values.project, projectLabels),
      onRemove: () => setValue("project", ""),
    });
  }
  if (values.evidence) {
    activeFilters.push({
      key: "evidence",
      label: "Evidencias",
      value: labelFor(values.evidence, evidenceLabels),
      onRemove: () => setValue("evidence", ""),
    });
  }
  if (values.from) {
    activeFilters.push({
      key: "from",
      label: "Reportada desde",
      value: values.from,
      onRemove: () => setValue("from", ""),
    });
  }
  if (values.to) {
    activeFilters.push({
      key: "to",
      label: "Reportada hasta",
      value: values.to,
      onRemove: () => setValue("to", ""),
    });
  }

  const pendingCount = allRequests.filter((request) => request.status === "PENDIENTE").length;
  const evaluatingCount = allRequests.filter(
    (request) => request.status === "EN_EVALUACION",
  ).length;
  const urgentCount = allRequests.filter(
    (request) =>
      request.requesterPriority === "URGENTE" || request.requesterPriority === "EMERGENCIA",
  ).length;
  const emergencyCount = allRequests.filter(
    (request) => request.requesterPriority === "EMERGENCIA",
  ).length;
  const approvedCount = allRequests.filter(
    (request) => request.status === "APROBADA" || request.status === "CONVERTIDA_EN_OT",
  ).length;

  return (
    <section className="incidents-list-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Solicitudes</p>
          <h1>Solicitudes de trabajo</h1>
          <p>Registra, consulta y realiza seguimiento a las solicitudes de mantenimiento.</p>
        </div>
        <Link className="button button-primary" to="/incidencias/nueva">
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
          <small>Listas o convertidas en orden de trabajo</small>
        </article>
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Refinar solicitudes"
          description="Segmenta por estado, prioridad, tipo, ubicación y evidencia."
          searchLabel="Buscar solicitudes"
          searchPlaceholder="Código, usuario, correo, ubicación o descripción"
          searchValue={values.q}
          onSearchChange={(value) => setValue("q", value)}
          resultCount={requests.length}
          totalCount={allRequests.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            {
              key: "pending",
              label: "Pendientes",
              count: pendingCount,
              active: values.status === "PENDIENTE",
              onSelect: () => setValue("status", values.status === "PENDIENTE" ? "" : "PENDIENTE"),
            },
            {
              key: "urgent",
              label: "Urgentes",
              count: allRequests.filter((request) => request.requesterPriority === "URGENTE")
                .length,
              active: values.priority === "URGENTE",
              onSelect: () => setValue("priority", values.priority === "URGENTE" ? "" : "URGENTE"),
            },
            {
              key: "emergency",
              label: "Emergencias",
              count: emergencyCount,
              active: values.priority === "EMERGENCIA",
              onSelect: () =>
                setValue("priority", values.priority === "EMERGENCIA" ? "" : "EMERGENCIA"),
            },
          ]}
        >
          <FilterSelect
            label="Estado"
            value={values.status}
            onChange={(value) => setValue("status", value)}
            options={statusOptions}
            allLabel="Todos los estados"
          />
          <FilterSelect
            label="Tipo de solicitud"
            value={values.type}
            onChange={(value) => setValue("type", value)}
            options={typeOptions}
            allLabel="Todos los tipos"
          />
          <FilterSelect
            label="Prioridad"
            value={values.priority}
            onChange={(value) => setValue("priority", value)}
            options={priorityOptions}
            allLabel="Todas las prioridades"
          />
          <FilterSelect
            label="Edificio"
            value={values.building}
            onChange={(value) => setValue("building", value)}
            options={buildingOptions}
            allLabel="Todos los edificios"
          />
          <FilterSelect
            label="Tratamiento como proyecto"
            value={values.project}
            onChange={(value) => setValue("project", value)}
            options={[
              { value: "yes", label: projectLabels.yes },
              { value: "no", label: projectLabels.no },
            ]}
            allLabel="Proyectos y solicitudes"
          />
          <FilterSelect
            label="Evidencias"
            value={values.evidence}
            onChange={(value) => setValue("evidence", value)}
            options={[
              { value: "with", label: evidenceLabels.with },
              { value: "without", label: evidenceLabels.without },
            ]}
            allLabel="Con o sin evidencias"
          />
          <FilterDate
            label="Reportada desde"
            value={values.from}
            max={values.to || undefined}
            onChange={(value) => setValue("from", value)}
          />
          <FilterDate
            label="Reportada hasta"
            value={values.to}
            min={values.from || undefined}
            onChange={(value) => setValue("to", value)}
          />
        </ListFilterPanel>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Usuario</th>
                <th>Solicitud</th>
                <th>Ubicación</th>
                <th>Prioridad</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link to={`/incidencias/${request.id}`}><strong>{request.code}</strong></Link>
                  </td>
                  <td>{request.requesterName}</td>
                  <td>
                    <strong>{requestTypeLabels[request.requestType]}</strong>
                    <br />
                    <small>{request.description}</small>
                    {getWorkRequestAssetDisplayCode(request) && (
                      <><br /><small>Bien: {getWorkRequestAssetDisplayCode(request)}</small></>
                    )}
                  </td>
                  <td>
                    {request.building}
                    <br />
                    <small>
                      {request.area} / {request.room}
                    </small>
                  </td>
                  <td>{requestPriorityLabels[request.requesterPriority]}</td>
                  <td>
                    {new Intl.DateTimeFormat("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(request.reportedAt))}
                  </td>
                  <td>
                    <span className={`status ${statusClass[request.status]}`}>
                      {requestStatusLabels[request.status]}
                    </span>
                  </td>
                  <td>
                    <Link className="table-action" to={`/incidencias/${request.id}`}>
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}

              {!requests.length && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    No encontramos solicitudes con esos criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="operational-mobile-list hidden max-[720px]:grid gap-2 p-3"
          aria-label="Solicitudes de trabajo"
        >
          {requests.map((request) => (
            <Link
              key={request.id}
              to={`/incidencias/${request.id}`}
              className="grid min-h-11 gap-3 rounded border border-slate-300 bg-white p-4 text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600"
            >
              <span className="flex items-start justify-between gap-3">
                <strong className="text-sm">{request.code}</strong>
                <span className={`status ${statusClass[request.status]}`}>
                  {requestStatusLabels[request.status]}
                </span>
              </span>
              <span className="grid gap-1">
                <strong className="text-sm">{requestTypeLabels[request.requestType]}</strong>
                <small className="line-clamp-2 text-xs text-slate-600">{request.description}</small>
                {getWorkRequestAssetDisplayCode(request) && (
                  <small className="text-xs text-slate-600">Bien: {getWorkRequestAssetDisplayCode(request)}</small>
                )}
              </span>
              <span className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <span>
                  <strong className="block text-slate-800">Ubicación</strong>
                  {request.building} / {request.room}
                </span>
                <span>
                  <strong className="block text-slate-800">Prioridad</strong>
                  {requestPriorityLabels[request.requesterPriority]}
                </span>
              </span>
              <span className="flex min-h-11 items-center justify-end gap-1 text-sm font-semibold text-zinc-800">
                Ver detalle
                <CaretRight size={18} aria-hidden="true" />
              </span>
            </Link>
          ))}

          {!requests.length && (
            <p className="empty-row rounded border border-slate-300 bg-white">
              No encontramos solicitudes con esos criterios.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
