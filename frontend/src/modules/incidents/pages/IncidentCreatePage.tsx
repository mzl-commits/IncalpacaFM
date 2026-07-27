import { ArrowLeft, Camera, FloppyDisk } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { currentUser } from "@/modules/accounts/currentUser";
import {
  REQUEST_PRIORITIES,
  REQUEST_TYPES,
  requestPriorityLabels,
  requestTypeLabels,
  type RequestPriority,
  type RequestType,
} from "@/modules/incidents/incidentModel";
import { createWorkRequest } from "@/modules/incidents/incidentRepository";

interface RequestFormState {
  zone: string;
  building: string;
  area: string;
  room: string;
  requestType: RequestType | "";
  description: string;
  requesterPriority: RequestPriority;
  project: boolean;
  photoName: string;
}

const initialForm: RequestFormState = {
  zone: "",
  building: "",
  area: "",
  room: "",
  requestType: "",
  description: "",
  requesterPriority: "NORMAL",
  project: false,
  photoName: "",
};

export function IncidentCreatePage() {
  const navigate = useNavigate();
  const errorId = useId();

  const [form, setForm] = useState<RequestFormState>(initialForm);
  const [error, setError] = useState("");

  function updateField<K extends keyof RequestFormState>(field: K, value: RequestFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !form.zone ||
      !form.building ||
      !form.area ||
      !form.room ||
      !form.requestType ||
      form.description.trim().length < 10
    ) {
      setError(
        "Completa todos los campos obligatorios y describe el problema con al menos 10 caracteres.",
      );
      return;
    }

    setError("");

    await createWorkRequest({
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      requesterEmail: currentUser.email,

      locationId: [form.zone, form.building, form.area, form.room].join("-"),

      zone: form.zone,
      building: form.building,
      area: form.area,
      room: form.room,

      requestType: form.requestType as RequestType,
      description: form.description.trim(),
      requesterPriority: form.requesterPriority,
      project: form.project,

      evidence: form.photoName
        ? [
            {
              id: crypto.randomUUID(),
              name: form.photoName,
              mimeType: "image/*",
              size: 0,
            },
          ]
        : [],

      status: "PENDIENTE",
    });

    navigate("/incidencias");
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Solicitudes / Nueva solicitud</p>

          <h1>Nueva solicitud de trabajo</h1>

          <p>
            Registra el problema, indica su ubicación y adjunta una evidencia para facilitar su
            evaluación.
          </p>
        </div>

        <Link className="button button-secondary" to="/incidencias">
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
                <h2>Ubicación de la solicitud</h2>
                <p>Indica exactamente dónde se requiere la atención.</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Zona *</span>

              <select
                required
                value={form.zone}
                aria-invalid={Boolean(error && !form.zone)}
                aria-describedby={error && !form.zone ? errorId : undefined}
                onChange={(event) => updateField("zone", event.target.value)}
              >
                <option value="">Seleccionar zona</option>
                <option value="Zona Industrial">Zona Industrial</option>
                <option value="Casona">Casona</option>
                <option value="Planta Principal">Planta Principal</option>
                <option value="Oficinas Administrativas">Oficinas Administrativas</option>
              </select>
            </label>

            <label className="field">
              <span>Edificio *</span>

              <input
                required
                value={form.building}
                aria-invalid={Boolean(error && !form.building)}
                aria-describedby={error && !form.building ? errorId : undefined}
                onChange={(event) => updateField("building", event.target.value)}
                placeholder="Ej. Edificio Administrativo"
              />
            </label>

            <label className="field">
              <span>Área *</span>

              <input
                required
                value={form.area}
                aria-invalid={Boolean(error && !form.area)}
                aria-describedby={error && !form.area ? errorId : undefined}
                onChange={(event) => updateField("area", event.target.value)}
                placeholder="Ej. Sistemas"
              />
            </label>

            <label className="field">
              <span>Ambiente *</span>

              <input
                required
                value={form.room}
                aria-invalid={Boolean(error && !form.room)}
                aria-describedby={error && !form.room ? errorId : undefined}
                onChange={(event) => updateField("room", event.target.value)}
                placeholder="Ej. Oficina 204"
              />
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">2</span>

              <div>
                <h2>Detalle del trabajo solicitado</h2>
                <p>Describe claramente la necesidad o el problema reportado.</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Tipo de solicitud *</span>

              <select
                required
                value={form.requestType}
                aria-invalid={Boolean(error && !form.requestType)}
                aria-describedby={error && !form.requestType ? errorId : undefined}
                onChange={(event) => updateField("requestType", event.target.value as RequestType)}
              >
                <option value="">Seleccionar tipo</option>

                {REQUEST_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {requestTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Prioridad del solicitante *</span>

              <select
                required
                value={form.requesterPriority}
                onChange={(event) =>
                  updateField("requesterPriority", event.target.value as RequestPriority)
                }
              >
                {REQUEST_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {requestPriorityLabels[priority]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-wide">
              <span>Descripción del problema *</span>

              <textarea
                required
                value={form.description}
                minLength={10}
                aria-invalid={Boolean(error && form.description.trim().length < 10)}
                aria-describedby={
                  error && form.description.trim().length < 10 ? errorId : undefined
                }
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Describe qué ocurre, desde cuándo y cualquier detalle importante."
                rows={5}
                maxLength={1000}
              />

              <small>{form.description.length} / 1000 caracteres</small>
            </label>

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={form.project}
                onChange={(event) => updateField("project", event.target.checked)}
              />

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
                <p>Adjunta una fotografía que ayude a identificar el problema.</p>
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
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  updateField("photoName", file?.name ?? "");
                }}
              />
            </label>
          </div>

          {form.photoName && (
            <p className="selected-file">
              Archivo seleccionado: <strong>{form.photoName}</strong>
            </p>
          )}
        </div>

        {error && (
          <div className="form-error" id={errorId} role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div className="form-actions">
          <Link className="button button-secondary" to="/incidencias">
            Cancelar
          </Link>

          <button className="button button-primary" type="submit">
            <FloppyDisk size={18} weight="bold" />
            Registrar solicitud
          </button>
        </div>
      </form>
    </section>
  );
}
