import {
  ArrowLeft,
  FloppyDisk,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
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

import { createWorkOrder } from "@/modules/workorders/workOrderRepository";

interface WorkOrderFormState {
  operatorId: string;
  operatorName: string;

  supervisorId: string;
  supervisorName: string;

  specialty: Specialty | "";
  adminPriority: AdminPriority;
  scheduledDate: string;
  administratorNotes: string;
}

const operators = [
  {
    id: "USR-OPE-001",
    name: "Carlos Mamani",
  },
  {
    id: "USR-OPE-002",
    name: "Luis Quispe",
  },
  {
    id: "USR-OPE-003",
    name: "Miguel Condori",
  },
];

const supervisors = [
  {
    id: "USR-SUP-001",
    name: "Rosa Medina",
  },
  {
    id: "USR-SUP-002",
    name: "Elena Torres",
  },
];

const initialForm: WorkOrderFormState = {
  operatorId: "",
  operatorName: "",

  supervisorId: "",
  supervisorName: "",

  specialty: "",
  adminPriority: "MEDIA",
  scheduledDate: "",
  administratorNotes: "",
};

export function WorkOrderCreatePage() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState<Awaited<ReturnType<typeof getWorkRequestById>>>();
  useEffect(() => {
    if (requestId) void getWorkRequestById(requestId).then(setRequest);
  }, [requestId]);

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
      administratorNotes:
        form.administratorNotes.trim(),

      progressPercentage: 0,
    });

    await updateWorkRequest(request.id, {
      status: "CONVERTIDA_EN_OT",
      workOrderId: workOrder.id,
    });

    navigate(
      `/ordenes-trabajo/${workOrder.id}`,
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
            <label className="field">
              <span>Operario *</span>

              <select
                value={form.operatorId}
                onChange={(event) => {
                  const operator =
                    operators.find(
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
                    operator?.name ?? "",
                  );
                }}
              >
                <option value="">
                  Seleccionar operario
                </option>

                {operators.map((operator) => (
                  <option
                    key={operator.id}
                    value={operator.id}
                  >
                    {operator.name}
                  </option>
                ))}
              </select>
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
                    supervisor?.name ?? "",
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
                    {supervisor.name}
                  </option>
                ))}
              </select>
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
