import { ArrowLeft, Camera, CheckCircle, FloppyDisk, ImageSquare, MagnifyingGlass, MapPin, WarningCircle } from "@phosphor-icons/react";
import { useId, useMemo, useState } from "react";
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
  locationId: "", zone: "", building: "", area: "", room: "", locationMapId: "", locationMarkerX: null, locationMarkerY: null,
  requestType: "", description: "", requesterPriority: "NORMAL", project: false, photoName: "",
};

function locationLabel(location: LocationOption) {
  return `${location.locationCode ? `${location.locationCode} · ` : ""}${location.room}`;
}

export function IncidentCreatePage() {
  const navigate = useNavigate();
  const errorId = useId();
  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [form, setForm] = useState<RequestFormState>(initialForm);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationFocused, setLocationFocused] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [error, setError] = useState("");
  const selectedLocation = locations.find((item) => item.id === form.locationId) ?? null;

  const locationResults = useMemo(() => {
    const normalized = locationQuery.trim().toLocaleLowerCase("es-PE");
    if (!normalized || selectedLocation) return [];
    return locations.filter((item) => `${item.locationCode} ${item.room} ${item.area} ${item.building} ${item.zone}`.toLocaleLowerCase("es-PE").includes(normalized)).slice(0, 8);
  }, [locationQuery, locations, selectedLocation]);

  function updateField<K extends keyof RequestFormState>(field: K, value: RequestFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectLocation(location: LocationOption) {
    setForm((current) => ({
      ...current,
      locationId: location.id,
      zone: location.zone,
      building: location.building,
      area: location.area,
      room: location.room,
      locationMapId: location.activeMap?.id ?? "",
      locationMarkerX: null,
      locationMarkerY: null,
    }));
    setLocationQuery(locationLabel(location));
    setLocationFocused(false);
    setActiveResult(0);
    setError("");
  }

  function changeLocationQuery(value: string) {
    setLocationQuery(value);
    setActiveResult(0);
    setForm((current) => ({ ...current, locationId: "", zone: "", building: "", area: "", room: "", locationMapId: "", locationMarkerX: null, locationMarkerY: null }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.locationId || !form.requestType || form.description.trim().length < 10) {
      setError("Selecciona una ubicación oficial, completa el tipo de solicitud y describe el problema con al menos 10 caracteres.");
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
      <div className="page-heading"><div><p className="breadcrumb">Mantenimiento / Solicitudes / Nueva solicitud</p><h1>Nueva solicitud de trabajo</h1><p>Registra el problema, ubícalo en el catálogo oficial y adjunta una evidencia para facilitar su evaluación.</p></div><Link className="button button-secondary" to="/incidencias"><ArrowLeft size={18} /> Volver</Link></div>

      <form className="data-panel" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="section-heading"><div><span className="section-number">1</span><div><h2>Ubicación de la solicitud</h2><p>Busca por código, oficina, ambiente, área o edificio. La plataforma completará la jerarquía automáticamente.</p></div></div></div>
          <div className="incident-location-layout">
            <div className="incident-location-search">
              <label className="field"><span>Buscar ubicación oficial *</span><div className="incident-location-combobox"><MagnifyingGlass /><input
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={locationFocused && locationResults.length > 0}
                aria-controls="incident-location-results"
                aria-activedescendant={locationResults[activeResult] ? `incident-location-${locationResults[activeResult].id}` : undefined}
                value={locationQuery}
                onFocus={() => setLocationFocused(true)}
                onBlur={() => window.setTimeout(() => setLocationFocused(false), 120)}
                onChange={(event) => changeLocationQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (!locationResults.length) return;
                  if (event.key === "ArrowDown") { event.preventDefault(); setActiveResult((current) => Math.min(current + 1, locationResults.length - 1)); }
                  if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult((current) => Math.max(current - 1, 0)); }
                  if (event.key === "Enter") { event.preventDefault(); selectLocation(locationResults[activeResult]); }
                  if (event.key === "Escape") setLocationFocused(false);
                }}
                placeholder="Ej. AMB-0001, Oficina FM o Mantenimiento"
                aria-invalid={Boolean(error && !form.locationId)}
                aria-describedby={error && !form.locationId ? errorId : undefined}
              /></div></label>
              {locationFocused && locationQuery.trim() && !selectedLocation && <div className="incident-location-results" id="incident-location-results" role="listbox">
                {locationsQuery.isPending ? <p>Cargando ubicaciones oficiales…</p>
                : locationResults.length ? locationResults.map((location, index) => <button id={`incident-location-${location.id}`} role="option" aria-selected={index === activeResult} className={index === activeResult ? "is-active" : ""} type="button" key={location.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectLocation(location)}><MapPin weight="duotone" /><span><strong>{locationLabel(location)}</strong><small>{location.zone} / {location.building} / {location.area}</small></span>{location.activeMap ? <em><ImageSquare weight="fill" /> Con imagen</em> : <em>Sin imagen</em>}</button>)
                : <p>No hay coincidencias. Prueba con otro código o nombre.</p>}
              </div>}
              {selectedLocation && <div className="incident-location-selected"><CheckCircle weight="fill" /><div><strong>{locationLabel(selectedLocation)}</strong><span>{selectedLocation.zone} / {selectedLocation.building} / {selectedLocation.area}</span></div><button type="button" onClick={() => changeLocationQuery("")}>Cambiar</button></div>}
            </div>
            {selectedLocation && <dl className="incident-location-summary"><div><dt>Zona</dt><dd>{selectedLocation.zone}</dd></div><div><dt>Edificio</dt><dd>{selectedLocation.building}</dd></div><div><dt>Área</dt><dd>{selectedLocation.area}</dd></div><div><dt>Ambiente</dt><dd>{selectedLocation.room}</dd></div></dl>}
          </div>

          {selectedLocation?.activeMap ? <LocationMarkerPicker locationName={locationLabel(selectedLocation)} locationMap={selectedLocation.activeMap} markerX={form.locationMarkerX} markerY={form.locationMarkerY} subjectLabel="incidente" onChange={(x, y) => setForm((current) => ({ ...current, locationMarkerX: x, locationMarkerY: y }))} />
          : selectedLocation ? <aside className="incident-reference-unavailable"><ImageSquare weight="duotone" /><p><strong>Este ambiente todavía no tiene imagen referencial.</strong><span>La solicitud se registrará con la ubicación oficial. Un administrador podrá incorporar la imagen posteriormente.</span></p></aside> : null}
        </div>

        <div className="form-section">
          <div className="section-heading"><div><span className="section-number">2</span><div><h2>Detalle del trabajo solicitado</h2><p>Describe claramente la necesidad o el problema reportado.</p></div></div></div>
          <div className="form-grid">
            <label className="field"><span>Tipo de solicitud *</span><select required value={form.requestType} aria-invalid={Boolean(error && !form.requestType)} aria-describedby={error && !form.requestType ? errorId : undefined} onChange={(event) => updateField("requestType", event.target.value as RequestType)}><option value="">Seleccionar tipo</option>{REQUEST_TYPES.map((type) => <option key={type} value={type}>{requestTypeLabels[type]}</option>)}</select></label>
            <label className="field"><span>Prioridad del solicitante *</span><select required value={form.requesterPriority} onChange={(event) => updateField("requesterPriority", event.target.value as RequestPriority)}>{REQUEST_PRIORITIES.map((priority) => <option key={priority} value={priority}>{requestPriorityLabels[priority]}</option>)}</select></label>
            <label className="field field-wide"><span>Descripción del problema *</span><textarea required value={form.description} minLength={10} aria-invalid={Boolean(error && form.description.trim().length < 10)} aria-describedby={error && form.description.trim().length < 10 ? errorId : undefined} onChange={(event) => updateField("description", event.target.value)} placeholder="Describe qué ocurre, desde cuándo y cualquier detalle importante." rows={5} maxLength={1000} /><small>{form.description.length} / 1000 caracteres</small></label>
            <label className="field checkbox-field"><input type="checkbox" checked={form.project} onChange={(event) => updateField("project", event.target.checked)} /><span>La solicitud corresponde a un proyecto</span></label>
          </div>
        </div>

        <div className="form-section">
          <div className="section-heading"><div><span className="section-number">3</span><div><h2>Evidencia</h2><p>Adjunta una fotografía que ayude a identificar el problema.</p></div></div></div>
          <div className="upload-box"><Camera size={32} /><div><strong>Adjuntar fotografía</strong><p>Formatos permitidos: JPG, PNG o WEBP.</p></div><label className="button button-secondary">Seleccionar archivo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => updateField("photoName", event.target.files?.[0]?.name ?? "")} /></label></div>
          {form.photoName && <p className="selected-file">Archivo seleccionado: <strong>{form.photoName}</strong></p>}
        </div>

        {error && <div className="form-error" id={errorId} role="alert" aria-live="assertive"><WarningCircle />{error}</div>}
        <div className="form-actions"><Link className="button button-secondary" to="/incidencias">Cancelar</Link><button className="button button-primary" type="submit"><FloppyDisk size={18} weight="bold" /> Registrar solicitud</button></div>
      </form>
    </section>
  );
}
