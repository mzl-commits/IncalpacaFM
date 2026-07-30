import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
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
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import { entryTypeLabels, type RegisteredAsset } from "@/modules/assets/entryModel";

const FILTER_KEYS = [
  "q",
  "entryType",
  "condition",
  "criticality",
  "registeredBy",
  "from",
  "to",
] as const;

const statusClass = { Registrado: "status-success" } as const;

export function AssetEntryListPage() {
  const [registered, setRegistered] = useState<RegisteredAsset[]>([]);
  const [loadError, setLoadError] = useState("");
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  useEffect(() => {
    listRegisteredAssets()
      .then(setRegistered)
      .catch(() => setLoadError("No se pudo conectar con la base de datos."));
  }, []);

  const entryTypeOptions = useMemo(
    () =>
      buildFilterOptions(
        registered.map((item) => item.draft.entryType),
        entryTypeLabels,
      ),
    [registered],
  );
  const conditionOptions = useMemo(
    () => buildFilterOptions(registered.map((item) => item.draft.condition)),
    [registered],
  );
  const criticalityOptions = useMemo(
    () => buildFilterOptions(registered.map((item) => item.draft.criticality)),
    [registered],
  );
  const registeredByOptions = useMemo(
    () => buildFilterOptions(registered.map((item) => item.createdBy)),
    [registered],
  );

  const filteredRecords = useMemo(() => {
    const query = values.q.toLocaleLowerCase("es").trim();

    return registered.filter((item) => {
      const searchable = [
        item.code,
        item.draft.name,
        item.draft.description,
        item.createdBy,
        item.draft.purchaseOrder,
        item.draft.supplier,
        item.draft.donor,
        item.draft.contractNumber,
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      return (
        (!query || searchable.includes(query)) &&
        (!values.entryType || item.draft.entryType === values.entryType) &&
        (!values.condition || item.draft.condition === values.condition) &&
        (!values.criticality || item.draft.criticality === values.criticality) &&
        (!values.registeredBy || item.createdBy === values.registeredBy) &&
        isDateInRange(item.createdAt, values.from, values.to)
      );
    });
  }, [registered, values]);

  const entries = useMemo(
    () =>
      filteredRecords.map((item) => ({
        id: item.id,
        code: item.code,
        description: item.draft.name,
        entryType: entryTypeLabels[item.draft.entryType],
        date: new Intl.DateTimeFormat("es-PE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(item.createdAt)),
        registeredBy: item.createdBy,
        status: "Registrado" as const,
      })),
    [filteredRecords],
  );

  const activeFilters: ActiveFilter[] = [];
  if (values.q) {
    activeFilters.push({
      key: "q",
      label: "Búsqueda",
      value: values.q,
      onRemove: () => setValue("q", ""),
    });
  }
  if (values.entryType) {
    activeFilters.push({
      key: "entryType",
      label: "Tipo de ingreso",
      value: labelFor(values.entryType, entryTypeLabels),
      onRemove: () => setValue("entryType", ""),
    });
  }
  if (values.condition) {
    activeFilters.push({
      key: "condition",
      label: "Condición",
      value: values.condition,
      onRemove: () => setValue("condition", ""),
    });
  }
  if (values.criticality) {
    activeFilters.push({
      key: "criticality",
      label: "Criticidad",
      value: values.criticality,
      onRemove: () => setValue("criticality", ""),
    });
  }
  if (values.registeredBy) {
    activeFilters.push({
      key: "registeredBy",
      label: "Registrado por",
      value: values.registeredBy,
      onRemove: () => setValue("registeredBy", ""),
    });
  }
  if (values.from) {
    activeFilters.push({
      key: "from",
      label: "Desde",
      value: values.from,
      onRemove: () => setValue("from", ""),
    });
  }
  if (values.to) {
    activeFilters.push({
      key: "to",
      label: "Hasta",
      value: values.to,
      onRemove: () => setValue("to", ""),
    });
  }

  const assigned = registered.filter((item) => item.assignmentStatus !== "Sin asignar").length;
  const purchaseCount = registered.filter((item) => item.draft.entryType === "purchase").length;
  const donationCount = registered.filter((item) => item.draft.entryType === "donation").length;
  const reviewCount = registered.filter(
    (item) => item.draft.condition === "Requiere revisión",
  ).length;

  return (
    <section className="entries-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Entradas</p>
          <h1>Entrada de bienes</h1>
          <p>Registra y valida los bienes que ingresan a la organización.</p>
        </div>
        <Link className="button button-primary desktop-new-entry" to="/bienes/entradas/nueva">
          <Plus size={18} weight="bold" />
          Registrar nuevo bien
        </Link>
      </div>

      <div className="metrics-grid">
        <article className="metric-pending">
          <span>Sin asignar</span>
          <strong>{registered.length - assigned}</strong>
          <small>Disponibles para asignación</small>
        </article>
        <article>
          <span>Registrados</span>
          <strong>{registered.length}</strong>
          <small>En la base de datos</small>
        </article>
        <article className="metric-error">
          <span>Observados</span>
          <strong>0</strong>
          <small>Sin observaciones vigentes</small>
        </article>
        <article className="metric-success">
          <span>Con asignación</span>
          <strong>{assigned}</strong>
          <small>Gestionados en Asignaciones</small>
        </article>
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Consultar entradas"
          description="Refina por procedencia, condición, criticidad y fecha de registro."
          searchLabel="Buscar entradas"
          searchPlaceholder="Código, descripción, documento de origen o registrado por"
          searchValue={values.q}
          onSearchChange={(value) => setValue("q", value)}
          resultCount={entries.length}
          totalCount={registered.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            {
              key: "purchases",
              label: "Compras",
              count: purchaseCount,
              active: values.entryType === "purchase",
              onSelect: () =>
                setValue("entryType", values.entryType === "purchase" ? "" : "purchase"),
            },
            {
              key: "donations",
              label: "Donaciones",
              count: donationCount,
              active: values.entryType === "donation",
              onSelect: () =>
                setValue("entryType", values.entryType === "donation" ? "" : "donation"),
            },
            {
              key: "review",
              label: "Requieren revisión",
              count: reviewCount,
              active: values.condition === "Requiere revisión",
              onSelect: () =>
                setValue(
                  "condition",
                  values.condition === "Requiere revisión" ? "" : "Requiere revisión",
                ),
            },
          ]}
        >
          <FilterSelect
            label="Tipo de ingreso"
            value={values.entryType}
            onChange={(value) => setValue("entryType", value)}
            options={entryTypeOptions}
            allLabel="Todos los tipos"
          />
          <FilterSelect
            label="Condición al ingresar"
            value={values.condition}
            onChange={(value) => setValue("condition", value)}
            options={conditionOptions}
            allLabel="Cualquier condición"
          />
          <FilterSelect
            label="Criticidad"
            value={values.criticality}
            onChange={(value) => setValue("criticality", value)}
            options={criticalityOptions}
            allLabel="Cualquier criticidad"
          />
          <FilterSelect
            label="Registrado por"
            value={values.registeredBy}
            onChange={(value) => setValue("registeredBy", value)}
            options={registeredByOptions}
            allLabel="Todos los registradores"
          />
          <FilterDate
            label="Registrado desde"
            value={values.from}
            max={values.to || undefined}
            onChange={(value) => setValue("from", value)}
          />
          <FilterDate
            label="Registrado hasta"
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
                <th>Descripción</th>
                <th>Tipo de ingreso</th>
                <th>Fecha</th>
                <th>Registrado por</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.code}</strong>
                  </td>
                  <td>{entry.description}</td>
                  <td>{entry.entryType}</td>
                  <td>{entry.date}</td>
                  <td>{entry.registeredBy}</td>
                  <td>
                    <span className={`status ${statusClass[entry.status]}`}>{entry.status}</span>
                  </td>
                  <td>
                    <Link className="table-action" to={`/bienes/${entry.id}`}>
                      Ver detalle <CaretRight />
                    </Link>
                  </td>
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {loadError || "No encontramos entradas con esos criterios."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-entry-list">
          {entries.map((entry) => (
            <article className="mobile-entry-card" key={entry.id}>
              <header>
                <strong>{entry.code}</strong>
                <span className="status status-success">{entry.status}</span>
              </header>
              <h2>{entry.description}</h2>
              <p>
                {entry.entryType} · {entry.date}
              </p>
              <small>Registrado por: {entry.registeredBy}</small>
              <Link to={`/bienes/${entry.id}`} aria-label={`Ver detalle de ${entry.code}`}>
                <CaretRight />
              </Link>
            </article>
          ))}
          {!entries.length && <p className="empty-row">{loadError || "No hay registros."}</p>}
        </div>

        <footer className="table-footer">
          <span>
            Mostrando {entries.length} de {registered.length} registros
          </span>
          <div>
            <button type="button" aria-label="Página anterior">
              <CaretLeft />
            </button>
            <button className="is-current" type="button">
              1
            </button>
            <button type="button" aria-label="Página siguiente">
              <CaretRight />
            </button>
          </div>
        </footer>
      </div>

      <Link className="mobile-register-fab" to="/bienes/entradas/nueva">
        <Plus weight="bold" />
        Registrar
      </Link>
    </section>
  );
}
