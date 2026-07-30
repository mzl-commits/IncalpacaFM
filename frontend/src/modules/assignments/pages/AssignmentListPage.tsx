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
import { listAssignments, type AssignmentRecord } from "@/modules/assignments/assignmentRepository";

const FILTER_KEYS = [
  "q",
  "delivery",
  "status",
  "responsibleType",
  "area",
  "zone",
  "act",
  "from",
  "to",
] as const;

const typeLabel: Record<AssignmentRecord["responsible"]["type"], string> = {
  PERSONA: "Persona",
  AREA: "Área",
  ESPACIO_COMUN: "Espacio común",
};

const deliveryLabel: Record<AssignmentRecord["delivery_status"], string> = {
  ASIGNADO: "Asignado",
  ENTREGADO: "Entregado",
  EN_TRASLADO: "En traslado",
  DEVUELTO: "Devuelto",
};

const assignmentStatusLabel: Record<AssignmentRecord["status"], string> = {
  ACTIVA: "Vigente",
  FINALIZADA: "Finalizada",
  ANULADA: "Anulada",
};

const actFilterLabels: Record<string, string> = {
  with: "Con acta emitida",
  without: "Sin acta emitida",
};

const stateClass = (state: AssignmentRecord["delivery_status"]) =>
  state === "ENTREGADO"
    ? "status-success"
    : state === "DEVUELTO"
      ? "status-neutral"
      : "status-warning";

