import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { listTechnicians, type Technician } from "@/modules/accounts/technicianRepository";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import { getAssetDisplayCode, type RegisteredAsset } from "@/modules/assets/entryModel";
import { useLocations } from "@/modules/assets/locationMapQueries";
import {
  ADMIN_PRIORITIES,
  SPECIALTIES,
  adminPriorityLabels,
  specialtyLabels,
  type AdminPriority,
  type Specialty,
} from "@/modules/workorders/workOrderModel";
import { createWorkOrder } from "@/modules/workorders/workOrderRepository";

type DirectOrderType = "OT" | "OL";

interface DirectWorkOrderFormState {
  description: string;
  assetId: string;
  locationId: string;
  operatorId: string;
  operatorName: string;
  technicianWorkerCode: string;
  supportingWorkerCodes: string[];
  supervisorId: string;
  supervisorName: string;
  specialty: Specialty | "";
  adminPriority: AdminPriority;
  scheduledDate: string;
  scheduledStartTime: string;
  plannedHours: number;
  administratorNotes: string;
}

const supervisors = [
  { id: "USR-SUP-001", name: "Rosa Medina" },
  { id: "USR-SUP-002", name: "Elena Torres" },
];

function initialForm(orderType: DirectOrderType): DirectWorkOrderFormState {
  return {
    description: "",
    assetId: "",
    locationId: "",
    operatorId: "",
    operatorName: "",
    technicianWorkerCode: "",
    supportingWorkerCodes: [],
    supervisorId: "",
    supervisorName: "",
    specialty: orderType === "OL" ? "LIMPIEZA" : "",
    adminPriority: "MEDIA",
    scheduledDate: "",
    scheduledStartTime: "08:00",
    plannedHours: orderType === "OL" ? 1 : 2,
    administratorNotes: "",
  };
}

function assetLabel(asset: RegisteredAsset) {
  return `${getAssetDisplayCode(asset)} - ${asset.draft.name}`;
}

function hasCleaningSpecialty(person: Technician) {
  return person.specialty
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("limpieza");
}

