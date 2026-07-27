import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  FileArrowUp,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { type ChangeEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deliverAsset,
  getAssignmentCatalog,
  type AssignmentCatalog,
  type DeliveryPayload,
} from "@/modules/assignments/assignmentRepository";

const steps = ["Bien", "Responsable", "Ubicación y entrega", "Evidencias y firmas", "Revisión"];
const empty: DeliveryPayload = {
  asset_id: "",
  responsible_id: "",
  location_id: "",
  assignment_reason: "",
  condition: "Bueno",
  accessories: "",
  observations: "",
  checklist: {
    inspected: false,
    qr_legible: false,
    accessories_complete: false,
    no_unreported_damage: false,
  },
  privacy_accepted: false,
  evidence: [],
  signatures: [],
};

function SignaturePad({
  label,
  role,
  onChange,
}: {
  label: string;
  role: "ENTREGA" | "RECIBE";
  onChange: (value: DeliveryPayload["signatures"][number]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const helpId = useId();
  const [name, setName] = useState(role === "ENTREGA" ? "Rosa Medina" : "");
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<"DIBUJADA" | "CONFIRMACION">("DIBUJADA");

  const send = (nextMethod = method, nextConsent = consent) =>
    onChange({
      role,
      method: nextMethod,
      signer_name: name,
      signer_role: role === "ENTREGA" ? "Facility Management" : "Receptor",
      consent: nextConsent,
      signature_data_url:
        nextMethod === "DIBUJADA" ? canvas.current?.toDataURL("image/png") || "" : "",
    });

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const currentCanvas = canvas.current;
    if (!currentCanvas) return;

    const rect = currentCanvas.getBoundingClientRect();
    const context = currentCanvas.getContext("2d");
    if (!context) return;

    const x = (event.clientX - rect.left) * (currentCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (currentCanvas.height / rect.height);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.strokeStyle = "#002b58";

    if (!drawing.current) {
      currentCanvas.setPointerCapture(event.pointerId);
      context.beginPath();
      context.moveTo(x, y);
      drawing.current = true;
    } else {
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const chooseMethod = (nextMethod: "DIBUJADA" | "CONFIRMACION") => {
    setMethod(nextMethod);
    if (nextMethod === "CONFIRMACION") {
      const currentCanvas = canvas.current;
      currentCanvas?.getContext("2d")?.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
    }
    send(nextMethod);
  };

  return (
    <section className="signature-box">
      <h3>{label}</h3>
      <label className="field">
        <span>Nombre del firmante</span>
        <input
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
          onBlur={() => send()}
        />
      </label>

      <fieldset className="signature-methods">
        <legend>Método de conformidad</legend>
        <div>
          <label>
            <input
              type="radio"
              name={`signature-method-${role}`}
              checked={method === "DIBUJADA"}
              onChange={() => chooseMethod("DIBUJADA")}
            />
            <span>
              <strong>Firma en pantalla</strong>
              <small>Usa el mouse, lápiz o pantalla táctil.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name={`signature-method-${role}`}
              checked={method === "CONFIRMACION"}
              onChange={() => chooseMethod("CONFIRMACION")}
            />
            <span>
              <strong>Confirmación digital</strong>
              <small>Alternativa accesible sin trazo manual.</small>
            </span>
          </label>
        </div>
      </fieldset>

      {method === "DIBUJADA" ? (
        <>
          <p className="signature-help" id={helpId}>
            Traza la firma dentro del recuadro. Si no puedes usar un dispositivo apuntador,
            selecciona “Confirmación digital”.
          </p>
          <canvas
            ref={canvas}
            width={560}
            height={150}
            onPointerDown={point}
            onPointerMove={(event) => {
              if (drawing.current) point(event);
            }}
            onPointerUp={() => {
              drawing.current = false;
              send();
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
            aria-label={`Área para ${label.toLowerCase()}`}
            aria-describedby={helpId}
          />
          <button
            type="button"
            onClick={() => {
              const currentCanvas = canvas.current;
              currentCanvas
                ?.getContext("2d")
                ?.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
              send();
            }}
          >
            Limpiar firma
          </button>
        </>
      ) : (
        <div className="signature-confirmation" role="status">
          <ShieldCheck size={24} weight="duotone" />
          <p>
            <strong>Confirmación accesible habilitada</strong>
            <span>
              El nombre y el consentimiento quedarán registrados en el acta como conformidad
              digital.
            </span>
          </p>
        </div>
      )}

      <label className="consent-row">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => {
            const nextConsent = event.target.checked;
            setConsent(nextConsent);
            send(method, nextConsent);
          }}
        />
        Confirmo mi conformidad y consentimiento para registrar esta firma.
      </label>
    </section>
  );
}

export function AssignmentWizardPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<AssignmentCatalog | null>(null);
  const [draft, setDraft] = useState(empty);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"PERSONA" | "AREA" | "ESPACIO_COMUN">("PERSONA");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof deliverAsset>> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    getAssignmentCatalog()
      .then(setCatalog)
      .catch(() => setError("No se pudieron cargar los catálogos."));
  }, []);
  const set = <K extends keyof DeliveryPayload>(key: K, value: DeliveryPayload[K]) =>
    setDraft((x) => ({ ...x, [key]: value }));
  const signature = (value: DeliveryPayload["signatures"][number]) =>
    set("signatures", [...draft.signatures.filter((x) => x.role !== value.role), value]);
  const validate = () => {
    if (step === 0 && !draft.asset_id) return "Selecciona un bien.";
    if (step === 1 && (!draft.responsible_id || !draft.assignment_reason.trim()))
      return "Selecciona un responsable e ingresa el motivo.";
    if (step === 2 && (!draft.location_id || !Object.values(draft.checklist).every(Boolean)))
      return "Selecciona una ubicación y completa el checklist.";
    if (
      step === 3 &&
      (!draft.privacy_accepted ||
        !["general", "qr"].every((c) => draft.evidence.some((x) => x.category === c)) ||
        draft.signatures.length !== 2 ||
        draft.signatures.some(
          (x) =>
            !x.consent ||
            !x.signer_name.trim() ||
            (x.method === "DIBUJADA" && !x.signature_data_url),
        ))
    )
      return "Completa las evidencias, el aviso de privacidad y ambas conformidades.";
    return "";
  };
  const next = async () => {
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    if (step < 4) return setStep(step + 1);
    setSubmitting(true);
    try {
      setResult(await deliverAsset(draft));
    } catch {
      setError("No se pudo emitir el acta. Revisa los datos e inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>, category: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("El archivo supera 5 MB.");
    const data = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
    set("evidence", [
      ...draft.evidence.filter((x) => x.category !== category),
      {
        category,
        name: file.name,
        mime_type: file.type,
        size: file.size,
        description: category === "qr" ? "Etiqueta QR legible" : "Vista general del bien",
        content_data_url: data,
      },
    ]);
  };
  if (result)
    return (
      <section className="delivery-success">
        <CheckCircle size={52} weight="fill" />
        <h1>Bien entregado correctamente</h1>
        <p>La asignación quedó registrada y el acta fue emitida de forma inmutable.</p>
        <div className="delivery-summary">
          <div>
            <small>Bien</small>
            <strong>{result.asset.code}</strong>
            <span>{result.asset.name}</span>
          </div>
          <div>
            <small>Acta</small>
            <strong>{result.act?.code}</strong>
            <span className="status status-success">Emitida</span>
          </div>
          <div>
            <small>Responsable</small>
            <strong>{result.responsible.name}</strong>
            <span>{result.responsible.area}</span>
          </div>
          <div>
            <small>Estado</small>
            <strong>Entregado</strong>
            <span>Asignación activa</span>
          </div>
        </div>
        <section className="integrity-panel">
          <ShieldCheck size={24} />
          <div>
            <strong>Documento emitido e inmutable</strong>
            <code>{result.act?.hash_sha256}</code>
          </div>
        </section>
        <div className="success-actions">
          <button
            className="button button-secondary"
            onClick={() => navigate(`/asignaciones/${result.id}`)}
          >
            Ver detalle
          </button>
          <button className="button button-primary" onClick={() => navigate("/asignaciones")}>
            Volver a asignaciones
          </button>
        </div>
      </section>
    );
  const assets = catalog?.assets || [],
    responsibles = (catalog?.responsibles || []).filter((x) => x.type === type),
    locations = catalog?.locations || [];
  return (
    <section className="assignment-wizard">
      <div className="wizard-heading">
        <Link className="back-link" to="/asignaciones">
          <ArrowLeft />
          Volver a asignaciones
        </Link>
        <div>
          <div>
            <p className="breadcrumb">Nueva asignación</p>
            <h1>Entrega de bien</h1>
          </div>
          <span className="save-state">Borrador local</span>
        </div>
      </div>
      <ol className="assignment-stepper">
        {steps.map((x, i) => (
          <li className={i === step ? "is-current" : i < step ? "is-complete" : ""} key={x}>
            <span>{i < step ? <Check /> : i + 1}</span>
            <small>{x}</small>
          </li>
        ))}
      </ol>
      <div className="wizard-layout">
        <form
          className="form-panel assignment-form"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <header>
            <span>Paso {step + 1} de 5</span>
            <h2>{steps[step]}</h2>
          </header>
          {step === 0 && (
            <div className="section-gap">
              <label className="field">
                <span>Bien disponible *</span>
                <select value={draft.asset_id} onChange={(e) => set("asset_id", e.target.value)}>
                  <option value="">Seleccionar bien</option>
                  {assets.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} — {x.name} ({x.assignment_status})
                    </option>
                  ))}
                </select>
              </label>
              {draft.asset_id && (
                <article className="selected-record">
                  {assets
                    .filter((x) => x.id === draft.asset_id)
                    .map((x) => (
                      <div key={x.id}>
                        <strong>{x.code}</strong>
                        <h3>{x.name}</h3>
                        <p>
                          {x.brand} {x.model} · Condición {x.condition}
                        </p>
                      </div>
                    ))}
                </article>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="section-gap">
              <div className="segmented-control">
                {(["PERSONA", "AREA", "ESPACIO_COMUN"] as const).map((x) => (
                  <button
                    type="button"
                    className={type === x ? "is-active" : ""}
                    onClick={() => {
                      setType(x);
                      set("responsible_id", "");
                    }}
                    key={x}
                  >
                    {x === "PERSONA" ? "Persona" : x === "AREA" ? "Área" : "Espacio común"}
                  </button>
                ))}
              </div>
              <div className="responsible-options">
                {responsibles.map((x) => (
                  <label className={draft.responsible_id === x.id ? "is-selected" : ""} key={x.id}>
                    <input
                      type="radio"
                      name="responsible"
                      checked={draft.responsible_id === x.id}
                      onChange={() => set("responsible_id", x.id)}
                    />
                    <strong>{x.display_name}</strong>
                    <small>{x.area_name || x.external_reference}</small>
                  </label>
                ))}
              </div>
              <label className="field">
                <span>Motivo de la asignación *</span>
                <textarea
                  value={draft.assignment_reason}
                  onChange={(e) => set("assignment_reason", e.target.value)}
                />
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="section-gap">
              <label className="field">
                <span>Ubicación validada *</span>
                <select
                  value={draft.location_id}
                  onChange={(e) => set("location_id", e.target.value)}
                >
                  <option value="">Seleccionar ubicación</option>
                  {locations.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.zone} / {x.building} / {x.area} / {x.room}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Condición de entrega</span>
                <select value={draft.condition} onChange={(e) => set("condition", e.target.value)}>
                  <option>Nuevo</option>
                  <option>Bueno</option>
                  <option>Regular</option>
                  <option>Requiere revisión</option>
                </select>
              </label>
              <div className="delivery-checklist">
                {Object.entries({
                  inspected: "Bien físicamente inspeccionado",
                  qr_legible: "Código y QR legibles",
                  accessories_complete: "Accesorios completos",
                  no_unreported_damage: "Sin daños no registrados",
                }).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={draft.checklist[key]}
                      onChange={(e) =>
                        set("checklist", {
                          ...draft.checklist,
                          [key]: e.target.checked,
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <label className="field">
                <span>Accesorios incluidos</span>
                <textarea
                  value={draft.accessories}
                  onChange={(e) => set("accessories", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Observaciones</span>
                <textarea
                  value={draft.observations}
                  onChange={(e) => set("observations", e.target.value)}
                />
              </label>
            </div>
          )}
          {step === 3 && (
            <div className="section-gap">
              <aside className="privacy-notice">
                <ShieldCheck />
                <p>
                  <strong>Aviso de privacidad</strong>
                  <span>
                    Las fotografías y firmas se usarán únicamente para acreditar la entrega y serán
                    tratadas como datos protegidos.
                  </span>
                </p>
              </aside>
              <label className="consent-row">
                <input
                  type="checkbox"
                  checked={draft.privacy_accepted}
                  onChange={(e) => set("privacy_accepted", e.target.checked)}
                />
                He leído y acepto el aviso de privacidad.
              </label>
              <div className="evidence-pair">
                {[
                  ["general", "Vista general del bien"],
                  ["qr", "Etiqueta QR legible"],
                ].map(([category, label]) => (
                  <label className="upload-block" key={category}>
                    <FileArrowUp />
                    <strong>{label} *</strong>
                    <small>JPG o PNG · máximo 5 MB</small>
                    <input type="file" accept="image/*" onChange={(e) => upload(e, category)} />
                    {draft.evidence.some((x) => x.category === category) && (
                      <span className="status status-success">Adjuntado</span>
                    )}
                  </label>
                ))}
              </div>
              <SignaturePad label="Firma de quien entrega" role="ENTREGA" onChange={signature} />
              <SignaturePad
                label="Firma o conformidad de quien recibe"
                role="RECIBE"
                onChange={signature}
              />
            </div>
          )}
          {step === 4 && (
            <div className="review-stack section-gap">
              <article className="review-card">
                <header>
                  <h3>Bien y responsable</h3>
                  <button type="button" onClick={() => setStep(0)}>
                    Editar
                  </button>
                </header>
                <dl>
                  <div>
                    <dt>Bien</dt>
                    <dd>{assets.find((x) => x.id === draft.asset_id)?.name}</dd>
                  </div>
                  <div>
                    <dt>Responsable</dt>
                    <dd>
                      {
                        catalog?.responsibles.find((x) => x.id === draft.responsible_id)
                          ?.display_name
                      }
                    </dd>
                  </div>
                </dl>
              </article>
              <article className="review-card">
                <header>
                  <h3>Entrega</h3>
                  <button type="button" onClick={() => setStep(2)}>
                    Editar
                  </button>
                </header>
                <dl>
                  <div>
                    <dt>Ubicación</dt>
                    <dd>{locations.find((x) => x.id === draft.location_id)?.room}</dd>
                  </div>
                  <div>
                    <dt>Condición</dt>
                    <dd>{draft.condition}</dd>
                  </div>
                  <div>
                    <dt>Evidencias</dt>
                    <dd>{draft.evidence.length} archivos</dd>
                  </div>
                  <div>
                    <dt>Firmas</dt>
                    <dd>{draft.signatures.length} de 2</dd>
                  </div>
                </dl>
              </article>
              <aside className="immutable-warning">
                <WarningCircle />
                <p>
                  <strong>Emisión definitiva</strong>
                  <span>
                    Se cerrará la asignación anterior, se creará una nueva asignación activa y el
                    acta emitida no podrá reemplazarse.
                  </span>
                </p>
              </aside>
            </div>
          )}
          {error && (
            <p className="form-alert" role="alert">
              <WarningCircle />
              {error}
            </p>
          )}
          <div className="form-actions">
            {step > 0 ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setError("");
                  setStep(step - 1);
                }}
              >
                <ArrowLeft />
                Anterior
              </button>
            ) : (
              <Link className="button button-secondary" to="/asignaciones">
                Cancelar
              </Link>
            )}
            <button
              className="button button-primary"
              disabled={submitting || !catalog}
              type="submit"
            >
              {submitting ? (
                "Emitiendo acta…"
              ) : step === 4 ? (
                "Emitir acta y completar entrega"
              ) : (
                <>
                  Continuar <ArrowRight />
                </>
              )}
            </button>
          </div>
        </form>
        <aside className="help-panel">
          <h2>Control de entrega</h2>
          <p>
            Las reglas se validan en el servidor. El acta solo se emite cuando las evidencias y
            conformidades están completas.
          </p>
          <ul>
            <li>
              <Check />
              Una asignación activa
            </li>
            <li>
              <Check />
              Ubicación validada
            </li>
            <li>
              <Check />
              Dos conformidades
            </li>
            <li>
              <Check />
              Acta con hash
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
