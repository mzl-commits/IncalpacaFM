import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useLocations } from "@/modules/assets/locationMapQueries";
import { addWorkOrderCost, createWorkOrder } from "@/modules/workorders/workOrderRepository";

interface ServiceOrderFormState {
  description: string;
  provider: string;
  documentCode: string;
  amount: string;
  serviceDate: string;
  zone: string;
  building: string;
  area: string;
  locationId: string;
  notes: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm: ServiceOrderFormState = {
  description: "",
  provider: "",
  documentCode: "",
  amount: "",
  serviceDate: today(),
  zone: "",
  building: "",
  area: "",
  locationId: "",
  notes: "",
};

function moneyValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "es"));
}

export function ServiceOrderCreatePage() {
  const navigate = useNavigate();
  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [form, setForm] = useState<ServiceOrderFormState>(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField<K extends keyof ServiceOrderFormState>(field: K, value: ServiceOrderFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const zoneOptions = useMemo(() => unique(locations.map((item) => item.zone)), [locations]);
  const buildingOptions = useMemo(
    () => unique(locations.filter((item) => item.zone === form.zone).map((item) => item.building)),
    [form.zone, locations],
  );
  const areaOptions = useMemo(
    () => unique(locations.filter((item) => item.zone === form.zone && item.building === form.building).map((item) => item.area)),
    [form.building, form.zone, locations],
  );
  const roomOptions = useMemo(
    () => locations
      .filter((item) => item.zone === form.zone && item.building === form.building && item.area === form.area)
      .sort((left, right) => left.room.localeCompare(right.room, "es") || left.locationCode.localeCompare(right.locationCode, "es")),
    [form.area, form.building, form.zone, locations],
  );
  const selectedLocation = locations.find((item) => item.id === form.locationId) ?? null;

  useEffect(() => {
    setForm((current) => {
      if (current.zone || zoneOptions.length !== 1) return current;
      return { ...current, zone: zoneOptions[0] };
    });
  }, [zoneOptions]);

  useEffect(() => {
    setForm((current) => {
      if (!current.zone || current.building || buildingOptions.length !== 1) return current;
      return { ...current, building: buildingOptions[0] };
    });
  }, [buildingOptions]);

  useEffect(() => {
    setForm((current) => {
      if (!current.building || current.area || areaOptions.length !== 1) return current;
      return { ...current, area: areaOptions[0] };
    });
  }, [areaOptions]);

  useEffect(() => {
    setForm((current) => {
      if (!current.area || current.locationId || roomOptions.length !== 1) return current;
      return { ...current, locationId: roomOptions[0].id };
    });
  }, [roomOptions]);

  function selectZone(zone: string) {
    setForm((current) => ({ ...current, zone, building: "", area: "", locationId: "" }));
  }

  function selectBuilding(building: string) {
    setForm((current) => ({ ...current, building, area: "", locationId: "" }));
  }

  function selectArea(area: string) {
    setForm((current) => ({ ...current, area, locationId: "" }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = moneyValue(form.amount);

    if (!form.description.trim() || !form.provider.trim() || !form.documentCode.trim() || !form.locationId || !form.serviceDate || amount <= 0) {
      setError("Completa proveedor, documento, monto, fecha, ubicación y descripción del servicio.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const details = [
        `Proveedor: ${form.provider.trim()}`,
        `Orden de compra o servicio: ${form.documentCode.trim()}`,
        `Monto: S/ ${amount.toFixed(2)}`,
        form.notes.trim() ? `Observaciones: ${form.notes.trim()}` : "",
      ].filter(Boolean).join("\n");

      const workOrder = await createWorkOrder({
        orderType: "OS",
        directRequestDescription: form.description.trim(),
        directRequestType: "OS directa",
        directLocationId: form.locationId,
        operatorId: "",
        operatorName: "",
        supervisorId: "",
        supervisorName: "",
        specialty: "SERVICIO_EXTERNO",
        adminPriority: "MEDIA",
        status: "PROGRAMADA",
        scheduledDate: form.serviceDate,
        scheduledStartTime: "08:00",
        plannedHours: 1,
        administratorNotes: details,
        progressPercentage: 0,
      });

      await addWorkOrderCost(workOrder.id, {
        category: "SERVICIO",
        description: `${form.provider.trim()} - ${form.documentCode.trim()}`,
        amount,
      });

      navigate(`/ordenes-trabajo/${workOrder.id}`);
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "";
      setError(detail || "No se pudo generar la OS.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Órdenes / OS</p>
          <h1>Crear OS</h1>
          <p>Registra un servicio externo sin asignar horas ni operario interno.</p>
        </div>
        <Link className="button button-secondary" to="/ordenes-trabajo/nueva">
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <form className="data-panel service-order-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">1</span>
              <div>
                <h2>Datos del servicio</h2>
                <p>Solo lo necesario para registrar proveedor, documento y costo.</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Proveedor *</span>
              <input
                value={form.provider}
                onChange={(event) => updateField("provider", event.target.value)}
                placeholder="Ej. Servicios Generales Andina"
                maxLength={160}
              />
            </label>

            <label className="field">
              <span>Orden de compra o servicio *</span>
              <input
                value={form.documentCode}
                onChange={(event) => updateField("documentCode", event.target.value)}
                placeholder="Ej. OC-2026-0158"
                maxLength={80}
              />
            </label>

            <label className="field">
              <span>Monto *</span>
              <input
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                inputMode="decimal"
                placeholder="Ej. 250.00"
              />
              <small>El monto se guardará como costo de servicio.</small>
            </label>

            <label className="field">
              <span>Fecha del servicio *</span>
              <input type="date" value={form.serviceDate} onChange={(event) => updateField("serviceDate", event.target.value)} />
            </label>

            <div className="field field-wide service-location-picker">
              <span>Ubicacion *</span>
              <div className="service-location-grid">
                <label className="field">
                  <span>Zona</span>
                  <select value={form.zone} onChange={(event) => selectZone(event.target.value)} disabled={locationsQuery.isPending}>
                    <option value="">{locationsQuery.isPending ? "Cargando..." : "Seleccionar zona"}</option>
                    {zoneOptions.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </select>
                </label>

                <label className="field">
                  <span>Edificio</span>
                  <select value={form.building} onChange={(event) => selectBuilding(event.target.value)} disabled={!form.zone}>
                    <option value="">{form.zone ? "Seleccionar edificio" : "Primero zona"}</option>
                    {buildingOptions.map((building) => <option key={building} value={building}>{building}</option>)}
                  </select>
                </label>

                <label className="field">
                  <span>Area</span>
                  <select value={form.area} onChange={(event) => selectArea(event.target.value)} disabled={!form.building}>
                    <option value="">{form.building ? "Seleccionar area" : "Primero edificio"}</option>
                    {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                  </select>
                </label>

                <label className="field">
                  <span>Ambiente</span>
                  <select value={form.locationId} onChange={(event) => updateField("locationId", event.target.value)} disabled={!form.area}>
                    <option value="">{form.area ? "Seleccionar ambiente" : "Primero area"}</option>
                    {roomOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.locationCode ? `${item.locationCode} - ` : ""}{item.room}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedLocation && (
                <small>
                  Seleccionado: {selectedLocation.zone} / {selectedLocation.building} / {selectedLocation.area} / {selectedLocation.room}
                </small>
              )}
            </div>

            <label className="field field-wide">
              <span>Servicio solicitado *</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Ej. Servicio externo de mantenimiento preventivo de extractor."
                rows={3}
                maxLength={800}
              />
              <small>{form.description.length} / 800 caracteres</small>
            </label>

            <label className="field field-wide">
              <span>Observaciones</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Detalle opcional para administración."
                rows={3}
                maxLength={800}
              />
              <small>{form.notes.length} / 800 caracteres</small>
            </label>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <Link className="button button-secondary" to="/ordenes-trabajo/nueva">Cancelar</Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            <FloppyDisk size={18} weight="bold" />
            {saving ? "Generando..." : "Generar OS"}
          </button>
        </div>
      </form>
    </section>
  );
}
