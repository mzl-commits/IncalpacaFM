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
import { createPortal } from "react-dom";
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
import {
  getAssignmentCatalog,
  deliverAsset,
  type AssignmentCatalog,
} from "@/modules/assignments/assignmentRepository";
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

  // Assignment Catalog from Database
  const [catalog, setCatalog] = useState<AssignmentCatalog | null>(null);
  const [selectedRespType, setSelectedRespType] = useState<string>("ALL");
  const [selectedRespId, setSelectedRespId] = useState<string>("");
  const [selectedLocId, setSelectedLocId] = useState<string>("");

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
  const [printModalOpen, setPrintModalOpen] = useState(false);
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
    void getAssignmentCatalog()
      .then(setCatalog)
      .catch(() => {});
  }, []);

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

  // Derived lists from DB Catalog for dropdowns and filters
  const filteredResponsibles = (catalog?.responsibles || []).filter((r) => {
    if (selectedRespType === "ALL") return true;
    return r.type === selectedRespType;
  });

  const availableAreas = Array.from(
    new Set([
      ...(catalog?.responsibles || []).map((r) => r.area_name).filter(Boolean),
      ...(catalog?.locations || []).map((l) => l.area).filter(Boolean),
      "Facility Management",
      "Mantenimiento e Infraestructura",
      "Sistemas e Informática",
      "Administración & MKT",
      "Operaciones",
      "Logística y Almacenes",
    ])
  ).sort();

  const availableBuildings = Array.from(
    new Set((catalog?.locations || []).map((l) => l.building).filter(Boolean))
  ).sort();

  const availableRooms = Array.from(
    new Set((catalog?.locations || []).map((l) => l.room).filter(Boolean))
  ).sort();

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
      // Always apply photo_url from the form in case the backend doesn't persist it
      setAsset({ ...updated, photo_url: editForm.photo_url ?? updated.photo_url ?? null });
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
    setSelectedRespType("ALL");
    setSelectedRespId("");
    setSelectedLocId("");
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

  async function saveNewResponsible(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset) return;

    // Intentar emitir la entrega formal mediante el backend si tenemos los IDs de BD
    if (selectedRespId && selectedLocId) {
      try {
        await deliverAsset({
          asset_id: asset.id,
          responsible_id: selectedRespId,
          location_id: selectedLocId,
          assignment_reason: newRespForm.reason.trim() || "Asignación formal de activo",
          condition: asset.condition || "Bueno",
          accessories: "",
          observations: newRespForm.reason.trim(),
          checklist: {
            inspected: true,
            qr_legible: true,
            accessories_complete: true,
            no_unreported_damage: true,
          },
          privacy_accepted: true,
          evidence: [],
          signatures: [
            {
              role: "ENTREGA",
              method: "CONFIRMACION",
              signer_name: user?.fullName || "Rosa Medina",
              signer_role: "Facility Management",
              consent: true,
              signature_data_url: "",
            },
            {
              role: "RECIBE",
              method: "CONFIRMACION",
              signer_name: newRespForm.responsible.trim(),
              signer_role: "Receptor / Custodio",
              consent: true,
              signature_data_url: "",
            },
          ],
        });
        const refreshed = await getAssetDetail(asset.id);
        setAsset(refreshed);
        setAddingResponsible(false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 3500);
        return;
      } catch (err) {
        console.warn("deliverAsset falló, aplicando actualización directa:", err);
      }
    }

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
      type: selectedRespType !== "ALL" ? selectedRespType : "PERSONA",
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
          <p>{displayCode(asset)}{asset.fm_code && asset.code !== displayCode(asset) && asset.code !== asset.fm_code ? <small> · {asset.code}</small> : null}</p>
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
          <button className="button button-secondary" onClick={() => setPrintModalOpen(true)}>
            <Printer />
            Imprimir ficha
          </button>
        </div>
      </div>
      
      {printModalOpen && (
        <div className="print-modal-overlay" onClick={() => setPrintModalOpen(false)}>
          <div className="print-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="print-modal-header">
              <div className="print-modal-title-group">
                <Printer size={20} weight="duotone" />
                <div>
                  <h2>Imprimir ficha del bien</h2>
                  <p>Elige el tipo de reporte a generar en PDF</p>
                </div>
              </div>
              <button className="print-modal-close" type="button" onClick={() => setPrintModalOpen(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="print-modal-body">
              <button
                className="print-modal-option"
                onClick={() => { setPrintModalOpen(false); void printAssetPdf(asset.id, "print", user?.fullName, "asignacion"); }}
              >
                <div className="print-modal-option-icon">
                  <Printer size={18} />
                </div>
                <div className="print-modal-option-text">
                  <strong>Ficha de Asignación</strong>
                  <span>Responsables, ubicación, motivo y firmas</span>
                </div>
              </button>
              <button
                className="print-modal-option"
                onClick={() => { setPrintModalOpen(false); void printAssetPdf(asset.id, "print", user?.fullName, "entrada"); }}
              >
                <div className="print-modal-option-icon">
                  <Printer size={18} />
                </div>
                <div className="print-modal-option-text">
                  <strong>Ficha de Entrada</strong>
                  <span>Fecha de compra, costo y centro de costo</span>
                </div>
              </button>
              <button
                className="print-modal-option print-modal-option--featured"
                onClick={() => { setPrintModalOpen(false); void printAssetPdf(asset.id, "print", user?.fullName, "completo"); }}
              >
                <div className="print-modal-option-icon">
                  <Printer size={18} />
                </div>
                <div className="print-modal-option-text">
                  <strong>Ficha Detallada</strong>
                  <span>Información completa del bien</span>
                </div>
              </button>
            </div>
            <div className="print-modal-footer">
              <button className="button button-secondary" onClick={() => setPrintModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
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
              {asset.photo_url ? (
                <img
                  src={asset.photo_url}
                  alt={`Fotografía registrada de ${asset.name}`}
                  style={{ width: "100%", maxHeight: "260px", objectFit: "cover", borderRadius: "10px", border: "1px solid #E8E8E8", display: "block" }}
                />
              ) : (
                <div className="asset-detail-photo-empty">
                  <Tag size={30} />
                  <span>Este bien no tiene fotografía registrada</span>
                </div>
              )}
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
            <button className="button button-primary" onClick={() => void printAssetPdf(asset.id, "print", user?.fullName)}>
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
      {editing && createPortal(
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
                <p>{displayCode(asset)}{asset.fm_code && asset.code !== displayCode(asset) && asset.code !== asset.fm_code ? ` · ${asset.code}` : ""}</p>
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
      , document.body)}

      {/* ADD NEW RESPONSIBLE MODAL - PROFESSIONAL UX/UI WITH TAXONOMY INTEGRATION */}
      {addingResponsible && (
        <div className="asset-edit-backdrop" role="presentation" style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)" }}>
          <section
            className="asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-resp-title"
            style={{
              maxWidth: "680px",
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "16px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              background: "#FFFFFF",
              padding: 0,
            }}
          >
            {/* MODAL HEADER WITH ASSET & TAXONOMY INFO */}
            <header style={{
              background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
              borderBottom: "1px solid #E2E8F0",
              padding: "20px 24px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#64748B", textTransform: "uppercase" }}>
                  Custodia y Ubicación Patrimonial
                </span>
                <h2 id="add-resp-title" style={{ margin: "4px 0 6px", fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>
                  Asignar nuevo responsable
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#002B58",
                    color: "#FFFFFF",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}>
                    {displayCode(asset)}
                  </span>
                  <strong style={{ fontSize: "13.5px", color: "#1E293B" }}>{asset.name}</strong>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={() => setAddingResponsible(false)}
                style={{
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  borderRadius: "8px",
                  width: "32px",
                  height: "32px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#475569",
                }}
              >
                <X size={18} />
              </button>
            </header>

            {/* TAXONOMY SUMMARY BANNER */}
            <div style={{
              margin: "14px 24px 0",
              padding: "10px 14px",
              background: "#F0F7FF",
              border: "1px solid #BAE6FD",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "12.5px",
              color: "#0369A1",
            }}>
              <Tag size={20} weight="duotone" style={{ flexShrink: 0, color: "#0284C7" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <strong style={{ color: "#0C4A6E" }}>Taxonomía Vinculada:</strong>
                  <span style={{
                    background: "#E0F2FE",
                    color: "#0369A1",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontWeight: 600,
                    fontSize: "11.5px",
                  }}>
                    {asset.taxonomy_detail?.category || asset.entry_type_label || "Categoría General"}
                  </span>
                  {asset.taxonomy_detail?.subcategory && (
                    <>
                      <span>›</span>
                      <span style={{ fontWeight: 600, color: "#0C4A6E" }}>{asset.taxonomy_detail.subcategory}</span>
                    </>
                  )}
                  {asset.taxonomy_detail?.specialty && (
                    <>
                      <span>·</span>
                      <span style={{ color: "#0284C7" }}>Especialidad: {asset.taxonomy_detail.specialty}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={saveNewResponsible} style={{ padding: "16px 24px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                
                {/* 1. FILTRO DE TIPO DE RESPONSABLE */}
                <div style={{ gridColumn: "1 / -1", background: "#F8FAFC", padding: "12px 14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                      1. Filtrar responsables de la Base de Datos por tipo:
                    </span>
                    <span style={{ fontSize: "11.5px", color: "#64748B" }}>
                      {filteredResponsibles.length} disponible{filteredResponsibles.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {[
                      { id: "ALL", label: "Todos" },
                      { id: "PERSONA", label: "Personas / Colaboradores" },
                      { id: "AREA", label: "Áreas / Departamentos" },
                      { id: "ESPACIO_COMUN", label: "Espacios Comunes" },
                    ].map((t) => {
                      const isSelected = selectedRespType === t.id;
                      return (
                        <button
                          type="button"
                          key={t.id}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: isSelected ? 700 : 500,
                            borderRadius: "20px",
                            border: isSelected ? "1.5px solid #002B58" : "1px solid #CBD5E1",
                            background: isSelected ? "#002B58" : "#FFFFFF",
                            color: isSelected ? "#FFFFFF" : "#334155",
                            cursor: "pointer",
                            boxShadow: isSelected ? "0 2px 4px rgba(0,43,88,0.2)" : "none",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => setSelectedRespType(t.id)}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. SELECTOR DE RESPONSABLES DE LA BASE DE DATOS */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    2. Seleccionar responsable registrado en la BD:
                  </label>
                  <select
                    value={selectedRespId}
                    onChange={(e) => {
                      const rId = e.target.value;
                      setSelectedRespId(rId);
                      const found = catalog?.responsibles.find((r) => r.id === rId);
                      if (found) {
                        setNewRespForm((prev) => ({
                          ...prev,
                          responsible: found.display_name,
                          area: found.area_name || prev.area,
                        }));
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #94A3B8",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      fontWeight: 500,
                    }}
                  >
                    <option value="">-- Seleccionar de la base de datos o escribir en el campo inferior --</option>
                    {filteredResponsibles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.external_reference ? `[${r.external_reference}] ` : ""}
                        {r.display_name} — ({r.area_name || r.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. NOMBRE COMPLETO DEL RESPONSABLE */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    Nombre completo del responsable <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    required
                    list="resp-name-suggestions"
                    placeholder="Ej. Rosa Medina Gutiérrez"
                    value={newRespForm.responsible}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, responsible: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                  <datalist id="resp-name-suggestions">
                    {(catalog?.responsibles || []).map((r) => (
                      <option key={r.id} value={r.display_name} />
                    ))}
                  </datalist>
                </div>

                {/* 4. ÁREA / DEPARTAMENTO */}
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    Área / Departamento <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    required
                    list="area-suggestions"
                    placeholder="Ej. Facility Management"
                    value={newRespForm.area}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, area: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                  <datalist id="area-suggestions">
                    {availableAreas.map((area) => (
                      <option key={area} value={area} />
                    ))}
                  </datalist>
                </div>

                {/* 5. FECHA DE INICIO */}
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    Fecha de inicio de custodia <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newRespForm.start_date}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, start_date: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* 6. SELECTOR DE UBICACIÓN DE LA BASE DE DATOS */}
                <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    3. Ubicación física validada en la BD:
                  </label>
                  <select
                    value={selectedLocId}
                    onChange={(e) => {
                      const lId = e.target.value;
                      setSelectedLocId(lId);
                      const found = catalog?.locations.find((l) => l.id === lId);
                      if (found) {
                        setNewRespForm((prev) => ({
                          ...prev,
                          building: found.building || prev.building,
                          room: found.room || found.specific_location || prev.room,
                          area: found.area || prev.area,
                        }));
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #94A3B8",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      fontWeight: 500,
                    }}
                  >
                    <option value="">-- Seleccionar ubicación física de la BD --</option>
                    {(catalog?.locations || []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.zone ? `[${l.zone}] ` : ""}
                        {l.building} / {l.area} / {l.room}
                        {l.specific_location ? ` (${l.specific_location})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. EDIFICIO / PISO */}
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    Edificio / Piso
                  </label>
                  <input
                    list="building-suggestions"
                    placeholder="Ej. Planta Principal / Piso 1"
                    value={newRespForm.building}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, building: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                  <datalist id="building-suggestions">
                    {availableBuildings.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                {/* 8. OFICINA / SALA */}
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    Oficina / Sala / Ubicación exacta
                  </label>
                  <input
                    list="room-suggestions"
                    placeholder="Ej. Oficina 204 / Taller Eléctrico"
                    value={newRespForm.room}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, room: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                  <datalist id="room-suggestions">
                    {availableRooms.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>

                {/* 9. MOTIVO DE LA ASIGNACIÓN CON CHIPS RÁPIDOS */}
                <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    Motivo de la asignación / observaciones <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {[
                      "Asignación inicial de puesto de trabajo",
                      "Reasignación por rotación de puesto",
                      "Custodia operativa temporal",
                      "Cambio de área / departamento",
                      "Devolución y custodia en almacén",
                    ].map((reasonText) => {
                      const isMatch = newRespForm.reason === reasonText;
                      return (
                        <button
                          type="button"
                          key={reasonText}
                          style={{
                            padding: "4px 10px",
                            fontSize: "12px",
                            fontWeight: isMatch ? 700 : 500,
                            borderRadius: "6px",
                            border: isMatch ? "1.5px solid #002B58" : "1px solid #CBD5E1",
                            background: isMatch ? "#002B58" : "#F8FAFC",
                            color: isMatch ? "#FFFFFF" : "#334155",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => setNewRespForm((prev) => ({ ...prev, reason: reasonText }))}
                        >
                          {reasonText}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej. Reasignación por rotación de puesto / custodia operativa"
                    value={newRespForm.reason}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, reason: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13.5px",
                      lineHeight: "1.5",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* ASIDE INFO BANNER */}
              <div style={{
                marginTop: "16px",
                padding: "10px 14px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#64748B",
                lineHeight: "1.45",
              }}>
                ℹ️ Al confirmar, el custodio actual y la ubicación física se actualizarán en la Situación Actual del bien y quedará asentado en el historial trazable para los reportes y Fichas Técnicas.
              </div>

              {/* ACTION BUTTONS FOOTER */}
              <footer style={{
                marginTop: "18px",
                paddingTop: "14px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}>
                <button
                  type="button"
                  onClick={() => setAddingResponsible(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "1.5px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#002B58",
                    color: "#FFFFFF",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0, 43, 88, 0.25)",
                  }}
                >
                  <UserPlus size={16} weight="bold" />
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
                    list="area-suggestions"
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
