import {
  ArrowLeft,
  FloppyDisk,
  Sparkle,
} from "@phosphor-icons/react";
import { useEffect, useState, useMemo } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getWorkRequestAssetDisplayCode,
  getWorkRequestById,
  updateWorkRequest,
} from "@/modules/incidents/incidentRepository";

import {
  ADMIN_PRIORITIES,
  SPECIALTIES,
  adminPriorityLabels,
  specialtyLabels,
  type AdminPriority,
  type Specialty,
} from "@/modules/workorders/workOrderModel";

import { OperatorAvailabilityPanel, findScheduleConflicts } from "@/modules/workorders/components/OperatorAvailabilityPanel";
import { createWorkOrder, listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { listTechnicians, type Technician } from "@/modules/accounts/technicianRepository";

function specialtyMatch(specialty: string, type: string) { const value = `${specialty} ${type}`.toLowerCase(); return ["electric", "gasfit", "carpint", "sold", "pint", "clima"].some((word) => value.includes(word)); }
function hoursFormat(value: number) { return `${Math.round(value * 10) / 10} h`; }

interface WorkOrderFormState {
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

const initialForm: WorkOrderFormState = {
  operatorId: "",
  operatorName: "",
  technicianWorkerCode: "",
  supportingWorkerCodes: [],

  supervisorId: "",
  supervisorName: "",

  specialty: "",
  adminPriority: "MEDIA",
  scheduledDate: "",
  scheduledStartTime: "08:00",
  plannedHours: 2,
  administratorNotes: "",
};

export function WorkOrderCreatePage() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState<Awaited<ReturnType<typeof getWorkRequestById>>>();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);

  useEffect(() => {
    if (requestId) void getWorkRequestById(requestId).then(setRequest);
    void listTechnicians().then((people) => setTechnicians(people.filter((person) => person.active)));
    void listWorkOrders().then(setOrders);
  }, [requestId]);

  const topRecommendation = useMemo(() => {
    if (!request || technicians.length === 0) return null;
    const candidates = technicians.map((person) => { 
      const assigned = orders.filter((order) => order.operatorId === person.id && order.scheduledDate >= new Date().toISOString().slice(0, 10) && !["CERRADA", "CANCELADA"].includes(order.status)); 
      const scheduledHours = assigned.reduce((sum, order) => sum + order.plannedHours, 0); 
      const matching = specialtyMatch(person.specialty, request.requestType); 
      const urgency = request.requesterPriority === "EMERGENCIA" ? 14 : request.requesterPriority === "URGENTE" ? 9 : 4; 
      const score = Math.max(0, 100 - scheduledHours * 9 + (matching ? 22 : 0) + urgency); 
      return { person, scheduledHours, matching, score, reason: `${matching ? "Especialidad compatible" : "Especialidad general"} · ${hoursFormat(scheduledHours)} ya programadas` }; 
    }).sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0] : null;
  }, [request, technicians, orders]);

  const supervisors = useMemo(() => {
    const activeSupervisors = technicians.filter((person) => person.role === "SUPERVISOR");
    return activeSupervisors.length
      ? activeSupervisors
      : technicians.filter((person) => person.role === "ADMINISTRADOR");
  }, [technicians]);

  const [form, setForm] =
    useState<WorkOrderFormState>(initialForm);

  const [error, setError] = useState("");

  function updateField<
    K extends keyof WorkOrderFormState,
  >(
    field: K,
    value: WorkOrderFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  useEffect(() => {
    if (supervisors.length === 1 && form.supervisorId !== supervisors[0].id) {
      updateField("supervisorId", supervisors[0].id);
      updateField("supervisorName", supervisors[0].full_name);
      return;
    }
    if (form.supervisorId && !supervisors.some((person) => person.id === form.supervisorId)) {
      updateField("supervisorId", "");
      updateField("supervisorName", "");
    }
  }, [form.supervisorId, supervisors]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !request ||
      !form.operatorId ||
      !form.supervisorId ||
      !form.specialty ||
      !form.scheduledDate
    ) {
      setError(
        "Completa todos los campos obligatorios antes de generar la orden.",
      );
      return;
    }
    const conflicts = findScheduleConflicts({
      orders,
      operatorId: form.operatorId,
      dates: [form.scheduledDate],
      startTime: form.scheduledStartTime,
      plannedHours: form.plannedHours,
    });
    if (conflicts.length) {
      setError(`El operario ya tiene una orden en ese horario: ${conflicts.map((order) => order.code).join(", ")}.`);
      return;
    }

    const workOrder = await createWorkOrder({
      requestId: request.id,
      requestCode: request.code,

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
      administratorNotes:
        form.administratorNotes.trim(),

      progressPercentage: 0,
    });

    await updateWorkRequest(request.id, {
      status: "CONVERTIDA_EN_OT",
      workOrderId: workOrder.id,
    });

    navigate(
      `/órdenes-trabajo/${workOrder.id}`,
    );
  }

  if (!request) {
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">
              Mantenimiento / Órdenes de trabajo
            </p>

            <h1>Solicitud no encontrada</h1>

            <p>
              No se encontró la solicitud que deseas
              convertir en orden de trabajo.
            </p>
          </div>

          <Link
            className="button button-secondary"
            to="/incidencias"
          >
            <ArrowLeft size={18} />
            Volver
          </Link>
        </div>
      </section>
    );
  }

  if (
    request.status !== "APROBADA" &&
    request.status !== "CONVERTIDA_EN_OT"
  ) {
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">
              Mantenimiento / Órdenes de trabajo
            </p>

            <h1>Solicitud no aprobada</h1>

            <p>
              Solo las solicitudes aprobadas pueden
              convertirse en órdenes de trabajo.
            </p>
          </div>

          <Link
            className="button button-secondary"
            to={`/incidencias/${request.id}`}
          >
            <ArrowLeft size={18} />
            Volver
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            Mantenimiento / Solicitudes /{" "}
            {request.code} / Generar OT
          </p>

          <h1>Generar orden de trabajo</h1>

          <p>
            Programa la atención y asigna al personal
            responsable.
          </p>
        </div>

        <Link
          className="button button-secondary"
          to={`/incidencias/${request.id}`}
        >
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <div className="detail-header data-panel">
        <div>
          <span className="detail-code">
            {request.code}
          </span>

          <h2>{request.description}</h2>

          <p>
            {request.building} — {request.area} /{" "}
            {request.room}
            {getWorkRequestAssetDisplayCode(request) && (
              <> · Bien {getWorkRequestAssetDisplayCode(request)}</>
            )}
          </p>
        </div>
      </div>

      <form
        className="data-panel"
        onSubmit={handleSubmit}
      >
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">
                1
              </span>

              <div>
                <h2>Asignación de responsables</h2>
                <p>
                  Selecciona quién ejecutará y quién
                  supervisará el trabajo.
                </p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            {topRecommendation && (
              <div className="recommendation-widget" style={{ gridColumn: "1 / -1", backgroundColor: "var(--brand-surface)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--brand-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <div style={{ backgroundColor: "var(--brand-primary)", color: "white", padding: "10px", borderRadius: "50%", display: "flex" }}>
                    <Sparkle size={20} weight="fill" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Sugerencia inteligente: {topRecommendation.person.full_name}</h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                      {topRecommendation.reason} ({topRecommendation.score} pts)
                    </p>
                  </div>
                </div>
                <button type="button" className="button button-primary" onClick={() => {
                  updateField("operatorId", topRecommendation.person.id);
                  updateField("operatorName", topRecommendation.person.full_name);
                  updateField("technicianWorkerCode", topRecommendation.person.worker_code ?? "");
                }}>
                  Asignar sugerencia
                </button>
              </div>
            )}
            <label className="field">
              <span>Operario *</span>

              <select
                value={form.operatorId}
                onChange={(event) => {
                  const operator =
                    technicians.find(
                      (item) =>
                        item.id ===
                        event.target.value,
                    );

                  updateField(
                    "operatorId",
                    operator?.id ?? "",
                  );

                  updateField(
                    "operatorName",
                    operator?.full_name ?? "",
                  );
                  updateField("technicianWorkerCode", operator?.worker_code ?? "");
                }}
              >
                <option value="">
                  Seleccionar operario
                </option>

                {technicians.map((operator) => (
                  <option
                    key={operator.id}
                    value={operator.id}
                  >
                    {operator.full_name} · {operator.specialty || "Sin especialidad"}
                  </option>
                ))}
              </select>
            </label>


            <div className="field field-wide">
              <OperatorAvailabilityPanel
                orders={orders}
                operatorId={form.operatorId}
                operatorName={form.operatorName}
                selectedDate={form.scheduledDate}
                startTime={form.scheduledStartTime}
                plannedHours={form.plannedHours}
              />
            </div>
            <label className="field">
              <span>Técnicos de apoyo</span>
              <select multiple value={form.supportingWorkerCodes} onChange={(event) => updateField("supportingWorkerCodes", Array.from(event.target.selectedOptions).map((option) => option.value))}>
                {technicians.filter((person) => person.worker_code !== form.technicianWorkerCode).map((person) => <option key={person.id} value={person.worker_code}>{person.full_name} · {person.specialty || "Sin especialidad"}</option>)}
              </select>
              <small>Opcional. Usa Ctrl o Cmd para seleccionar varios técnicos.</small>
            </label>

            <label className="field">
              <span>Supervisor *</span>

              <select
                value={form.supervisorId}
                onChange={(event) => {
                  const supervisor =
                    supervisors.find(
                      (item) =>
                        item.id ===
                        event.target.value,
                    );

                  updateField(
                    "supervisorId",
                    supervisor?.id ?? "",
                  );

                  updateField(
                    "supervisorName",
                    supervisor?.full_name ?? "",
                  );
                }}
              >
                <option value="">
                  Seleccionar supervisor
                </option>

                {supervisors.map((supervisor) => (
                  <option
                    key={supervisor.id}
                    value={supervisor.id}
                  >
                    {supervisor.full_name}
                  </option>
                ))}
              </select>
              {!supervisors.length && <small>No hay supervisores activos registrados.</small>}
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">
                2
              </span>

              <div>
                <h2>Programación</h2>
                <p>
                  Define la especialidad, prioridad y
                  fecha prevista.
                </p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Especialidad *</span>

              <select
                value={form.specialty}
                onChange={(event) =>
                  updateField(
                    "specialty",
                    event.target.value as Specialty,
                  )
                }
              >
                <option value="">
                  Seleccionar especialidad
                </option>

                {SPECIALTIES.map((specialty) => (
                  <option
                    key={specialty}
                    value={specialty}
                  >
                    {specialtyLabels[specialty]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>
                Prioridad administrativa *
              </span>

              <select
                value={form.adminPriority}
                onChange={(event) =>
                  updateField(
                    "adminPriority",
                    event.target
                      .value as AdminPriority,
                  )
                }
              >
                {ADMIN_PRIORITIES.map(
                  (priority) => (
                    <option
                      key={priority}
                      value={priority}
                    >
                      {
                        adminPriorityLabels[
                          priority
                        ]
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="field">
              <span>Fecha programada *</span>

              <input
                type="date"
                value={form.scheduledDate}
                onChange={(event) =>
                  updateField(
                    "scheduledDate",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="field">
              <span>Horas previstas *</span>
              <input
                type="number"
                min={1}
                max={16}
                value={form.plannedHours}
                onChange={(event) => updateField("plannedHours", Number(event.target.value))}
              />
              <small>Se considera en la carga semanal del técnico.</small>
            </label>

            <label className="field">
              <span>Hora de inicio *</span>
              <input type="time" value={form.scheduledStartTime} onChange={(event) => updateField("scheduledStartTime", event.target.value)} />
              <small>Se muestra en el cronograma de cada técnico asignado.</small>
            </label>

            <label className="field field-wide">
              <span>
                Observaciones del administrador
              </span>

              <textarea
                value={
                  form.administratorNotes
                }
                onChange={(event) =>
                  updateField(
                    "administratorNotes",
                    event.target.value,
                  )
                }
                placeholder="Indicaciones adicionales para el operario."
                rows={4}
                maxLength={1000}
              />

              <small>
                {
                  form.administratorNotes
                    .length
                }{" "}
                / 1000 caracteres
              </small>
            </label>

          </div>
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <div className="form-actions">
          <Link
            className="button button-secondary"
            to={`/incidencias/${request.id}`}
          >
            Cancelar
          </Link>

          <button
            className="button button-primary"
            type="submit"
          >
            <FloppyDisk
              size={18}
              weight="bold"
            />
            Generar orden de trabajo
          </button>
        </div>
      </form>
    </section>
  );
}


