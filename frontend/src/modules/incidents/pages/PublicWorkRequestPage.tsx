import { Camera, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  locationId?: string;
  zone?: string;
  building?: string;
  area?: string;
  room?: string;
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
  otherIssueCategoryDetail: string;
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
  otherIssueCategoryDetail: "",
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
  if (form.stopsWork === "SI") reasons.push("Impide realizar actividades normalmente");
  if (form.safetyRisk === "SI") reasons.push("Existe riesgo para seguridad o salud");
  if (form.essentialService === "SI") reasons.push("Afecta un equipo o servicio indispensable");
  if (form.biggerDamageRisk === "SI") reasons.push("Puede generar daños mayores");
  if (form.affectedPeople === "VARIAS_PERSONAS") reasons.push("Afecta a varias personas");
  if (form.affectedPeople === "TODA_EL_AREA") reasons.push("Afecta a toda el area");

  return reasons;
}
function getSubmitErrorMessage(error: unknown) {
  const response = error && typeof error === "object" && "response" in error
    ? (error as { response?: { data?: unknown } }).response
    : undefined;
  const data = response?.data;
  if (data && typeof data === "object") {
    const values = Object.values(data as Record<string, unknown>).flat();
    const first = values.find((value) => typeof value === "string");
    if (typeof first === "string") return first;
  }
  return "No se pudo registrar la solicitud. Intenta nuevamente.";
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
  const [isAssetLoading, setIsAssetLoading] = useState(!!assetToken);

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
      setIsAssetLoading(false);
      return;
    }
    let active = true;
    setIsAssetLoading(true);
    setAssetLoadError(false);
    api.get<PublicAssetContext>(`/public/assets/${encodeURIComponent(assetToken)}/report/`)
      .then(({ data }) => {
        if (!active) return;
        setAsset(data);
        if (data.locationId) {
          setForm((current) => ({
            ...current,
            locationId: data.locationId ?? current.locationId,
            zone: data.zone ?? current.zone,
            building: data.building ?? current.building,
            area: data.area ?? current.area,
            room: data.room ?? current.room,
          }));
        }
      })
      .catch(() => { if (active) { setAsset(null); setAssetLoadError(true); } })
      .finally(() => { if (active) setIsAssetLoading(false); });
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
  const zoneOptions = useMemo(() => Array.from(new Set(locations.map((location) => location.zone))).filter(Boolean), [locations]);
  const buildingOptions = useMemo(() => Array.from(new Set(
    locations
      .filter((location) => !form.zone || location.zone === form.zone)
      .map((location) => location.building),
  )).filter(Boolean), [locations, form.zone]);
  const areaOptions = useMemo(() => Array.from(new Set(
    locations
      .filter((location) => (!form.zone || location.zone === form.zone) && (!form.building || location.building === form.building))
      .map((location) => location.area),
  )).filter(Boolean), [locations, form.zone, form.building]);
  const roomOptions = useMemo(() => locations.filter((location) =>
    (!form.zone || location.zone === form.zone) &&
    (!form.building || location.building === form.building) &&
    (!form.area || location.area === form.area),
  ), [locations, form.zone, form.building, form.area]);
  const assetLocation = useMemo(() => {
    if (!asset) return null;
    return locations.find((location) => location.id === asset.locationId) ??
      locations.find((location) =>
        location.zone === asset.zone &&
        location.building === asset.building &&
        location.area === asset.area &&
        location.room === asset.room,
      ) ??
      null;
  }, [asset, locations]);

  useEffect(() => {
    if (!assetLocation) return;
    setForm((current) => {
      if (current.locationId === assetLocation.id) return current;
      return {
        ...current,
        locationId: assetLocation.id,
        zone: assetLocation.zone,
        building: assetLocation.building,
        area: assetLocation.area,
        room: assetLocation.room,
      };
    });
  }, [assetLocation]);

  useEffect(() => {
    if (!form.zone && zoneOptions.length === 1) {
      setForm((current) => ({ ...current, zone: zoneOptions[0] }));
      return;
    }
    if (form.zone && !form.building && buildingOptions.length === 1) {
      setForm((current) => ({ ...current, building: buildingOptions[0] }));
      return;
    }
    if (form.building && !form.area && areaOptions.length === 1) {
      setForm((current) => ({ ...current, area: areaOptions[0] }));
      return;
    }
    if (form.area && !form.locationId && roomOptions.length === 1) {
      const selected = roomOptions[0];
      setForm((current) => ({
        ...current,
        locationId: selected.id,
        zone: selected.zone,
        building: selected.building,
        area: selected.area,
        room: selected.room,
      }));
    }
  }, [areaOptions, buildingOptions, form.area, form.building, form.locationId, form.zone, roomOptions, zoneOptions]);

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
    if (!form.issueCategory || !form.assetCondition || !form.startedWhen) {
      setError("Completa la clasificación de la solicitud antes de continuar.");
      return;
    }
    if (form.issueCategory === "OTRO" && form.otherIssueCategoryDetail.trim().length < 3) {
      setError("Indica qué tipo de solicitud es en el campo Otro.");
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
          otherIssueCategoryDetail: form.issueCategory === "OTRO" ? form.otherIssueCategoryDetail.trim() : "",
          otherRequestDetail: form.issueCategory === "OTRO" ? form.otherIssueCategoryDetail.trim() : "",
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
    } catch (submitError) {
      setError(getSubmitErrorMessage(submitError));
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
              Completa los datos de la solicitud para que el equipo pueda revisarla y priorizarla.
            </p>
          </div>
        </div>

        {isAssetLoading && (
          <aside className="public-request-linked-asset skeleton-asset" style={{ display: 'flex', gap: '16px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#e2e8f0', borderRadius: '8px', flexShrink: 0, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <div style={{ width: '60%', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
              <div style={{ width: '80%', height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
              <div style={{ width: '40%', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
            </div>
          </aside>
        )}

        {!isAssetLoading && asset && (
          <aside className="public-request-linked-asset">
            {asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <span>{asset.displayCode.slice(0, 2)}</span>}
            <div>
              <small>Solicitud vinculada al bien identificado por QR</small>
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
                  <p>Ayúdanos a ubicar exactamente dónde se necesita la atención.</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>¿Qué tipo de solicitud es? *</span>
                <select required value={form.issueCategory} onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({
                    ...current,
                    issueCategory: value,
                    otherIssueCategoryDetail: value === "OTRO" ? current.otherIssueCategoryDetail : "",
                  }));
                  setError("");
                }}>
                  <option value="">Seleccionar tipo</option><option value="ELECTRICO">Eléctrico o iluminación</option><option value="GASFITERIA">Agua, desagüe o gas</option><option value="CLIMATIZACION">Climatización</option><option value="MOBILIARIO">Mobiliario, puertas o ventanas</option><option value="INFRAESTRUCTURA">Acabados, pintura, paredes o techo</option><option value="EQUIPO">Equipo o dispositivo</option><option value="OTRO">Otro</option>
                </select>
              </label>
              {form.issueCategory === "OTRO" && (
                <label className="field field-wide">
                  <span>¿Qué tipo de solicitud crees que es? *</span>
                  <input
                    required
                    value={form.otherIssueCategoryDetail}
                    onChange={(event) => updateField("otherIssueCategoryDetail", event.target.value)}
                    placeholder="Ej. Señalética, apoyo especial, revisión puntual"
                    maxLength={120}
                  />
                </label>
              )}
              <label className="field">
                <span>Estado actual *</span>
                <select required value={form.assetCondition} onChange={(event) => updateField("assetCondition", event.target.value)}><option value="">Seleccionar estado</option><option value="NO_FUNCIONA">No funciona</option><option value="FUNCIONA_PARCIALMENTE">Funciona parcialmente</option><option value="DANADO">Está dañado o deteriorado</option><option value="RIESGO">Presenta una condición de riesgo</option></select>
              </label>
              <label className="field">
                <span>¿Cuándo empezó? *</span>
                <select required value={form.startedWhen} onChange={(event) => updateField("startedWhen", event.target.value)}><option value="">Seleccionar momento</option><option value="AHORA">Hace unos minutos</option><option value="HOY">Hoy</option><option value="SEMANA">Esta semana</option><option value="MAS_TIEMPO">Hace más de una semana</option></select>
              </label>
              {!asset && !isAssetLoading && (
                <>
                  <label className="field">
                    <span>Zona *</span>
                    <select
                      required
                      value={form.zone}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          locationId: "",
                          zone: event.target.value,
                          building: "",
                          area: "",
                          room: "",
                        }));
                        setError("");
                      }}
                      disabled={!locationsLoaded}
                    >
                      <option value="">{locationsLoaded ? "Seleccionar zona" : "Cargando ubicaciones..."}</option>
                      {zoneOptions.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>Edificio *</span>
                    <select
                      required
                      value={form.building}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          locationId: "",
                          building: event.target.value,
                          area: "",
                          room: "",
                        }));
                        setError("");
                      }}
                      disabled={!form.zone}
                    >
                      <option value="">{form.zone ? "Seleccionar edificio" : "Primero selecciona una zona"}</option>
                      {buildingOptions.map((building) => <option key={building} value={building}>{building}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>Área *</span>
                    <select
                      required
                      value={form.area}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          locationId: "",
                          area: event.target.value,
                          room: "",
                        }));
                        setError("");
                      }}
                      disabled={!form.building}
                    >
                      <option value="">{form.building ? "Seleccionar área" : "Primero selecciona un edificio"}</option>
                      {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>Ambiente *</span>
                    <select
                      required
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
                      disabled={!form.area}
                    >
                      <option value="">{form.area ? "Seleccionar ambiente" : "Primero selecciona un área"}</option>
                      {roomOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.room}{location.specificLocation ? ` - ${location.specificLocation}` : ""} ({location.code})
                        </option>
                      ))}
                    </select>
                    <small>Las opciones se van reduciendo según lo que elijas.</small>
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">3</span>
                <div>
                  <h2>Descripcion y evidencia</h2>
                  <p>Describe la atención requerida y adjunta una foto para facilitar la revisión.</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field field-wide">
                <span>¿Qué necesitas solicitar? *</span>
                <textarea
                  required
                  value={form.description}
                  minLength={10}
                  maxLength={1000}
                  rows={5}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Cuenta que ocurre, desde cuando y cualquier detalle importante."
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
                  placeholder="Ej. La situación está dentro del equipo y no es visible desde fuera."
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
                  <h2>Evaluacion del impacto</h2>
                  <p>Responde estas preguntas para ayudarnos a dar la prioridad correcta.</p>
                </div>
              </div>
            </div>

            <div className="public-impact-grid">
              <fieldset className="impact-question">
                <legend>¿La situación impide realizar tus actividades normalmente? *</legend>
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
                <legend>¿Existe riesgo para la seguridad o salud de las personas? *</legend>
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
                <legend>¿Afecta un equipo o servicio indispensable? *</legend>
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
                <legend>¿Puede generar daños mayores si no se atiende pronto? *</legend>
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
                <span>¿Cuántas personas están afectadas aproximadamente? *</span>
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
                Esta recomendación ayudará al administrador, pero la decisión final se revisará
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
