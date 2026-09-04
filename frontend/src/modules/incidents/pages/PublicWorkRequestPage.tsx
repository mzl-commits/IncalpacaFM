import { Camera, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { api } from "@/services/api";
import type { SystemUser } from "@/modules/accounts/types";
import { type ImpactAnswer, type AffectedPeople, type SuggestedPriority, type PublicLocationOption, type PublicAssetContext, type PublicRequestFormState, initialForm, getLoggedRequester, calculateSuggestedPriority, getPriorityReasons, getSubmitErrorMessage, yesNoOptions } from '../components/publicWorkRequestUtils';

export function PublicWorkRequestPage() {
  const [assetToken] = useState(() => new URLSearchParams(window.location.search).get("asset")?.trim() ?? "");
  const loggedRequester = useMemo(() => getLoggedRequester(), []);
  const [form, setForm] = useState<PublicRequestFormState>(initialForm);
  const [submittedCode, setSubmittedCode] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState<PublicLocationOption[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [asset, setAsset] = useState<PublicAssetContext | null>(null);
  const [assetLoadError, setAssetLoadError] = useState(false);
  const [isAssetLoading, setIsAssetLoading] = useState(!!assetToken);
  const [identityMessage, setIdentityMessage] = useState("");

  useEffect(() => {
    if (!loggedRequester) return;
    setForm((current) => ({
      ...current,
      requesterName: loggedRequester.fullName || current.requesterName,
      requesterEmail: loggedRequester.email || current.requesterEmail,
      requesterDni: loggedRequester.dni || current.requesterDni,
      requesterWorkerCode: loggedRequester.workerCode || current.requesterWorkerCode,
      requesterPhone: "",
    }));
  }, [loggedRequester]);

  useEffect(() => {
    if (loggedRequester) return;
    const dni = form.requesterDni.trim();
    const workerCode = form.requesterWorkerCode.trim();
    if (dni.length !== 8 && !workerCode) { setIdentityMessage(""); return; }
    const timer = window.setTimeout(() => {
      api.get<{ found: boolean; reporter?: { name: string; email: string; dni: string; workerCode: string } }>("/organization/reporters/lookup/", { params: { dni, worker_code: workerCode } })
        .then(({ data }) => {
          if (!data.found || !data.reporter) { setIdentityMessage("No encontramos un registro; completa tus datos."); return; }
          setForm((current) => ({ ...current, requesterName: data.reporter!.name || current.requesterName, requesterEmail: data.reporter!.email || current.requesterEmail, requesterDni: data.reporter!.dni, requesterWorkerCode: data.reporter!.workerCode }));
          setIdentityMessage("Datos encontrados. Puedes editarlos antes de enviar el reporte.");
        })
        .catch(() => setIdentityMessage("No se pudo verificar la identidad; puedes continuar completando los datos."));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form.requesterDni, form.requesterWorkerCode, loggedRequester]);

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
            site: data.site ?? current.site,
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
  const siteOptions = useMemo(() => Array.from(new Set(locations.map((location) => location.site || "Sede principal"))).filter(Boolean), [locations]);
  const zoneOptions = useMemo(() => Array.from(new Set(
    locations
      .filter((location) => !form.site || (location.site || "Sede principal") === form.site)
      .map((location) => location.zone),
  )).filter(Boolean), [locations, form.site]);
  const buildingOptions = useMemo(() => Array.from(new Set(
    locations
      .filter((location) => (!form.site || (location.site || "Sede principal") === form.site) && (!form.zone || location.zone === form.zone))
      .map((location) => location.building),
  )).filter(Boolean), [locations, form.site, form.zone]);
  const areaOptions = useMemo(() => Array.from(new Set(
    locations
      .filter((location) => (!form.site || (location.site || "Sede principal") === form.site) && (!form.zone || location.zone === form.zone) && (!form.building || location.building === form.building))
      .map((location) => location.area),
  )).filter(Boolean), [locations, form.site, form.zone, form.building]);
  const roomOptions = useMemo(() => locations.filter((location) =>
    (!form.site || (location.site || "Sede principal") === form.site) &&
    (!form.zone || location.zone === form.zone) &&
    (!form.building || location.building === form.building) &&
    (!form.area || location.area === form.area),
  ), [locations, form.site, form.zone, form.building, form.area]);
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
        site: assetLocation.site || "Sede principal",
        zone: assetLocation.zone,
        building: assetLocation.building,
        area: assetLocation.area,
        room: assetLocation.room,
      };
    });
  }, [assetLocation]);

  useEffect(() => {
    if (!form.site && siteOptions.length === 1) {
      setForm((current) => ({ ...current, site: siteOptions[0] }));
      return;
    }
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
        site: selected.site || "Sede principal",
        zone: selected.zone,
        building: selected.building,
        area: selected.area,
        room: selected.room,
      }));
    }
  }, [areaOptions, buildingOptions, form.area, form.building, form.locationId, form.site, form.zone, roomOptions, siteOptions, zoneOptions]);

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
      setError("Completa la clasificaciÃ³n de la solicitud antes de continuar.");
      return;
    }
    if (form.issueCategory === "OTRO" && form.otherIssueCategoryDetail.trim().length < 3) {
      setError("Indica quÃ© tipo de solicitud es en el campo Otro.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const requestPayload = {
        requesterName: form.requesterName.trim(),
        requesterEmail: form.requesterEmail.trim(),
        requesterPhone: form.requesterPhone.trim(),
        requesterDni: form.requesterDni.trim(),
        requesterWorkerCode: form.requesterWorkerCode.trim(),
        assetToken: assetToken || undefined,
        locationId: form.locationId,
        site: form.site,
        zone: form.zone,
        building: form.building.trim(),
        area: form.area.trim(),
        room: form.room.trim(),
        description: form.description.trim(),
        evidence: form.photoName
          ? [
              {
                id: createClientId("evidence"),
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
          assetTypeDetail: form.assetTypeDetail.trim(),
          assetCondition: form.assetCondition,
          startedWhen: form.startedWhen,
          stopsWork: form.stopsWork,
          safetyRisk: form.safetyRisk,
          essentialService: form.essentialService,
          biggerDamageRisk: form.biggerDamageRisk,
          affectedPeople: form.affectedPeople,
        },
      };

      const { data } = loggedRequester
        ? await api.post<{ id: string; code: string }>("/incidents/", {
            requesterName: loggedRequester.fullName,
            requesterEmail: loggedRequester.email,
            requesterContact: {
              name: loggedRequester.fullName,
              email: loggedRequester.email,
              workerCode: loggedRequester.workerCode,
            },
            locationId: form.locationId,
            zone: form.zone,
            building: form.building.trim(),
            area: form.area.trim(),
            room: form.room.trim(),
            requestType: form.issueCategory || "OTRO",
            description: form.description.trim(),
            requesterPriority: suggestedPriority,
            project: false,
            evidence: form.photoName
              ? [
                  {
                    id: createClientId("evidence"),
                    name: form.photoName,
                    mimeType: "image/*",
                    size: 0,
                  },
                ]
              : [],
            impactAssessment: {
              suggestedPriority,
              priorityReasons,
              answers: requestPayload.impactAnswers,
              noPhotoReason: form.cannotAttachPhoto ? form.noPhotoReason.trim() : "",
            },
            status: "PENDIENTE",
          })
        : await api.post<{ id?: string; code: string; emailSent?: boolean }>("/incidents/public/", requestPayload);

      setSubmittedCode(data.code);
      setSubmittedId(data.id ?? "");
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
              <p>{asset.displayCode} Â· {asset.generalLocation}</p>
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
              <p>Tu cÃ³digo de solicitud es {submittedCode}. El administrador revisarÃ¡ la prioridad final.</p>
              <Link
                className="button button-secondary"
                to={loggedRequester && submittedId ? `/incidencias/${submittedId}` : `/seguimiento-solicitud/${submittedCode}`}
              >
                {loggedRequester ? "Ver mi solicitud" : "Ver seguimiento"}
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
                  <h2>Datos del solicitante</h2>
                  <p>{loggedRequester ? "Usaremos los datos de tu cuenta para registrar la solicitud." : "Indica tus datos para poder informarte sobre el avance de la solicitud."}</p>
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
                  readOnly={Boolean(loggedRequester)}
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
                  readOnly={Boolean(loggedRequester)}
                  placeholder="nombre@incalpaca.com"
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
                  readOnly={Boolean(loggedRequester)}
                  placeholder="8 dÃ­gitos"
                />
              </label>

              <label className="field">
                <span>CÃ³digo de trabajador *</span>
                <input
                  required
                  value={form.requesterWorkerCode}
                  onChange={(event) => updateField("requesterWorkerCode", event.target.value.toUpperCase())}
                  readOnly={Boolean(loggedRequester)}
                  placeholder="Ej. K4F89J"
                />
              </label>
              {identityMessage && <p className="form-hint" role="status">{identityMessage}</p>}
            </div>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">2</span>
                <div>
                  <h2>UbicaciÃ³n de la solicitud</h2>
                  <p>Selecciona la sede, Ã¡rea macro, Ã¡rea y mÃ³dulo/ambiente donde se necesita la atenciÃ³n.</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Â¿QuÃ© tipo de solicitud es? *</span>
                <select required value={form.issueCategory} onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({
                    ...current,
                    issueCategory: value,
                    otherIssueCategoryDetail: value === "OTRO" ? current.otherIssueCategoryDetail : "",
                  }));
                  setError("");
                }}>
                  <option value="">Seleccionar tipo</option><option value="ELECTRICO">ElÃ©ctrico o iluminaciÃ³n</option><option value="GASFITERIA">Agua, desagÃ¼e o gas</option><option value="CLIMATIZACION">ClimatizaciÃ³n</option><option value="MOBILIARIO">Mobiliario, puertas o ventanas</option><option value="INFRAESTRUCTURA">Acabados, pintura, paredes o techo</option><option value="EQUIPO">Equipo o dispositivo</option><option value="OTRO">Otro</option>
                </select>
              </label>
              <label className="field">
                <span>Tipo de bien o equipo afectado</span>
                <input
                  value={form.assetTypeDetail}
                  onChange={(event) => updateField("assetTypeDetail", event.target.value)}
                  placeholder={asset ? `Ej. ${asset.name}` : "Ej. Laptop, Impresora, Silla ergonÃ³mica, Aire acondicionado"}
                  maxLength={120}
                />
              </label>
              {form.issueCategory === "OTRO" && (
                <label className="field field-wide">
                  <span>Â¿QuÃ© tipo de solicitud crees que es? *</span>
                  <input
                    required
                    value={form.otherIssueCategoryDetail}
                    onChange={(event) => updateField("otherIssueCategoryDetail", event.target.value)}
                    placeholder="Ej. SeÃ±alÃ©tica, apoyo especial, revisiÃ³n puntual"
                    maxLength={120}
                  />
                </label>
              )}
              <label className="field">
                <span>Estado actual *</span>
                <select required value={form.assetCondition} onChange={(event) => updateField("assetCondition", event.target.value)}><option value="">Seleccionar estado</option><option value="NO_FUNCIONA">No funciona</option><option value="FUNCIONA_PARCIALMENTE">Funciona parcialmente</option><option value="DANADO">EstÃ¡ daÃ±ado o deteriorado</option><option value="RIESGO">Presenta una condiciÃ³n de riesgo</option></select>
              </label>
              <label className="field">
                <span>Â¿CuÃ¡ndo empezÃ³? *</span>
                <select required value={form.startedWhen} onChange={(event) => updateField("startedWhen", event.target.value)}><option value="">Seleccionar momento</option><option value="AHORA">Hace unos minutos</option><option value="HOY">Hoy</option><option value="SEMANA">Esta semana</option><option value="MAS_TIEMPO">Hace mÃ¡s de una semana</option></select>
              </label>
              {!asset && !isAssetLoading && (
                <>
                  <label className="field">
                    <span>Sede *</span>
                    <select
                      required
                      value={form.site}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          locationId: "",
                          site: event.target.value,
                          zone: "",
                          building: "",
                          area: "",
                          room: "",
                        }));
                        setError("");
                      }}
                      disabled={!locationsLoaded}
                    >
                      <option value="">{locationsLoaded ? "Seleccionar sede" : "Cargando ubicaciones..."}</option>
                      {siteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>Ãrea macro *</span>
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
                      disabled={!form.site}
                    >
                      <option value="">{form.site ? "Seleccionar Ã¡rea macro" : "Primero selecciona una sede"}</option>
                      {zoneOptions.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>Ãrea *</span>
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
                      <option value="">{form.zone ? "Seleccionar Ã¡rea" : "Primero selecciona un Ã¡rea macro"}</option>
                      {buildingOptions.map((building) => <option key={building} value={building}>{building}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>MÃ³dulo / ambiente *</span>
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
                      <option value="">{form.building ? "Seleccionar mÃ³dulo o ambiente" : "Primero selecciona un Ã¡rea"}</option>
                      {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span>Detalle del ambiente *</span>
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
                          site: selected.site || "Sede principal",
                          zone: selected.zone,
                          building: selected.building,
                          area: selected.area,
                          room: selected.room,
                        }));
                        setError("");
                      }}
                      disabled={!form.area}
                    >
                      <option value="">{form.area ? "Seleccionar detalle" : "Primero selecciona un mÃ³dulo o ambiente"}</option>
                      {roomOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.room}{location.specificLocation ? ` - ${location.specificLocation}` : ""} ({location.code})
                        </option>
                      ))}
                    </select>
                    <small>Las opciones se van reduciendo segÃºn lo que elijas.</small>
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
                  <p>Describe la atenciÃ³n requerida y adjunta una foto para facilitar la revisiÃ³n.</p>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field field-wide">
                <span>Â¿QuÃ© necesitas solicitar? *</span>
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
                  placeholder="Ej. La situaciÃ³n estÃ¡ dentro del equipo y no es visible desde fuera."
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
                <legend>Â¿La situaciÃ³n impide realizar tus actividades normalmente? *</legend>
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
                <legend>Â¿Existe riesgo para la seguridad o salud de las personas? *</legend>
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
                <legend>Â¿Afecta un equipo o servicio indispensable? *</legend>
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
                <legend>Â¿Puede generar daÃ±os mayores si no se atiende pronto? *</legend>
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
                <span>Â¿CuÃ¡ntas personas estÃ¡n afectadas aproximadamente? *</span>
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
                Esta recomendaciÃ³n ayudarÃ¡ al administrador, pero la decisiÃ³n final se revisarÃ¡
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
