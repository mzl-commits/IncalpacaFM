import { Camera, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { api } from "@/services/api";

type ImpactAnswer = "" | "SI" | "NO";
type AffectedPeople = "" | "SOLO_YO" | "VARIAS_PERSONAS" | "TODA_EL_AREA";
type SuggestedPriority = "NORMAL" | "URGENTE" | "EMERGENCIA";

interface PublicLocationOption {
  id: string;
  code: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  specificLocation: string;
  displayName: string;
}

interface PublicAssetContext {
  displayCode: string;
  name: string;
  photoUrl: string | null;
  generalLocation: string;
}

interface PublicRequestFormState {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  requesterDni: string;
  requesterWorkerCode: string;
  locationId: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  description: string;
  issueCategory: string;
  otherRequestDetail: string;
  assetCondition: string;
  startedWhen: string;
  photoName: string;
  cannotAttachPhoto: boolean;
  noPhotoReason: string;
  stopsWork: ImpactAnswer;
  safetyRisk: ImpactAnswer;
  essentialService: ImpactAnswer;
  biggerDamageRisk: ImpactAnswer;
  affectedPeople: AffectedPeople;
}

const initialForm: PublicRequestFormState = {
  requesterName: "",
  requesterEmail: "",
  requesterPhone: "",
  requesterDni: "",
  requesterWorkerCode: "",
  locationId: "",
  zone: "",
  building: "",
  area: "",
  room: "",
  description: "",
  issueCategory: "",
  otherRequestDetail: "",
  assetCondition: "",
  startedWhen: "",
  photoName: "",
  cannotAttachPhoto: false,
  noPhotoReason: "",
  stopsWork: "",
  safetyRisk: "",
  essentialService: "",
  biggerDamageRisk: "",
  affectedPeople: "",
};


const yesNoOptions = [
  { value: "SI", label: "Si" },
  { value: "NO", label: "No" },
] as const;

const priorityLabels: Record<SuggestedPriority, string> = {
  NORMAL: "Normal",
  URGENTE: "Urgente",
  EMERGENCIA: "Emergencia",
};

function calculateSuggestedPriority(form: PublicRequestFormState): SuggestedPriority {
  if (form.safetyRisk === "SI") return "EMERGENCIA";

  const urgentSignals = [
    form.stopsWork === "SI",
    form.essentialService === "SI",
    form.biggerDamageRisk === "SI",
    form.affectedPeople === "TODA_EL_AREA",
  ].filter(Boolean).length;

  if (urgentSignals >= 2 || form.affectedPeople === "VARIAS_PERSONAS") return "URGENTE";

  return "NORMAL";
}

function getPriorityReasons(form: PublicRequestFormState) {
  const reasons: string[] = [];
  if (form.stopsWork === "SI") reasons.push("Dificulta trabajar o usar el espacio");
  if (form.safetyRisk === "SI") reasons.push("Puede implicar un riesgo para las personas");
  if (form.essentialService === "SI") reasons.push("Afecta un servicio importante");
  if (form.biggerDamageRisk === "SI") reasons.push("Podría empeorar si esperamos");
  if (form.affectedPeople === "VARIAS_PERSONAS") reasons.push("Afecta a varias personas");
  if (form.affectedPeople === "TODA_EL_AREA") reasons.push("Afecta a toda el area");

  return reasons;
}
export function PublicWorkRequestPage() {
  const [assetToken] = useState(() => new URLSearchParams(window.location.search).get("asset")?.trim() ?? "");
  const [form, setForm] = useState<PublicRequestFormState>(initialForm);
  const [submittedCode, setSubmittedCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState<PublicLocationOption[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [asset, setAsset] = useState<PublicAssetContext | null>(null);
  const [assetLoadError, setAssetLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<PublicLocationOption[]>("/incidents/public/locations/")
      .then(({ data }) => {
        if (active) setLocations(data);
      })
      .catch(() => {
        if (active) setLocations([]);
      })
      .finally(() => {
        if (active) setLocationsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!assetToken) {
      setAsset(null);
      setAssetLoadError(false);
      return;
    }
    let active = true;
    setAssetLoadError(false);
    api.get<PublicAssetContext>(`/public/assets/${encodeURIComponent(assetToken)}/report/`)
      .then(({ data }) => { if (active) setAsset(data); })
      .catch(() => { if (active) { setAsset(null); setAssetLoadError(true); } });
    return () => { active = false; };
  }, [assetToken]);

  function updateField<K extends keyof PublicRequestFormState>(
    field: K,
    value: PublicRequestFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setError("");
  }

  const hasEvidence = Boolean(form.photoName) ||
    (form.cannotAttachPhoto && form.noPhotoReason.trim().length >= 10);
  const hasImpactAnswers = Boolean(
    form.stopsWork &&
      form.safetyRisk &&
      form.essentialService &&
      form.biggerDamageRisk &&
      form.affectedPeople,
  );
  const suggestedPriority = calculateSuggestedPriority(form);
  const priorityReasons = getPriorityReasons(form);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasEvidence) {
      setError("Adjunta una foto o explica por que no puedes hacerlo.");
      return;
    }

    if (!hasImpactAnswers) {
      setError("Responde todas las preguntas de impacto antes de continuar.");
      return;
    }
    if (!form.issueCategory || !form.assetCondition || !form.startedWhen || (form.issueCategory === "OTRO" && form.otherRequestDetail.trim().length < 5)) {
      setError("Completa los datos de la solicitud antes de continuar.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { data } = await api.post<{ code: string; emailSent?: boolean }>("/incidents/public/", {
        requesterName: form.requesterName.trim(),
        requesterEmail: form.requesterEmail.trim(),
        requesterPhone: form.requesterPhone.trim(),
        requesterDni: form.requesterDni.trim(),
        requesterWorkerCode: form.requesterWorkerCode.trim(),
        assetToken: assetToken || undefined,
        zone: form.zone,
        building: form.building.trim(),
        area: form.area.trim(),
        room: form.room.trim(),
        description: form.description.trim(),
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
        noPhotoReason: form.cannotAttachPhoto ? form.noPhotoReason.trim() : "",
        suggestedPriority,
        priorityReasons,
        impactAnswers: {
          issueCategory: form.issueCategory,
          otherRequestDetail: form.otherRequestDetail.trim(),
          assetCondition: form.assetCondition,
          startedWhen: form.startedWhen,
          stopsWork: form.stopsWork,
          safetyRisk: form.safetyRisk,
          essentialService: form.essentialService,
          biggerDamageRisk: form.biggerDamageRisk,
          affectedPeople: form.affectedPeople,
        },
      });

      setSubmittedCode(data.code);
      setForm(initialForm);
    } catch {
      setError("No se pudo registrar la solicitud. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="public-request-page">
      <section className="public-request-shell">
        <div className="page-heading">
          <div>
            <p className="breadcrumb">Solicitud de trabajo</p>
            <h1>Reportar una solicitud de mantenimiento</h1>
            <p>
              Cuéntanos qué necesitas para que el equipo pueda revisarlo y organizar la atención.
            </p>
          </div>
        </div>

        {asset && (
          <aside className="public-request-linked-asset">
            {asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <span>{asset.displayCode.slice(0, 2)}</span>}
            <div>
              <small>Reporte vinculado al bien identificado por QR</small>
              <strong>{asset.name}</strong>
              <p>{asset.displayCode} · {asset.generalLocation}</p>
            </div>
            <Link to={`/q/${encodeURIComponent(assetToken)}`}>Ver ficha del bien</Link>
          </aside>
        )}

        {assetLoadError && (
          <p className="public-request-linked-asset-error" role="alert">
            No se pudo vincular el bien del QR. Puedes enviar una solicitud general o volver a escanearlo.
          </p>
        )}

        {submittedCode && (
          <div className="public-request-success" role="status">
            <CheckCircle size={24} weight="fill" />
            <div>
              <strong>Solicitud registrada</strong>
              <p>Tu código de solicitud es {submittedCode}. El administrador revisará la prioridad final.</p>
              <Link className="button button-secondary" to={`/seguimiento-solicitud/${submittedCode}`}>
                Ver seguimiento
              </Link>
            </div>
          </div>
        )}

        <form className="data-panel public-request-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">1</span>
                <div>
                  <h2>Datos de contacto</h2>
                  <p>Indica tus datos para poder informarte sobre el avance de la solicitud.</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Nombre completo *</span>
                <input
                  required
                  value={form.requesterName}
                  onChange={(event) => updateField("requesterName", event.target.value)}
                  placeholder="Ej. Ana Torres"
                />
              </label>

              <label className="field">
                <span>Correo *</span>
                <input
                  required
                  type="email"
                  value={form.requesterEmail}
                  onChange={(event) => updateField("requesterEmail", event.target.value)}
                  placeholder="nombre@incalpaca.com"
                />
              </label>

              <label className="field">
                <span>Telefono o anexo</span>
                <input
                  value={form.requesterPhone}
                  onChange={(event) => updateField("requesterPhone", event.target.value)}
                  placeholder="Ej. 204 o 999 999 999"
                />
              </label>

              <label className="field">
                <span>DNI *</span>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  minLength={8}
                  maxLength={8}
                  value={form.requesterDni}
                  onChange={(event) => updateField("requesterDni", event.target.value.replace(/\D/g, ""))}
                  placeholder="8 dígitos"
                />
              </label>

              <label className="field">
                <span>Código de trabajador *</span>
                <input
                  required
                  value={form.requesterWorkerCode}
                  onChange={(event) => updateField("requesterWorkerCode", event.target.value.toUpperCase())}
                  placeholder="Ej. K4F89J"
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">2</span>
                <div>
                  <h2>Ubicación de la solicitud</h2>
                  <p>Ayudanos a ubicar exactamente donde se necesita la atención.</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>¿Qué solicitud necesitas registrar? *</span>
                <select required value={form.issueCategory} onChange={(event) => updateField("issueCategory", event.target.value)}>
                  <option value="">Seleccionar solicitud</option><option value="ELECTRICO">Iluminación o electricidad</option><option value="GASFITERIA">Agua, desagüe o gas</option><option value="CLIMATIZACION">Climatización</option><option value="MOBILIARIO">Mobiliario, puertas o ventanas</option><option value="ACABADOS">Paredes, pisos o acabados</option><option value="DISPENSADOR_AGUA">Dispensador de agua</option><option value="OTRO">Otra solicitud</option>
                </select>
              </label>
              {form.issueCategory === "OTRO" && <label className="field"><span>Cuéntanos qué necesitas *</span><input required minLength={5} value={form.otherRequestDetail} onChange={(event) => updateField("otherRequestDetail", event.target.value)} placeholder="Ej. Revisión de señalización" /></label>}
              <label className="field">
                <span>Estado actual *</span>
                <select required value={form.assetCondition} onChange={(event) => updateField("assetCondition", event.target.value)}><option value="">Seleccionar estado</option><option value="NO_FUNCIONA">No funciona</option><option value="FUNCIONA_PARCIALMENTE">Funciona parcialmente</option><option value="DANADO">Está dañado o deteriorado</option><option value="RIESGO">Presenta una condición de riesgo</option></select>
              </label>
              <label className="field">
                <span>¿Desde cuándo lo notas? *</span>
                <select required value={form.startedWhen} onChange={(event) => updateField("startedWhen", event.target.value)}><option value="">Seleccionar momento</option><option value="AHORA">Hace unos minutos</option><option value="HOY">Hoy</option><option value="SEMANA">Durante esta semana</option><option value="MAS_TIEMPO">Hace más de una semana</option></select>
              </label>
              <label className="field field-wide">
                <span>Ambiente oficial</span>
                <select
                  value={form.locationId}
                  onChange={(event) => {
                    const selected = locations.find((location) => location.id === event.target.value);
                    if (!selected) {
                      updateField("locationId", "");
                      return;
                    }
                    setForm((current) => ({
                      ...current,
                      locationId: selected.id,
                      zone: selected.zone,
                      building: selected.building,
                      area: selected.area,
                      room: selected.room,
                    }));
                    setError("");
                  }}
                >
                  <option value="">{locationsLoaded ? "Buscar por ambiente o código" : "Cargando ambientes..."}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.displayName}
                    </option>
                  ))}
                </select>
                <small>Si no encuentras el ambiente, completa los campos de abajo.</small>
              </label>

              <label className="field">
                <span>Zona *</span>
                <input
                  required
                  value={form.zone}
                  onChange={(event) => updateField("zone", event.target.value)}
                  placeholder="Ej. Zona Industrial"
                />
              </label>

              <label className="field">
                <span>Edificio *</span>
                <input
                  required
                  value={form.building}
                  onChange={(event) => updateField("building", event.target.value)}
                  placeholder="Ej. Edificio Administrativo"
                />
              </label>

              <label className="field">
                <span>Área *</span>
                <input
                  required
                  value={form.area}
                  onChange={(event) => updateField("area", event.target.value)}
                  placeholder="Ej. Sistemas"
                />
              </label>

              <label className="field">
                <span>Ambiente *</span>
                <input
                  required
                  value={form.room}
                  onChange={(event) => updateField("room", event.target.value)}
                  placeholder="Ej. Oficina 204"
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">3</span>
                <div>
                  <h2>Descripcion y evidencia</h2>
                  <p>Describe lo que necesitas y adjunta una foto para facilitar la revisión.</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field field-wide">
                <span>¿Qué necesitas que revisemos? *</span>
                <textarea
                  required
                  value={form.description}
                  minLength={10}
                  maxLength={1000}
                  rows={5}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Cuéntanos qué ocurre, desde cuándo y cualquier detalle que nos ayude a atenderte."
                />
                <small>{form.description.length} / 1000 caracteres</small>
              </label>
            </div>

            <div className="upload-box public-evidence-box">
              <Camera size={32} />
              <div>
                <strong>Adjuntar fotografia *</strong>
                <p>La foto es obligatoria. Formatos permitidos: JPG, PNG o WEBP.</p>
              </div>

              <label className="button button-secondary">
                Seleccionar archivo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={form.cannotAttachPhoto}
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

            <label className="field checkbox-field public-no-photo-option">
              <input
                type="checkbox"
                checked={form.cannotAttachPhoto}
                onChange={(event) => {
                  const checked = event.target.checked;
                  updateField("cannotAttachPhoto", checked);
                  if (checked) updateField("photoName", "");
                  if (!checked) updateField("noPhotoReason", "");
                }}
              />
              <span>No puedo adjuntar foto</span>
            </label>

            {form.cannotAttachPhoto && (
              <label className="field field-wide">
                <span>Explica por que no puedes adjuntar foto *</span>
                <textarea
                  required
                  value={form.noPhotoReason}
                  minLength={10}
                  maxLength={300}
                  rows={3}
                  onChange={(event) => updateField("noPhotoReason", event.target.value)}
                  placeholder="Ej. Lo que necesito revisar no es visible desde fuera."
                />
                <small>{form.noPhotoReason.length} / 300 caracteres</small>
              </label>
            )}

            {!hasEvidence && (
              <p className="public-evidence-warning">
                Adjunta una foto o explica por que no puedes hacerlo para continuar.
              </p>
            )}
          </div>

          <div className="form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">4</span>
                <div>
                  <h2>Para atenderte mejor</h2>
                  <p>Estas preguntas nos ayudan a entender qué tan pronto necesitas apoyo.</p>
                </div>
              </div>
            </div>

            <div className="public-impact-grid">
              <fieldset className="impact-question">
                <legend>¿Esto te impide trabajar o usar el espacio con normalidad? *</legend>
                <div>
                  {yesNoOptions.map((option) => (
                    <label key={option.value}>
                      <input
                        required
                        type="radio"
                        name="stopsWork"
                        value={option.value}
                        checked={form.stopsWork === option.value}
                        onChange={(event) =>
                          updateField("stopsWork", event.target.value as ImpactAnswer)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="impact-question">
                <legend>¿Ves algún riesgo para las personas? *</legend>
                <div>
                  {yesNoOptions.map((option) => (
                    <label key={option.value}>
                      <input
                        required
                        type="radio"
                        name="safetyRisk"
                        value={option.value}
                        checked={form.safetyRisk === option.value}
                        onChange={(event) =>
                          updateField("safetyRisk", event.target.value as ImpactAnswer)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="impact-question">
                <legend>¿Afecta un servicio importante para tu área? *</legend>
                <div>
                  {yesNoOptions.map((option) => (
                    <label key={option.value}>
                      <input
                        required
                        type="radio"
                        name="essentialService"
                        value={option.value}
                        checked={form.essentialService === option.value}
                        onChange={(event) =>
                          updateField("essentialService", event.target.value as ImpactAnswer)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="impact-question">
                <legend>¿Crees que podría empeorar si esperamos? *</legend>
                <div>
                  {yesNoOptions.map((option) => (
                    <label key={option.value}>
                      <input
                        required
                        type="radio"
                        name="biggerDamageRisk"
                        value={option.value}
                        checked={form.biggerDamageRisk === option.value}
                        onChange={(event) =>
                          updateField("biggerDamageRisk", event.target.value as ImpactAnswer)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="field field-wide">
                <span>Cuantas personas estan afectadas aproximadamente? *</span>
                <select
                  required
                  value={form.affectedPeople}
                  onChange={(event) =>
                    updateField("affectedPeople", event.target.value as AffectedPeople)
                  }
                >
                  <option value="">Seleccionar una opcion</option>
                  <option value="SOLO_YO">Solo yo</option>
                  <option value="VARIAS_PERSONAS">Varias personas</option>
                  <option value="TODA_EL_AREA">Toda el area</option>
                </select>
              </label>
            </div>

            <aside className={`suggested-priority is-${suggestedPriority.toLowerCase()}`}>
              <span>Prioridad sugerida</span>
              <strong>{hasImpactAnswers ? priorityLabels[suggestedPriority] : "Pendiente"}</strong>
              <p>
                Esta recomendacion ayudara al administrador, pero la decision final se revisará
                internamente.
              </p>

              {hasImpactAnswers && priorityReasons.length > 0 && (
                <ul>
                  {priorityReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </aside>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="public-request-actions">
            <button className="button button-primary" type="submit" disabled={!hasEvidence || submitting}>
              <PaperPlaneTilt size={18} weight="bold" />
              {submitting ? "Registrando..." : "Registrar solicitud"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
