import { CaretRight, Package, WarningCircle } from "@phosphor-icons/react";
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
import { listRetirementRequests } from "@/modules/lifecycle/lifecycleRepository";
import {
  disposalLabels,
  retirementStatusLabels,
  type RetirementRequest,
  type RetirementStatus,
} from "@/modules/lifecycle/types";

const FILTER_KEYS = [
  "q",
  "status",
  "diagnosis",
  "recommendation",
  "requestedBy",
  "supervisor",
  "cost",
  "from",
  "to",
] as const;

const diagnosisLabels: Record<string, string> = {
  NO_REPARABLE: "No reparable",
  REPAIR_NOT_VIABLE: "Reparación no viable",
  REPARABLE: "Reparable",
};

const costLabels: Record<string, string> = {
  above: "Reparación supera el valor actual",
  within: "Reparación no supera el valor actual",
};

const statusClass: Record<RetirementStatus, string> = {
  PENDIENTE: "status-warning",
  EN_EVALUACION: "status-neutral",
  APROBADA: "status-success",
  RECHAZADA: "status-error",
  SUBSANACION: "status-warning",
  PENDIENTE_DISPOSICION: "status-warning",
  CERRADA: "status-success",
};

export function RetirementRequestListPage() {
  const [requests, setRequests] = useState<RetirementRequest[]>([]);
  const [loadError, setLoadError] = useState("");
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  useEffect(() => {
    listRetirementRequests()
      .then(setRequests)
      .catch(() => setLoadError("No se pudieron cargar las solicitudes."));
  }, []);

  const statusOptions = useMemo(
    () =>
      buildFilterOptions(
        requests.map((item) => item.status),
        retirementStatusLabels,
      ),
    [requests],
  );
  const diagnosisOptions = useMemo(
    () =>
      buildFilterOptions(
        requests.map((item) => item.diagnosisResult),
        diagnosisLabels,
      ),
    [requests],
  );
  const recommendationOptions = useMemo(
    () =>
      buildFilterOptions(
        requests.map((item) => item.recommendation),
        disposalLabels,
      ),
    [requests],
  );
  const requestedByOptions = useMemo(
    () => buildFilterOptions(requests.map((item) => item.requestedBy)),
    [requests],
  );
  const supervisorOptions = useMemo(
    () => buildFilterOptions(requests.map((item) => item.supervisorName)),
    [requests],
  );

  const filtered = useMemo(() => {
    const query = values.q.toLocaleLowerCase("es").trim();

    return requests.filter((item) => {
      const searchable = [
        item.code,
        item.assetCode,
        item.assetName,
        item.workOrderCode,
        item.requestedBy,
        item.supervisorName,
        item.technicalJustification,
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      const costMatches =
        !values.cost ||
        (values.cost === "above"
          ? item.estimatedRepairCost > item.estimatedCurrentValue
          : item.estimatedRepairCost <= item.estimatedCurrentValue);

      return (
        (!query || searchable.includes(query)) &&
        (!values.status || item.status === values.status) &&
        (!values.diagnosis || item.diagnosisResult === values.diagnosis) &&
        (!values.recommendation || item.recommendation === values.recommendation) &&
        (!values.requestedBy || item.requestedBy === values.requestedBy) &&
        (!values.supervisor || item.supervisorName === values.supervisor) &&
        costMatches &&
        isDateInRange(item.createdAt, values.from, values.to)
      );
    });
  }, [requests, values]);

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
      value: labelFor(values.status, retirementStatusLabels),
      onRemove: () => setValue("status", ""),
    });
  }
  if (values.diagnosis) {
    activeFilters.push({
      key: "diagnosis",
      label: "Diagnóstico",
      value: labelFor(values.diagnosis, diagnosisLabels),
      onRemove: () => setValue("diagnosis", ""),
    });
  }
  if (values.recommendation) {
    activeFilters.push({
      key: "recommendation",
      label: "Recomendación",
      value: labelFor(values.recommendation, disposalLabels),
      onRemove: () => setValue("recommendation", ""),
    });
  }
  if (values.requestedBy) {
    activeFilters.push({
      key: "requestedBy",
      label: "Solicitado por",
      value: values.requestedBy,
      onRemove: () => setValue("requestedBy", ""),
    });
  }
  if (values.supervisor) {
    activeFilters.push({
      key: "supervisor",
      label: "Supervisor",
      value: values.supervisor,
      onRemove: () => setValue("supervisor", ""),
    });
  }
  if (values.cost) {
    activeFilters.push({
      key: "cost",
      label: "Viabilidad económica",
      value: labelFor(values.cost, costLabels),
      onRemove: () => setValue("cost", ""),
    });
  }
  if (values.from) {
    activeFilters.push({
      key: "from",
      label: "Creada desde",
      value: values.from,
      onRemove: () => setValue("from", ""),
    });
  }
  if (values.to) {
    activeFilters.push({
      key: "to",
      label: "Creada hasta",
      value: values.to,
      onRemove: () => setValue("to", ""),
    });
  }

  const count = (value: RetirementStatus) =>
    requests.filter((item) => item.status === value).length;

  return (
    <section className="lifecycle-page retirement-list-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Ciclo de vida / Bajas</p>
          <h1>Solicitudes de baja</h1>
          <p>Evalúa expedientes técnicos y controla la disposición final de los bienes.</p>
        </div>
      </div>

      <div className="lifecycle-metrics">
        <article>
          <span>Pendientes</span>
          <strong>{count("PENDIENTE")}</strong>
        </article>
        <article>
          <span>En evaluación</span>
          <strong>{count("EN_EVALUACION")}</strong>
        </article>
        <article>
          <span>Por disponer</span>
          <strong>{count("PENDIENTE_DISPOSICION")}</strong>
        </article>
        <article>
          <span>Cerradas</span>
          <strong>{count("CERRADA")}</strong>
        </article>
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Consultar expedientes"
          description="Refina por diagnóstico, disposición, responsables y viabilidad económica."
          searchLabel="Buscar solicitudes de baja"
          searchPlaceholder="Solicitud, bien, OT, solicitante o justificación técnica"
          searchValue={values.q}
          onSearchChange={(value) => setValue("q", value)}
          resultCount={filtered.length}
          totalCount={requests.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            {
              key: "pending",
              label: "Pendientes",
              count: count("PENDIENTE"),
              active: values.status === "PENDIENTE",
              onSelect: () => setValue("status", values.status === "PENDIENTE" ? "" : "PENDIENTE"),
            },
            {
              key: "correction",
              label: "Requieren subsanación",
              count: count("SUBSANACION"),
              active: values.status === "SUBSANACION",
              onSelect: () =>
                setValue("status", values.status === "SUBSANACION" ? "" : "SUBSANACION"),
            },
            {
              key: "disposal",
              label: "Por disponer",
              count: count("PENDIENTE_DISPOSICION"),
              active: values.status === "PENDIENTE_DISPOSICION",
              onSelect: () =>
                setValue(
                  "status",
                  values.status === "PENDIENTE_DISPOSICION" ? "" : "PENDIENTE_DISPOSICION",
                ),
            },
          ]}
        >
          <FilterSelect
            label="Estado del expediente"
            value={values.status}
            onChange={(value) => setValue("status", value)}
            options={statusOptions}
            allLabel="Todos los estados"
          />
          <FilterSelect
            label="Resultado del diagnóstico"
            value={values.diagnosis}
            onChange={(value) => setValue("diagnosis", value)}
            options={diagnosisOptions}
            allLabel="Todos los diagnósticos"
          />
          <FilterSelect
            label="Disposición recomendada"
            value={values.recommendation}
            onChange={(value) => setValue("recommendation", value)}
            options={recommendationOptions}
            allLabel="Todas las recomendaciones"
          />
          <FilterSelect
            label="Solicitado por"
            value={values.requestedBy}
            onChange={(value) => setValue("requestedBy", value)}
            options={requestedByOptions}
            allLabel="Todos los solicitantes"
          />
          <FilterSelect
            label="Supervisor"
            value={values.supervisor}
            onChange={(value) => setValue("supervisor", value)}
            options={supervisorOptions}
            allLabel="Todos los supervisores"
          />
          <FilterSelect
            label="Relación costo / valor"
            value={values.cost}
            onChange={(value) => setValue("cost", value)}
            options={[
              { value: "above", label: costLabels.above },
              { value: "within", label: costLabels.within },
            ]}
            allLabel="Cualquier relación"
          />
          <FilterDate
            label="Creada desde"
            value={values.from}
            max={values.to || undefined}
            onChange={(value) => setValue("from", value)}
          />
          <FilterDate
            label="Creada hasta"
            value={values.to}
            min={values.from || undefined}
            onChange={(value) => setValue("to", value)}
          />
        </ListFilterPanel>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Solicitud</th>
                <th>Bien</th>
                <th>Diagnóstico</th>
                <th>Costos</th>
                <th>Recomendación</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.code}</strong>
                    <small>{new Date(item.createdAt).toLocaleDateString("es-PE")}</small>
                  </td>
                  <td>
                    <strong>{item.assetCode}</strong>
                    <small>{item.assetName}</small>
                  </td>
                  <td>{diagnosisLabels[item.diagnosisResult]}</td>
                  <td>
                    <strong>S/ {item.estimatedRepairCost.toFixed(2)}</strong>
                    <small>Valor: S/ {item.estimatedCurrentValue.toFixed(2)}</small>
                  </td>
                  <td>{disposalLabels[item.recommendation]}</td>
                  <td>
                    <span className={`status ${statusClass[item.status]}`}>
                      {retirementStatusLabels[item.status]}
                    </span>
                  </td>
                  <td>
                    <Link className="table-action" to={`/bienes/ciclo-vida/bajas/${item.id}`}>
                      Evaluar <CaretRight />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lifecycle-mobile-list">
          {filtered.map((item) => (
            <Link key={item.id} to={`/bienes/ciclo-vida/bajas/${item.id}`}>
              <header>
                <Package />
                <strong>{item.assetCode}</strong>
                <span className={`status ${statusClass[item.status]}`}>
                  {retirementStatusLabels[item.status]}
                </span>
              </header>
              <h2>{item.assetName}</h2>
              <p>
                {item.code} · {disposalLabels[item.recommendation]}
              </p>
              <CaretRight />
            </Link>
          ))}
        </div>

        {!filtered.length && (
          <div className="lifecycle-empty">
            <WarningCircle />
            <strong>{loadError || "No hay solicitudes con esos criterios"}</strong>
            <p>
              {loadError
                ? "Verifica la conexión con el servidor."
                : "Ajusta o restablece los filtros para ampliar la búsqueda."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
