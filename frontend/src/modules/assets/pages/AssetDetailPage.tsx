import {
  ArrowLeft,
  Archive,
  CheckCircle,
  DownloadSimple,
  FloppyDisk,
  MapPin,
  PencilSimple,
  Printer,
  Tag,
  UserCircle,
  UserPlus,
  Wrench,
  X,
} from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/modules/accounts/AuthContext";
import {
  getAssetDetail,
  classifyAsset,
  printAssetPdf,
  updateAssetDetail,
  type AssetDetailRecord,
  type AssetDetailUpdate,
} from "@/modules/assets/assetDetailRepository";
import { ModelCreatableSelect } from "@/modules/assets/components/ModelCreatableSelect";
import { TaxonomyPicker } from "@/modules/taxonomy/components/TaxonomyPicker";
import { listWorkOrders } from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

type DetailTab = "overview" | "responsibles" | "repairs" | "qr";
type ResponsibleItem = AssetDetailRecord["responsible_history"][number];

function displayCode(asset: AssetDetailRecord) {
  return asset.display_code || asset.fm_code || asset.code;
}

export function AssetDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [asset, setAsset] = useState<AssetDetailRecord | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retirementWorkOrder, setRetirementWorkOrder] = useState<WorkOrder | null>(null);
  // New Responsible Modal State
  const [addingResponsible, setAddingResponsible] = useState(false);
  const [newRespForm, setNewRespForm] = useState({
    responsible: "",
    area: "",
    building: "",
    room: "",
    reason: "",
    start_date: new Date().toISOString().slice(0, 10),
  });

  // Edit Existing Responsible Item State
  const [editingResponsibleItem, setEditingResponsibleItem] = useState<ResponsibleItem | null>(null);
  const [editRespForm, setEditRespForm] = useState({
    responsible: "",
    area: "",
    status: "FINALIZADA",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const [classifying, setClassifying] = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [classificationTaxonomyId, setClassificationTaxonomyId] = useState("");
  const [classificationError, setClassificationError] = useState("");
  const [editForm, setEditForm] = useState<AssetDetailUpdate>({
    name: "",
    description: "",
    brand: "",
    model: "",
    serial_number: "",
    condition: "",
    criticality: "",
  });

  useEffect(() => {
    getAssetDetail(id)
      .then(setAsset)
      .catch(() => setError("No se pudo cargar la ficha del bien."));
  }, [id]);

  useEffect(() => {
    if (!asset?.id || user?.role !== "ADMINISTRADOR") return;
    let active = true;
    void listWorkOrders()
      .then((orders) => {
        if (!active) return;
        const related = orders
          .filter((order) => order.assetId === asset.id && order.status !== "CANCELADA")
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
        setRetirementWorkOrder(related ?? null);
      })
      .catch(() => active && setRetirementWorkOrder(null));
    return () => { active = false; };
  }, [asset?.id, user?.role]);

  useEffect(() => {
    if (asset)
      QRCode.toDataURL(asset.public_url, {
        width: 420,
        margin: 2,
        color: { dark: "#002b58", light: "#ffffff" },
      }).then(setQr);
  }, [asset]);

  if (!asset)
    return <section className="loading-panel">{error || "Cargando ficha del bien…"}</section>;

  // Robustly determine active assignment: checks status or end_date === null or first element in history
  const activeAssignment =
    asset.responsible_history.find(
      (item) =>
        item.status?.toUpperCase() === "ACTIVA" ||
        item.status?.toUpperCase() === "ACTIVO" ||
        item.status?.toUpperCase() === "ASIGNADO" ||
        item.end_date === null ||
        !item.end_date
    ) || asset.responsible_history[0];

  function openEditor() {
    if (!asset) return;
    setEditForm({
      name: asset.name,
      description: asset.description,
      brand: asset.brand,
      model: asset.model,
      serial_number: asset.serial_number ?? "",
      condition: asset.condition,
      criticality: asset.criticality,
      photo_url: asset.photo_url ?? "",
    });
    setEditError("");
    setSaved(false);
    setEditing(true);
  }

  function updateEditField<Key extends keyof AssetDetailUpdate>(
    field: Key,
    value: AssetDetailUpdate[Key],
  ) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function saveAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset) return;
    setSaving(true);
    setEditError("");
    try {
      const updated = await updateAssetDetail(asset.id, editForm);
      setAsset(updated);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch {
      setEditError("No se pudieron guardar los cambios. Revisa los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }
  function handleOpenAddResponsible() {
    setNewRespForm({
      responsible: activeAssignment?.responsible && activeAssignment.responsible !== "Sin asignar" ? activeAssignment.responsible : "",
      area: activeAssignment?.area || "",
      building: asset?.location_detail?.building || "",
      room: asset?.location_detail?.room || "",
      reason: "",
      start_date: new Date().toISOString().slice(0, 10),
    });
    setAddingResponsible(true);
  }

  function saveNewResponsible(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset) return;

    const nowIso = new Date().toISOString();
    const startDateIso = newRespForm.start_date
      ? new Date(newRespForm.start_date).toISOString()
      : nowIso;

    // Finalize previous active assignment if any
    const updatedHistory = asset.responsible_history.map((item) => {
      if (
        item.status?.toUpperCase() === "ACTIVA" ||
        item.status?.toUpperCase() === "ACTIVO" ||
        !item.end_date
      ) {
        return {
          ...item,
          status: "FINALIZADA",
          end_date: startDateIso,
        };
      }
      return item;
    });

    const newEntry = {
      id: `RESP-${Date.now()}`,
      responsible: newRespForm.responsible.trim(),
      type: "PERSONA",
      area: newRespForm.area.trim() || "Operaciones",
      start_date: startDateIso,
      end_date: null,
      status: "ACTIVA",
      reason: newRespForm.reason.trim() || "Asignación oficial de activo",
    };

    const updatedLocation =
      newRespForm.building || newRespForm.room
        ? {
            zone: asset.location_detail?.zone || "Sede Principal",
            building: newRespForm.building.trim() || asset.location_detail?.building || "Edificio Principal",
            area: newRespForm.area.trim() || asset.location_detail?.area || "Área Operativa",
            room: newRespForm.room.trim() || asset.location_detail?.room || "Oficina",
            specific_location: asset.location_detail?.specific_location || "",
          }
        : asset.location_detail;

    const updatedAsset: AssetDetailRecord = {
      ...asset,
      assignment_status: "Asignado",
      location_detail: updatedLocation,
      responsible_history: [newEntry, ...updatedHistory],
    };

    setAsset(updatedAsset);
    setAddingResponsible(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3500);
  }

  function handleOpenEditResponsible(item: ResponsibleItem) {
    setEditingResponsibleItem(item);
    setEditRespForm({
      responsible: item.responsible,
      area: item.area || "",
      status: item.status?.toUpperCase() === "ACTIVA" ? "ACTIVA" : "FINALIZADA",
      start_date: toInputDate(item.start_date),
      end_date: toInputDate(item.end_date),
      reason: item.reason || "",
    });
  }

  function saveEditResponsible(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset || !editingResponsibleItem) return;

    const startDateIso = editRespForm.start_date
      ? new Date(editRespForm.start_date).toISOString()
      : editingResponsibleItem.start_date;
    const endDateIso = editRespForm.end_date
      ? new Date(editRespForm.end_date).toISOString()
      : null;

    const isNewActive = editRespForm.status === "ACTIVA";

    const updatedHistory = asset.responsible_history.map((item) => {
      if (item.id === editingResponsibleItem.id) {
        return {
          ...item,
          responsible: editRespForm.responsible.trim(),
          area: editRespForm.area.trim(),
          status: editRespForm.status,
          start_date: startDateIso,
          end_date: isNewActive ? null : endDateIso,
          reason: editRespForm.reason.trim(),
        };
      }
      if (isNewActive && (item.status?.toUpperCase() === "ACTIVA" || !item.end_date)) {
        return {
          ...item,
          status: "FINALIZADA",
          end_date: startDateIso,
        };
      }
      return item;
    });

    const updatedAsset: AssetDetailRecord = {
      ...asset,
      assignment_status: updatedHistory.some((i) => i.status === "ACTIVA") ? "Asignado" : "Sin asignar",
      responsible_history: updatedHistory,
    };

    setAsset(updatedAsset);
    setEditingResponsibleItem(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3500);
  }

  async function completeClassification() {
    if (!asset || !classificationTaxonomyId) {
      setClassificationError("Selecciona una taxonomía activa.");
      return;
    }
    setClassifying(true);
    setClassificationError("");
    try {
      const updated = await classifyAsset(asset.id, classificationTaxonomyId);
      setAsset(updated);
      setClassificationOpen(false);
      setClassificationTaxonomyId("");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch {
      setClassificationError("No se pudo clasificar el bien. La taxonomía puede haber cambiado; actualiza la selección e inténtalo nuevamente.");
    } finally {
      setClassifying(false);
    }
  }

  return (
    <section className="asset-record-page">
      {saved && (
        <div className="asset-edit-success" role="status">
          <CheckCircle weight="fill" />
          Historial de responsables y Situación Actual registrados correctamente.
        </div>
      )}
      <Link className="back-link" to="/bienes">
        <ArrowLeft />
        Volver a bienes
      </Link>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Bienes / Ficha</p>
          <h1>{asset.name}</h1>
          <p>{displayCode(asset)}{asset.fm_code && <small> · {asset.code}</small>}</p>
        </div>
        <div className="detail-actions">
          <span
            className={`status ${asset.assignment_status === "Sin asignar" ? "status-neutral" : "status-success"}`}
          >
            {asset.assignment_status}
          </span>
          {user?.role === "ADMINISTRADOR" && (
            <button className="button button-secondary" type="button" onClick={openEditor}>
              <PencilSimple />
              Editar ficha
            </button>
          )}
          {user?.role === "ADMINISTRADOR" && (
            retirementWorkOrder ? (
              <Link
                className="button button-danger"
                to={`/ordenes-trabajo/${retirementWorkOrder.id}/diagnostico`}
                title={`Iniciar evaluación de baja desde ${retirementWorkOrder.code}`}
              >
                <Archive />
                Iniciar baja
              </Link>
            ) : (
              <Link
                className="button button-secondary"
                to="/ordenes-trabajo"
                title="Una baja requiere una orden de trabajo y diagnóstico técnico"
              >
                <Archive />
                Preparar baja
              </Link>
            )
          )}
          <button className="button button-primary" type="button" onClick={handleOpenAddResponsible}>
            <UserPlus />
            Asignar nuevo responsable
          </button>
          <button className="button button-secondary" onClick={() => void printAssetPdf(asset.id)}>
            <Printer />
            Imprimir ficha
          </button>
        </div>
      </div>
      {user?.role === "ADMINISTRADOR" && (!asset.fm_code || !asset.taxonomy_detail) && (
        <section className="asset-classification-callout">
          <Tag size={25} weight="duotone" />
          <div><strong>Clasificación pendiente</strong><p>Asigna una taxonomía validada para reservar el código FM sin cambiar el identificador técnico ni el enlace QR.</p></div>
          <button className="button button-primary" type="button" onClick={() => setClassificationOpen((current) => !current)}>{classificationOpen ? "Cerrar" : "Completar clasificación"}</button>
        </section>
      )}
      {classificationOpen && (
        <section className="asset-classification-panel" aria-labelledby="asset-classification-title">
          <header><div><span>Administración</span><h2 id="asset-classification-title">Asignar taxonomía y código FM</h2><p>El código se reservará transaccionalmente al confirmar.</p></div><code>{asset.code}</code></header>
          <TaxonomyPicker selectedId={classificationTaxonomyId} onSelect={(taxonomy) => { setClassificationTaxonomyId(taxonomy.id); setClassificationError(""); }} error={classificationError} />
          <footer><button className="button button-secondary" type="button" onClick={() => { setClassificationOpen(false); setClassificationError(""); }}>Cancelar</button><button className="button button-primary" type="button" disabled={classifying || !classificationTaxonomyId} onClick={completeClassification}>{classifying ? "Clasificando…" : "Confirmar clasificación"}</button></footer>
        </section>
      )}
      <nav className="record-tabs" aria-label="Secciones de la ficha">
        {(
          [
            ["overview", "Resumen"],
            ["responsibles", `Responsables (${asset.responsible_history.length})`],
            ["repairs", `Reparaciones (${asset.repair_history.length})`],
            ["qr", "Código QR"],
          ] as Array<[DetailTab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <div className="asset-record-layout">
          <section className="detail-section">
            <div className="asset-detail-photo-wrap">
              {asset.photo_url ? <img src={asset.photo_url} alt={`Fotografía registrada de ${asset.name}`} /> : <div className="asset-detail-photo-empty"><Tag size={30} /><span>Este bien no tiene fotografía registrada</span></div>}
            </div>
            <h2>Información del bien</h2>
            <p className="record-description">{asset.description}</p>
            <dl className="record-facts">
              <div>
                <dt>Código FM</dt>
                <dd>{displayCode(asset)}</dd>
              </div>
              <div>
                <dt>Identificador técnico</dt>
                <dd>{asset.code}</dd>
              </div>
              <div>
                <dt>Marca / modelo</dt>
                <dd>{[asset.brand, asset.model].filter(Boolean).join(" ") || "No registrado"}</dd>
              </div>
              <div>
                <dt>Número de serie</dt>
                <dd>{asset.serial_number || "No registrado"}</dd>
              </div>
              <div>
                <dt>Condición</dt>
                <dd>{asset.condition}</dd>
              </div>
              <div>
                <dt>Clasificación</dt>
                <dd>
                  {asset.taxonomy_detail
                    ? `${asset.taxonomy_detail.prefix ? `${asset.taxonomy_detail.prefix} — ` : ""}${asset.taxonomy_detail.category} / ${asset.taxonomy_detail.subcategory}`
                    : "Pendiente"}
                </dd>
              </div>
              <div>
                <dt>Ingreso</dt>
                <dd>
                  {asset.entry_type_label} · {formatDate(asset.created_at)}
                </dd>
              </div>
            </dl>
          </section>
          <aside className="detail-section current-custody">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <h2>Situación actual</h2>
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={handleOpenAddResponsible}
              >
                <UserPlus size={14} /> Cambiar
              </button>
            </div>
            <div>
              <MapPin />
              <span>
                <small>Ubicación</small>
                <strong>
                  {asset.location_detail
                    ? `${asset.location_detail.building} / ${asset.location_detail.area} / ${asset.location_detail.room}`
                    : "Por confirmar"}
                </strong>
              </span>
            </div>
            <div>
              <UserCircle />
              <span>
                <small>Responsable actual</small>
                <strong>{activeAssignment?.responsible || "Sin asignar"}</strong>
                {activeAssignment?.area && <small>{activeAssignment.area}</small>}
              </span>
            </div>
          </aside>
        </div>
      )}
      {tab === "responsibles" && (
        <section className="detail-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2>Historial de responsables</h2>
            <button className="button button-primary" type="button" onClick={handleOpenAddResponsible}>
              <UserPlus />
              Asignar nuevo responsable
            </button>
          </div>
          <HistoryResponsibleList
            items={asset.responsible_history}
            onEdit={handleOpenEditResponsible}
          />
        </section>
      )}
      {tab === "repairs" && (
        <section className="detail-section">
          <h2>Historial de reparaciones</h2>
          <RepairList items={asset.repair_history} />
        </section>
      )}
      {tab === "qr" && (
        <section className="detail-section qr-record">
          <div>
            <h2>Identificación QR</h2>
            <p>Este código abre la ficha pública segura del bien.</p>
            <strong>{displayCode(asset)}</strong>
            {asset.fm_code && <small>ID técnico: {asset.code}</small>}
          </div>
          {qr && <img src={qr} alt={`Código QR de ${displayCode(asset)}`} />}
          <div className="qr-record-actions">
            <button className="button button-primary" onClick={() => void printAssetPdf(asset.id)}>
              <Printer />
              Imprimir etiqueta
            </button>
            <a className="button button-secondary" href={qr} download={`${displayCode(asset)}-QR.png`}>
              <DownloadSimple />
              Descargar PNG
            </a>
          </div>
        </section>
      )}

      {/* EDIT ASSET MODAL */}
      {editing && (
        <div className="asset-edit-backdrop" role="presentation">
          <section
            className="asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-edit-title"
          >
            <header>
              <div>
                <span>Edición administrativa</span>
                <h2 id="asset-edit-title">Actualizar ficha del bien</h2>
                <p>{displayCode(asset)}{asset.fm_code && ` · ${asset.code}`}</p>
              </div>
              <button type="button" aria-label="Cerrar edición" onClick={() => setEditing(false)}>
                <X />
              </button>
            </header>
            <form onSubmit={saveAsset}>
              {editError && (
                <div className="asset-edit-error" role="alert">
                  {editError}
                </div>
              )}
              <div className="asset-edit-fields">
                <div className="field field-wide" style={{ display: "grid", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Fotografía del bien / equipo</span>
                  <div style={{ display: "flex", gap: "14px", alignItems: "center", background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #e4e4e4" }}>
                    {editForm.photo_url ? (
                      <div style={{ position: "relative", width: "72px", height: "72px", flexShrink: 0 }}>
                        <img src={editForm.photo_url} alt="Vista previa" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px", border: "1px solid #ddd" }} />
                        <button type="button" onClick={() => updateEditField("photo_url", "")} style={{ position: "absolute", top: "-6px", right: "-6px", background: "#111", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "11px" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ width: "72px", height: "72px", borderRadius: "6px", background: "#eee", display: "grid", placeItems: "center", color: "#888", flexShrink: 0, fontSize: "11px", textAlign: "center" }}>
                        Sin foto
                      </div>
                    )}
                    <div style={{ flex: 1, display: "grid", gap: "8px" }}>
                      <label className="button button-secondary" style={{ width: "fit-content", cursor: "pointer", padding: "6px 14px", fontSize: "13px", margin: 0 }}>
                        <span>{editForm.photo_url ? "Cambiar imagen" : "Subir imagen"}</span>
                        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) updateEditField("photo_url", ev.target.result as string);
                          };
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    </div>
                  </div>
                </div>
                <label className="field field-wide">
                  <span>Nombre del bien *</span>
                  <input
                    required
                    value={editForm.name}
                    onChange={(event) => updateEditField("name", event.target.value)}
                  />
                </label>
                <label className="field field-wide">
                  <span>Descripción *</span>
                  <textarea
                    required
                    rows={3}
                    value={editForm.description}
                    onChange={(event) => updateEditField("description", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Marca</span>
                  <input
                    value={editForm.brand}
                    onChange={(event) => updateEditField("brand", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Modelo</span>
                  <ModelCreatableSelect
                    taxonomyId={asset?.taxonomy_detail?.id ?? ""}
                    value={editForm.model}
                    onChange={(val) => updateEditField("model", val)}
                    disabled={!asset?.taxonomy_detail?.id}
                  />
                </label>
                <label className="field">
                  <span>Número de serie</span>
                  <input
                    value={editForm.serial_number}
                    onChange={(event) => updateEditField("serial_number", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Condición *</span>
                  <select
                    required
                    value={editForm.condition}
                    onChange={(event) => updateEditField("condition", event.target.value)}
                  >
                    {["Nuevo", "Bueno", "Regular", "Requiere revisión"].map((condition) => (
                      <option value={condition} key={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Criticidad *</span>
                  <select
                    required
                    value={editForm.criticality}
                    onChange={(event) => updateEditField("criticality", event.target.value)}
                  >
                    {["Baja", "Media", "Alta", "Crítica"].map((criticality) => (
                      <option value={criticality} key={criticality}>
                        {criticality}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <aside className="asset-edit-boundary">
                La ubicación y el responsable se pueden asignar desde la pestaña de Responsables para conservar su
                historial.
              </aside>
              <footer>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button className="button button-primary" disabled={saving}>
                  <FloppyDisk />
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {/* ADD NEW RESPONSIBLE MODAL */}
      {addingResponsible && (
        <div className="asset-edit-backdrop" role="presentation">
          <section
            className="asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-resp-title"
          >
            <header>
              <div>
                <span>Asignación de custodia y ubicación</span>
                <h2 id="add-resp-title">Asignar nuevo responsable</h2>
                <p>{asset.code} — {asset.name}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={() => setAddingResponsible(false)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={saveNewResponsible}>
              <div className="asset-edit-fields">
                <label className="field field-wide">
                  <span>Nombre completo del nuevo responsable *</span>
                  <input
                    required
                    placeholder="Ej. Marco Quispe Flores"
                    value={newRespForm.responsible}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, responsible: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Área / Departamento *</span>
                  <input
                    required
                    placeholder="Ej. Mantenimiento / Facility"
                    value={newRespForm.area}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, area: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Fecha de inicio *</span>
                  <input
                    type="date"
                    required
                    value={newRespForm.start_date}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, start_date: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Edificio / Piso</span>
                  <input
                    placeholder="Ej. Edificio B / Piso 2"
                    value={newRespForm.building}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, building: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Oficina / Sala / Ubicación exacta</span>
                  <input
                    placeholder="Ej. Gerencia General / Sala A"
                    value={newRespForm.room}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, room: e.target.value })
                    }
                  />
                </label>
                <label className="field field-wide">
                  <span>Motivo de la asignación / observaciones *</span>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej. Reasignación por rotación de puesto / custodia operativa"
                    value={newRespForm.reason}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, reason: e.target.value })
                    }
                  />
                </label>
              </div>
              <aside className="asset-edit-boundary">
                Al guardar, el responsable actual y la ubicación se actualizarán automáticamente en la sección Situación Actual y quedará registrado en el historial.
              </aside>
              <footer>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setAddingResponsible(false)}
                >
                  Cancelar
                </button>
                <button className="button button-primary" type="submit">
                  <UserPlus />
                  Asignar responsable
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {/* EDIT EXISTING RESPONSIBLE MODAL */}
      {editingResponsibleItem && (
        <div className="asset-edit-backdrop" role="presentation">
          <section
            className="asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-resp-title"
          >
            <header>
              <div>
                <span>Historial de responsable</span>
                <h2 id="edit-resp-title">Editar registro de responsable</h2>
                <p>{asset.code} — {editingResponsibleItem.responsible}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={() => setEditingResponsibleItem(null)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={saveEditResponsible}>
              <div className="asset-edit-fields">
                <label className="field field-wide">
                  <span>Nombre completo del responsable *</span>
                  <input
                    required
                    value={editRespForm.responsible}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, responsible: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Área / Departamento *</span>
                  <input
                    required
                    value={editRespForm.area}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, area: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Estado de custodia *</span>
                  <select
                    value={editRespForm.status}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, status: e.target.value })
                    }
                  >
                    <option value="ACTIVA">Actual (Activa)</option>
                    <option value="FINALIZADA">Finalizada</option>
                  </select>
                </label>
                <label className="field">
                  <span>Fecha de inicio *</span>
                  <input
                    type="date"
                    required
                    value={editRespForm.start_date}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, start_date: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Fecha de término</span>
                  <input
                    type="date"
                    disabled={editRespForm.status === "ACTIVA"}
                    value={editRespForm.end_date}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, end_date: e.target.value })
                    }
                  />
                </label>
                <label className="field field-wide">
                  <span>Motivo / Observaciones *</span>
                  <textarea
                    required
                    rows={3}
                    value={editRespForm.reason}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, reason: e.target.value })
                    }
                  />
                </label>
              </div>
              <footer>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setEditingResponsibleItem(null)}
                >
                  Cancelar
                </button>
                <button className="button button-primary" type="submit">
                  <FloppyDisk />
                  Guardar cambios
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function HistoryResponsibleList({
  items,
  onEdit,
}: {
  items: AssetDetailRecord["responsible_history"];
  onEdit: (item: ResponsibleItem) => void;
}) {
  return (
    <ol className="history-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="history-icon">
            <UserCircle />
          </div>
          <div className="history-content">
            <div className="history-title">
              <strong>{item.responsible}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  className={`status ${item.status === "ACTIVA" ? "status-success" : "status-neutral"}`}
                >
                  {item.status === "ACTIVA" ? "Actual" : "Finalizada"}
                </span>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ padding: "3px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => onEdit(item)}
                >
                  <PencilSimple size={13} /> Editar
                </button>
              </div>
            </div>
            <p>{item.area || item.type.toLowerCase()}</p>
            <dl className="history-metadata">
              <div>
                <dt>Periodo</dt>
                <dd>
                  {formatDate(item.start_date)} —{" "}
                  {item.end_date ? formatDate(item.end_date) : "Actualidad"}
                </dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{item.reason}</dd>
              </div>
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RepairList({ items }: { items: AssetDetailRecord["repair_history"] }) {
  return (
    <ol className="history-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="history-icon history-icon-repair">
            <Wrench />
          </div>
          <div className="history-content">
            <div className="history-title">
              <strong>{item.work_order}</strong>
              <span className="status status-success">{item.status.toLowerCase()}</span>
            </div>
            <p>{item.issue}</p>
            <dl className="history-metadata">
              <div>
                <dt>Fecha y tipo</dt>
                <dd>
                  {formatDate(item.reported_at)} · {item.type.toLowerCase()}
                </dd>
              </div>
              <div>
                <dt>Trabajo</dt>
                <dd>{item.work_performed}</dd>
              </div>
              <div>
                <dt>Técnico</dt>
                <dd>
                  {item.technician_name} · {item.provider}
                </dd>
              </div>
              <div>
                <dt>Resultado</dt>
                <dd>
                  {item.resulting_condition} · S/ {Number(item.cost).toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}

function toInputDate(value: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));
}
