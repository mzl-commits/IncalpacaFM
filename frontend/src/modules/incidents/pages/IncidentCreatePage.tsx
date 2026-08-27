import { ArrowLeft, Camera, CheckCircle, FloppyDisk, ImageSquare, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { currentUser } from "@/modules/accounts/currentUser";
import { LocationMarkerPicker } from "@/modules/assets/components/LocationMarkerPicker";
import { useLocations } from "@/modules/assets/locationMapQueries";
import type { LocationOption } from "@/modules/assets/locationMapTypes";
import { REQUEST_PRIORITIES, REQUEST_TYPES, requestPriorityLabels, requestTypeLabels, type RequestPriority, type RequestType } from "@/modules/incidents/incidentModel";
import { createWorkRequest } from "@/modules/incidents/incidentRepository";
import { createClientId } from "@/utils/uuid";

interface RequestFormState {
  locationId: string;
  site: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  locationMapId: string;
  locationMarkerX: number | null;
  locationMarkerY: number | null;
  requestType: RequestType | "";
  description: string;
  requesterPriority: RequestPriority;
  project: boolean;
  photoName: string;
}

const initialForm: RequestFormState = {
  locationId: "",
  site: "",
  zone: "",
  building: "",
  area: "",
  room: "",
  locationMapId: "",
  locationMarkerX: null,
  locationMarkerY: null,
  requestType: "",
  description: "",
  requesterPriority: "NORMAL",
  project: false,
  photoName: "",
};

function locationLabel(location: LocationOption) {
  return `${location.locationCode ? `${location.locationCode} · ` : ""}${location.room}`;
}

function locationSite(location: LocationOption) {
  return location.site || "Sede principal";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-PE"));
}

export function IncidentCreatePage() {
  const navigate = useNavigate();
  const errorId = useId();
  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [form, setForm] = useState<RequestFormState>(initialForm);
  const [error, setError] = useState("");
  const selectedLocation = locations.find((item) => item.id === form.locationId) ?? null;

  const sites = useMemo(() => uniqueSorted(locations.map(locationSite)), [locations]);
  const macroAreas = useMemo(
    () => uniqueSorted(locations.filter((item) => !form.site || locationSite(item) === form.site).map((item) => item.zone)),
    [form.site, locations],
  );
  const areas = useMemo(
    () =>
      uniqueSorted(
        locations
          .filter((item) => !form.site || locationSite(item) === form.site)
          .filter((item) => !form.zone || item.zone === form.zone)
          .map((item) => item.area),
      ),
    [form.site, form.zone, locations],
  );
  const modules = useMemo(
    () =>
      locations
        .filter((item) => !form.site || locationSite(item) === form.site)
        .filter((item) => !form.zone || item.zone === form.zone)
        .filter((item) => !form.area || item.area === form.area),
    [form.area, form.site, form.zone, locations],
  );

  useEffect(() => {
    if (!form.site && sites.length === 1) {
      setForm((current) => ({ ...current, site: sites[0] }));
      return;
    }
    if (form.site && !form.zone && macroAreas.length === 1) {
      setForm((current) => ({ ...current, zone: macroAreas[0] }));
      return;
    }
    if (form.zone && !form.area && areas.length === 1) {
      setForm((current) => ({ ...current, area: areas[0] }));
      return;
    }
    if (form.area && !form.locationId && modules.length === 1) {
      selectLocation(modules[0]);
    }
  }, [areas, form.area, form.locationId, form.site, form.zone, macroAreas, modules, sites]);

  function updateField<K extends keyof RequestFormState>(field: K, value: RequestFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function clearSelectedLocation(partial: Partial<RequestFormState>) {
    setForm((current) => ({
      ...current,
      ...partial,
      locationId: "",
      building: "",
      room: "",
      locationMapId: "",
      locationMarkerX: null,
      locationMarkerY: null,
    }));
  }

  function selectLocation(location: LocationOption) {
    setForm((current) => ({
      ...current,
      locationId: location.id,
      site: locationSite(location),
      zone: location.zone,
      building: location.building,
      area: location.area,
      room: location.room,
      locationMapId: location.activeMap?.id ?? "",
      locationMarkerX: null,
      locationMarkerY: null,
    }));
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.locationId || !form.requestType || form.description.trim().length < 10) {
      setError("Selecciona sede, área macro, área y módulo/ambiente; luego completa el tipo y la descripción.");
      return;
    }
    setError("");
    try {
      await createWorkRequest({
        requesterId: currentUser.id,
        requesterName: currentUser.fullName,
        requesterEmail: currentUser.email,
        locationId: form.locationId,
        zone: form.zone,
        building: form.building,
        area: form.area,
        room: form.room,
        locationMapId: form.locationMapId || null,
        locationMarkerX: form.locationMarkerX,
        locationMarkerY: form.locationMarkerY,
        requestType: form.requestType,
        description: form.description.trim(),
        requesterPriority: form.requesterPriority,
        project: form.project,
        evidence: form.photoName ? [{ id: createClientId("evidence"), name: form.photoName, mimeType: "image/*", size: 0 }] : [],
        status: "PENDIENTE",
      });
      navigate("/incidencias");
    } catch {
      setError("No se pudo registrar la solicitud. Revisa la ubicación seleccionada e inténtalo nuevamente.");
    }
  }

  return (
    <section className="incident-create-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Solicitudes / Nueva solicitud</p>
          <h1>Nueva solicitud de trabajo</h1>
          <p>Registra la solicitud, ubícala en el catálogo oficial y adjunta evidencia para facilitar su evaluación.</p>
        </div>
        <Link className="button button-secondary" to="/incidencias">
          <ArrowLeft size={18} /> Volver
        </Link>
      </div>

      <form className="data-panel" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">1</span>
              <div>
                <h2>Ubicación de la solicitud</h2>
                <p>Selecciona la sede, área macro, área y módulo/ambiente de trabajo.</p>
              </div>
            </div>
          </div>

          {locationsQuery.isError && (
            <aside className="incident-reference-unavailable">
              <ImageSquare weight="duotone" />
              <p>
                <strong>No se pudieron cargar las ubicaciones.</strong>
                <span>Recarga la página e inténtalo nuevamente.</span>
              </p>
            </aside>
          )}

          <div className="form-grid">
            <label className="field">
              <span>Sede *</span>
              <select value={form.site} onChange={(event) => clearSelectedLocation({ site: event.target.value, zone: "", area: "" })}>
                <option value="">Seleccionar sede...</option>
                {sites.map((site) => <option key={site} value={site}>{site}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Área macro *</span>
              <select value={form.zone} disabled={!form.site} onChange={(event) => clearSelectedLocation({ zone: event.target.value, area: "" })}>
                <option value="">Seleccionar área macro...</option>
                {macroAreas.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Área *</span>
              <select value={form.area} disabled={!form.zone} onChange={(event) => clearSelectedLocation({ area: event.target.value })}>
                <option value="">Seleccionar área...</option>
                {areas.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Módulo / ambiente de trabajo *</span>
              <select value={form.locationId} disabled={!form.area} onChange={(event) => {
                const location = modules.find((item) => item.id === event.target.value);
                if (location) selectLocation(location);
              }}>
                <option value="">Seleccionar módulo...</option>
                {modules.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationLabel(location)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedLocation && (
            <div className="incident-location-selected">
              <CheckCircle weight="fill" />
              <div>
                <strong>{locationLabel(selectedLocation)}</strong>
                <span>{locationSite(selectedLocation)} / {selectedLocation.zone} / {selectedLocation.area}</span>
              </div>
              <button type="button" onClick={() => clearSelectedLocation({ locationId: "" })}>Cambiar</button>
            </div>
          )}

          {selectedLocation?.activeMap ? (
            <div style={{ marginTop: "20px" }}>
              <LocationMarkerPicker
                locationName={locationLabel(selectedLocation)}
                locationMap={selectedLocation.activeMap}
                markerX={form.locationMarkerX}
                markerY={form.locationMarkerY}
                subjectLabel="incidente"
                onChange={(x, y) => setForm((current) => ({ ...current, locationMarkerX: x, locationMarkerY: y }))}
              />
            </div>
          ) : selectedLocation ? (
            <aside className="incident-reference-unavailable">
              <ImageSquare weight="duotone" />
              <p>
                <strong>Este ambiente todavía no tiene imagen referencial.</strong>
                <span>La solicitud se registrará con la ubicación oficial. Un administrador podrá incorporar la imagen posteriormente.</span>
              </p>
            </aside>
          ) : null}
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">2</span>
              <div>
                <h2>Detalle del trabajo solicitado</h2>
                <p>Describe claramente la necesidad o solicitud registrada.</p>
              </div>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Tipo de solicitud *</span>
              <select required value={form.requestType} onChange={(event) => updateField("requestType", event.target.value as RequestType)}>
                <option value="">Seleccionar tipo</option>
                {REQUEST_TYPES.map((type) => <option key={type} value={type}>{requestTypeLabels[type]}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Prioridad del usuario *</span>
              <select required value={form.requesterPriority} onChange={(event) => updateField("requesterPriority", event.target.value as RequestPriority)}>
                {REQUEST_PRIORITIES.map((priority) => <option key={priority} value={priority}>{requestPriorityLabels[priority]}</option>)}
              </select>
            </label>

            <label className="field field-wide">
              <span>Descripción de la solicitud *</span>
              <textarea required value={form.description} minLength={10} aria-invalid={Boolean(error && form.description.trim().length < 10)} aria-describedby={error && form.description.trim().length < 10 ? errorId : undefined} onChange={(event) => updateField("description", event.target.value)} placeholder="Describe qué se necesita, desde cuándo y cualquier detalle importante." rows={5} maxLength={1000} />
              <small>{form.description.length} / 1000 caracteres</small>
            </label>

            <label className="field checkbox-field">
              <input type="checkbox" checked={form.project} onChange={(event) => updateField("project", event.target.checked)} />
              <span>La solicitud corresponde a un proyecto</span>
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">3</span>
              <div>
                <h2>Evidencia</h2>
                <p>Adjunta una fotografía que ayude a identificar la solicitud.</p>
              </div>
            </div>
          </div>
          <div className="upload-box">
            <Camera size={32} />
            <div>
              <strong>Adjuntar fotografía</strong>
              <p>Formatos permitidos: JPG, PNG o WEBP.</p>
            </div>
            <label className="button button-secondary">
              Seleccionar archivo
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => updateField("photoName", event.target.files?.[0]?.name ?? "")} />
            </label>
          </div>
          {form.photoName && <p className="selected-file">Archivo seleccionado: <strong>{form.photoName}</strong></p>}
        </div>

        {error && <div className="form-error" id={errorId} role="alert" aria-live="assertive"><WarningCircle />{error}</div>}
        <div className="form-actions">
          <Link className="button button-secondary" to="/incidencias">Cancelar</Link>
          <button className="button button-primary" type="submit">
            <FloppyDisk size={18} weight="bold" />
            Registrar solicitud
          </button>
        </div>
      </form>
    </section>
  );
}