export function AssignmentListPage() {
  const [items, setItems] = useState<AssignmentRecord[]>([]);
  const [error, setError] = useState("");
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  useEffect(() => {
    listAssignments()
      .then(setItems)
      .catch(() => setError("No se pudieron cargar las asignaciones."));
  }, []);

  const deliveryOptions = useMemo(
    () =>
      buildFilterOptions(
        items.map((item) => item.delivery_status),
        deliveryLabel,
      ),
    [items],
  );
  const statusOptions = useMemo(
    () =>
      buildFilterOptions(
        items.map((item) => item.status),
        assignmentStatusLabel,
      ),
    [items],
  );
  const responsibleTypeOptions = useMemo(
    () =>
      buildFilterOptions(
        items.map((item) => item.responsible.type),
        typeLabel,
      ),
    [items],
  );
  const areaOptions = useMemo(
    () => buildFilterOptions(items.map((item) => item.responsible.area)),
    [items],
  );
  const zoneOptions = useMemo(
    () => buildFilterOptions(items.map((item) => item.location?.zone)),
    [items],
  );

  const filtered = useMemo(() => {
    const query = values.q.toLocaleLowerCase("es").trim();

    return items.filter((item) => {
      const searchable = [
        item.asset.code,
        item.asset.name,
        item.asset.brand,
        item.asset.model,
        item.responsible.name,
        item.responsible.reference,
        item.responsible.area,
        item.location?.zone,
        item.location?.building,
        item.location?.area,
        item.location?.room,
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      const actMatches = !values.act || (values.act === "with" ? Boolean(item.act) : !item.act);

      return (
        (!query || searchable.includes(query)) &&
        (!values.delivery || item.delivery_status === values.delivery) &&
        (!values.status || item.status === values.status) &&
        (!values.responsibleType || item.responsible.type === values.responsibleType) &&
        (!values.area || item.responsible.area === values.area) &&
        (!values.zone || item.location?.zone === values.zone) &&
        actMatches &&
        isDateInRange(item.start_date, values.from, values.to)
      );
    });
  }, [items, values]);

  const activeFilters: ActiveFilter[] = [];
  if (values.q) {
    activeFilters.push({
      key: "q",
      label: "Búsqueda",
      value: values.q,
      onRemove: () => setValue("q", ""),
    });
  }
  if (values.delivery) {
    activeFilters.push({
      key: "delivery",
      label: "Entrega",
      value: labelFor(values.delivery, deliveryLabel),
      onRemove: () => setValue("delivery", ""),
    });
  }
  if (values.status) {
    activeFilters.push({
      key: "status",
      label: "Vigencia",
      value: labelFor(values.status, assignmentStatusLabel),
      onRemove: () => setValue("status", ""),
    });
  }
  if (values.responsibleType) {
    activeFilters.push({
      key: "responsibleType",
      label: "Tipo de responsable",
      value: labelFor(values.responsibleType, typeLabel),
      onRemove: () => setValue("responsibleType", ""),
    });
  }
  if (values.area) {
    activeFilters.push({
      key: "area",
      label: "Área",
      value: values.area,
      onRemove: () => setValue("area", ""),
    });
  }
  if (values.zone) {
    activeFilters.push({
      key: "zone",
      label: "Zona",
      value: values.zone,
      onRemove: () => setValue("zone", ""),
    });
  }
  if (values.act) {
    activeFilters.push({
      key: "act",
      label: "Acta",
      value: labelFor(values.act, actFilterLabels),
      onRemove: () => setValue("act", ""),
    });
  }
  if (values.from) {
    activeFilters.push({
      key: "from",
      label: "Inicio desde",
      value: values.from,
      onRemove: () => setValue("from", ""),
    });
  }
  if (values.to) {
    activeFilters.push({
      key: "to",
      label: "Inicio hasta",
      value: values.to,
      onRemove: () => setValue("to", ""),
    });
  }

  const active = items.filter((item) => item.status === "ACTIVA");
  const pendingDeliveryCount = active.filter((item) => item.delivery_status === "ASIGNADO").length;
  const transferCount = active.filter((item) => item.delivery_status === "EN_TRASLADO").length;
  const historicalCount = items.filter((item) => item.status !== "ACTIVA").length;
  const finalizedCount = items.filter((item) => item.status === "FINALIZADA").length;

  return (
    <section className="assignments-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Asignaciones</p>
          <h1>Asignaciones de bienes</h1>
          <p>Gestiona responsables, entregas y movimientos con trazabilidad completa.</p>
        </div>
        <Link className="button button-primary" to="/asignaciones/nueva">
          <Plus weight="bold" />
          Nueva asignación
        </Link>
      </div>

      <div className="metrics-grid assignment-metrics">
        <article>
          <span>Asignaciones activas</span>
          <strong>{active.length}</strong>
          <small>Con responsable vigente</small>
        </article>
        <article className="metric-pending">
          <span>Pendientes de entrega</span>
          <strong>{pendingDeliveryCount}</strong>
          <small>Requieren acta y firmas</small>
        </article>
        <article className="metric-success">
          <span>Entregados</span>
          <strong>{active.filter((item) => item.delivery_status === "ENTREGADO").length}</strong>
          <small>Acta emitida</small>
        </article>
        <article>
          <span>Históricos</span>
          <strong>{historicalCount}</strong>
          <small>Asignaciones cerradas</small>
        </article>
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Consultar asignaciones"
          description="Cruza entrega, vigencia, responsable, ubicación y periodo."
          searchLabel="Buscar asignaciones"
          searchPlaceholder="Código, bien, responsable, área o ubicación"
          searchValue={values.q}
          onSearchChange={(value) => setValue("q", value)}
          resultCount={filtered.length}
          totalCount={items.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            {
              key: "pending-delivery",
              label: "Pendientes de entrega",
              count: pendingDeliveryCount,
              active: values.delivery === "ASIGNADO",
              onSelect: () =>
                setValue("delivery", values.delivery === "ASIGNADO" ? "" : "ASIGNADO"),
            },
            {
              key: "transfer",
              label: "En traslado",
              count: transferCount,
              active: values.delivery === "EN_TRASLADO",
              onSelect: () =>
                setValue("delivery", values.delivery === "EN_TRASLADO" ? "" : "EN_TRASLADO"),
            },
            {
              key: "historical",
              label: "Finalizadas",
              count: finalizedCount,
              active: values.status === "FINALIZADA",
              onSelect: () =>
                setValue("status", values.status === "FINALIZADA" ? "" : "FINALIZADA"),
            },
          ]}
        >
          <FilterSelect
            label="Estado de entrega"
            value={values.delivery}
            onChange={(value) => setValue("delivery", value)}
            options={deliveryOptions}
            allLabel="Todos los estados"
          />
          <FilterSelect
            label="Vigencia"
            value={values.status}
            onChange={(value) => setValue("status", value)}
            options={statusOptions}
            allLabel="Vigentes e históricas"
          />
          <FilterSelect
            label="Tipo de responsable"
            value={values.responsibleType}
            onChange={(value) => setValue("responsibleType", value)}
            options={responsibleTypeOptions}
            allLabel="Todos los tipos"
          />
          <FilterSelect
            label="Área responsable"
            value={values.area}
            onChange={(value) => setValue("area", value)}
            options={areaOptions}
            allLabel="Todas las áreas"
          />
          <FilterSelect
            label="Zona"
            value={values.zone}
            onChange={(value) => setValue("zone", value)}
            options={zoneOptions}
            allLabel="Todas las zonas"
          />
          <FilterSelect
            label="Acta de entrega"
            value={values.act}
            onChange={(value) => setValue("act", value)}
            options={[
              { value: "with", label: actFilterLabels.with },
              { value: "without", label: actFilterLabels.without },
            ]}
            allLabel="Con o sin acta"
          />
          <FilterDate
            label="Inicio desde"
            value={values.from}
            max={values.to || undefined}
            onChange={(value) => setValue("from", value)}
          />
          <FilterDate
            label="Inicio hasta"
            value={values.to}
            min={values.from || undefined}
            onChange={(value) => setValue("to", value)}
          />
        </ListFilterPanel>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Bien</th>
                <th>Responsable</th>
                <th>Tipo</th>
                <th>Ubicación</th>
                <th>Inicio</th>
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
                    <strong>{item.asset.code}</strong>
                    <small className="cell-subtitle">{item.asset.name}</small>
                  </td>
                  <td>{item.responsible.name}</td>
                  <td>{typeLabel[item.responsible.type]}</td>
                  <td>
                    {item.location
                      ? `${item.location.building} · ${item.location.room}`
                      : "Por confirmar"}
                  </td>
                  <td>{new Intl.DateTimeFormat("es-PE").format(new Date(item.start_date))}</td>
                  <td>
                    <span className={`status ${stateClass(item.delivery_status)}`}>
                      {deliveryLabel[item.delivery_status]}
                    </span>
                  </td>
                  <td>
                    <Link className="table-action" to={`/asignaciones/${item.id}`}>
                      Ver detalle <CaretRight />
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {error || "No hay asignaciones con esos criterios."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="assignment-cards">
          {filtered.map((item) => (
            <article key={item.id}>
              <header>
                <strong>{item.asset.code}</strong>
                <span className={`status ${stateClass(item.delivery_status)}`}>
                  {deliveryLabel[item.delivery_status]}
                </span>
              </header>
              <h2>{item.asset.name}</h2>
              <dl>
                <div>
                  <dt>Responsable</dt>
                  <dd>{item.responsible.name}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{typeLabel[item.responsible.type]}</dd>
                </div>
                <div>
                  <dt>Ubicación</dt>
                  <dd>{item.location?.room || "Por confirmar"}</dd>
                </div>
              </dl>
              <Link to={`/asignaciones/${item.id}`}>
                Ver detalle <CaretRight />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