export function DirectWorkOrderCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const orderType: DirectOrderType = location.pathname.endsWith("/ol") ? "OL" : "OT";
  const isCleaningOrder = orderType === "OL";
  const orderName = isCleaningOrder ? "OL" : "OT";
  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assets, setAssets] = useState<RegisteredAsset[]>([]);
  const [form, setForm] = useState<DirectWorkOrderFormState>(() => initialForm(orderType));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialForm(orderType));
  }, [orderType]);

  useEffect(() => {
    void listTechnicians().then((people) => setTechnicians(people.filter((person) => person.active)));
    void listRegisteredAssets().then(setAssets);
  }, []);

  const selectedAsset = assets.find((asset) => asset.id === form.assetId) ?? null;
  const selectedLocation = locations.find((item) => item.id === form.locationId) ?? null;
  const availableSpecialties = isCleaningOrder ? ["LIMPIEZA" as Specialty] : SPECIALTIES;
  const assignableTechnicians = useMemo(
    () => isCleaningOrder ? technicians.filter(hasCleaningSpecialty) : technicians,
    [isCleaningOrder, technicians],
  );
  const supportingTechnicians = assignableTechnicians.filter((person) => person.worker_code !== form.technicianWorkerCode);

  function updateField<K extends keyof DirectWorkOrderFormState>(field: K, value: DirectWorkOrderFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectTechnician(operator?: Technician | null) {
    setForm((current) => ({
      ...current,
      operatorId: operator?.id ?? "",
      operatorName: operator?.full_name ?? "",
      technicianWorkerCode: operator?.worker_code ?? "",
      supportingWorkerCodes: current.supportingWorkerCodes.filter((code) => code !== operator?.worker_code),
    }));
  }

  useEffect(() => {
    if (!isCleaningOrder) return;
    if (assignableTechnicians.length === 1 && form.operatorId !== assignableTechnicians[0].id) {
      selectTechnician(assignableTechnicians[0]);
      return;
    }
    if (form.operatorId && !assignableTechnicians.some((person) => person.id === form.operatorId)) {
      selectTechnician(null);
    }
  }, [assignableTechnicians, form.operatorId, isCleaningOrder]);

  function selectAsset(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    setForm((current) => ({
      ...current,
      assetId,
      locationId: asset?.locationDetail?.id || current.locationId,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.description.trim() || !form.locationId || !form.operatorId || !form.supervisorId || !form.specialty || !form.scheduledDate) {
      setError(`Completa los campos obligatorios antes de generar la ${orderName}.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const workOrder = await createWorkOrder({
        orderType,
        directRequestDescription: form.description.trim(),
        directRequestType: isCleaningOrder ? "OL directa" : "OT directa",
        directAssetId: form.assetId || null,
        directLocationId: form.locationId,
        operatorId: form.operatorId,
        operatorName: form.operatorName,
        supervisorId: form.supervisorId,
        supervisorName: form.supervisorName,
        specialty: form.specialty as Specialty,
        adminPriority: form.adminPriority,
        status: "PROGRAMADA",
        scheduledDate: form.scheduledDate,
        scheduledStartTime: form.scheduledStartTime,
        technicianWorkerCode: form.technicianWorkerCode,
        technicianWorkerCodes: form.supportingWorkerCodes,
        plannedHours: form.plannedHours,
        administratorNotes: form.administratorNotes.trim(),
        progressPercentage: 0,
      });
      navigate(`/ordenes-trabajo/${workOrder.id}`);
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "";
      setError(detail || `No se pudo generar la ${orderName} directa.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Ordenes / {orderName} directa</p>
          <h1>Crear {orderName} directa</h1>
          <p>{isCleaningOrder ? "Registra una limpieza puntual sin crear una solicitud manual previa." : "Registra una orden sin pedirle al administrador crear y aprobar una solicitud manualmente."}</p>
        </div>
        <Link className="button button-secondary" to="/ordenes-trabajo/nueva">
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <form className="data-panel" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">1</span>
              <div>
                <h2>Datos de la orden</h2>
                <p>{isCleaningOrder ? "Indica que limpieza puntual se debe realizar y en que ambiente." : "Indica que se necesita atender y donde se realizara el trabajo."}</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field field-wide">
              <span>{isCleaningOrder ? "Limpieza a realizar *" : "Solicitud o trabajo a realizar *"}</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder={isCleaningOrder ? "Ej. Limpieza profunda de sala de reuniones despues de evento." : "Ej. Reparar chapa de puerta en oficina de mantenimiento."}
                rows={4}
                maxLength={1000}
              />
              <small>{form.description.length} / 1000 caracteres</small>
            </label>

            <label className="field">
              <span>Bien asociado</span>
              <select value={form.assetId} onChange={(event) => selectAsset(event.target.value)}>
                <option value="">Sin bien asociado</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{assetLabel(asset)}</option>
                ))}
              </select>
              <small>Opcional. Si el bien tiene ubicacion, se completara el ambiente.</small>
            </label>

            <label className="field">
              <span>Ubicacion *</span>
              <select value={form.locationId} onChange={(event) => updateField("locationId", event.target.value)} disabled={locationsQuery.isPending}>
                <option value="">{locationsQuery.isPending ? "Cargando ubicaciones..." : "Seleccionar ubicacion"}</option>
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.locationCode ? `${item.locationCode} - ` : ""}{item.building} / {item.area} / {item.room}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(selectedAsset || selectedLocation) && (
            <dl className="incident-location-summary">
              {selectedAsset && <div><dt>Bien</dt><dd>{assetLabel(selectedAsset)}</dd></div>}
              {selectedLocation && <div><dt>Ambiente</dt><dd>{selectedLocation.building} / {selectedLocation.area} / {selectedLocation.room}</dd></div>}
            </dl>
          )}
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">2</span>
              <div>
                <h2>Responsables y programacion</h2>
                <p>{isCleaningOrder ? "Asigna quien realizara la limpieza, quien supervisa y cuando se atendera." : "Asigna quien ejecuta, quien supervisa y cuando se atendera."}</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>{isCleaningOrder ? "Responsable de limpieza *" : "Operario *"}</span>
              <select
                value={form.operatorId}
                onChange={(event) => {
                  selectTechnician(assignableTechnicians.find((item) => item.id === event.target.value));
                }}
              >
                <option value="">{isCleaningOrder ? "Seleccionar responsable" : "Seleccionar operario"}</option>
                {assignableTechnicians.map((operator) => (
                  <option key={operator.id} value={operator.id}>{operator.full_name} - {operator.specialty || "Sin especialidad"}</option>
                ))}
              </select>
              {isCleaningOrder && !assignableTechnicians.length && <small>No hay responsables de limpieza activos. Registralos en Equipo tecnico.</small>}
            </label>

            <label className="field">
              <span>{isCleaningOrder ? "Apoyo de limpieza" : "Tecnicos de apoyo"}</span>
              <select multiple value={form.supportingWorkerCodes} onChange={(event) => updateField("supportingWorkerCodes", Array.from(event.target.selectedOptions).map((option) => option.value))}>
                {supportingTechnicians.map((person) => (
                  <option key={person.id} value={person.worker_code}>{person.full_name} - {person.specialty || "Sin especialidad"}</option>
                ))}
              </select>
              <small>Opcional. Usa Ctrl o Cmd para seleccionar varias personas.</small>
            </label>

            <label className="field">
              <span>Supervisor *</span>
              <select
                value={form.supervisorId}
                onChange={(event) => {
                  const supervisor = supervisors.find((item) => item.id === event.target.value);
                  updateField("supervisorId", supervisor?.id ?? "");
                  updateField("supervisorName", supervisor?.name ?? "");
                }}
              >
                <option value="">Seleccionar supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Especialidad *</span>
              <select value={form.specialty} onChange={(event) => updateField("specialty", event.target.value as Specialty)} disabled={isCleaningOrder}>
                <option value="">Seleccionar especialidad</option>
                {availableSpecialties.map((specialty) => (
                  <option key={specialty} value={specialty}>{specialtyLabels[specialty]}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Prioridad administrativa *</span>
              <select value={form.adminPriority} onChange={(event) => updateField("adminPriority", event.target.value as AdminPriority)}>
                {ADMIN_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{adminPriorityLabels[priority]}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Fecha programada *</span>
              <input type="date" value={form.scheduledDate} onChange={(event) => updateField("scheduledDate", event.target.value)} />
            </label>

            <label className="field">
              <span>Hora de inicio *</span>
              <input type="time" value={form.scheduledStartTime} onChange={(event) => updateField("scheduledStartTime", event.target.value)} />
            </label>

            <label className="field">
              <span>Horas previstas *</span>
              <input type="number" min={1} max={16} value={form.plannedHours} onChange={(event) => updateField("plannedHours", Number(event.target.value))} />
            </label>

            <label className="field field-wide">
              <span>{isCleaningOrder ? "Indicaciones para limpieza" : "Indicaciones para el operario"}</span>
              <textarea value={form.administratorNotes} onChange={(event) => updateField("administratorNotes", event.target.value)} rows={4} maxLength={1000} />
              <small>{form.administratorNotes.length} / 1000 caracteres</small>
            </label>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <Link className="button button-secondary" to="/ordenes-trabajo/nueva">Cancelar</Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            <FloppyDisk size={18} weight="bold" />
            {saving ? "Generando..." : `Generar ${orderName}`}
          </button>
        </div>
      </form>
    </section>
  );
}