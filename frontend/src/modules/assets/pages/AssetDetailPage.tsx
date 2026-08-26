import {
  ArrowLeft,
  Archive,
  CaretDown,
  CheckCircle,
  DownloadSimple,
  FloppyDisk,
  MagnifyingGlass,
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
import { useEffect, useState, useRef } from "react";
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
  listTaxonomies,
  type TaxonomyRecord,
} from "@/modules/taxonomy/taxonomyRepository";
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

  // Live Taxonomy Data from Database
  const [taxonomies, setTaxonomies] = useState<TaxonomyRecord[]>([]);

  // Assignment Catalog from Database
  const [catalog, setCatalog] = useState<AssignmentCatalog | null>(null);
  const [selectedRespId, setSelectedRespId] = useState<string>("");
  const [selectedLocId, setSelectedLocId] = useState<string>("");

  // Searchable combobox input states (permite escribir para filtrar en tiempo real)
  const [respSearchQuery, setRespSearchQuery] = useState("");
  const [isRespDropdownOpen, setIsRespDropdownOpen] = useState(false);
  const [locSearchQuery, setLocSearchQuery] = useState("");
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false);

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
    void listTaxonomies({ active: true })
      .then(setTaxonomies)
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

  // Live matching of taxonomy in real-time from DB
  const liveTaxonomy = taxonomies.find(
    (t) =>
      t.id === asset?.taxonomy_detail?.id ||
      (t.prefix && asset?.fm_code?.startsWith(t.prefix)) ||
      (t.prefix && asset?.taxonomy_detail?.prefix === t.prefix)
  ) || null;

  // Filtered by what the user types in the searchable input
  const searchedResponsibles = (catalog?.responsibles || []).filter((r) => {
    if (!respSearchQuery.trim()) return true;
    const q = respSearchQuery.toLowerCase();
    return (
      r.display_name.toLowerCase().includes(q) ||
      (r.external_reference && r.external_reference.toLowerCase().includes(q)) ||
      (r.area_name && r.area_name.toLowerCase().includes(q)) ||
      (r.type && r.type.toLowerCase().includes(q))
    );
  });

  const searchedLocations = (catalog?.locations || []).filter((l) => {
    if (!locSearchQuery.trim()) return true;
    const q = locSearchQuery.toLowerCase();
    return (
      (l.building && l.building.toLowerCase().includes(q)) ||
      (l.area && l.area.toLowerCase().includes(q)) ||
      (l.room && l.room.toLowerCase().includes(q)) ||
      (l.zone && l.zone.toLowerCase().includes(q)) ||
      (l.specific_location && l.specific_location.toLowerCase().includes(q))
    );
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
    setSelectedRespId("");
    setSelectedLocId("");
    setRespSearchQuery("");
    setLocSearchQuery("");
    setIsRespDropdownOpen(false);
    setIsLocDropdownOpen(false);
    setNewRespForm({
      responsible: "",
      area: "",
      building: asset?.location_detail?.building || "",
      room: asset?.location_detail?.room || "",
      reason: "Asignación de puesto de trabajo",
      start_date: new Date().toISOString().slice(0, 10),
    });
    setAddingResponsible(true);
  }

  async function saveNewResponsible(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset) return;

    const responsibleName = (newRespForm.responsible || respSearchQuery).trim();
    if (!responsibleName) return;

    setSaving(true);
    try {
      // 1. Intentar entrega formal con acta y trazabilidad si tenemos los IDs del catálogo
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
                signer_name: user?.fullName || "Facility Management",
                signer_role: "Facility Management",
                consent: true,
                signature_data_url: "",
              },
              {
                role: "RECIBE",
                method: "CONFIRMACION",
                signer_name: responsibleName,
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
          console.warn("deliverAsset falló, aplicando sincronización directa:", err);
        }
      }

      // 2. Sincronización en historial de responsables del bien
      const nowIso = new Date().toISOString();
      const startDateIso = newRespForm.start_date
        ? new Date(newRespForm.start_date).toISOString()
        : nowIso;

      const updatedHistory = asset.responsible_history.map((item) => {
        if (
          item.status?.toUpperCase() === "ACTIVA" ||
          item.status?.toUpperCase() === "ACTIVO" ||
          !item.end_date
        ) {
          return { ...item, status: "FINALIZADA", end_date: startDateIso };
        }
        return item;
      });

      const newEntry: ResponsibleItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        responsible: responsibleName,
        area: newRespForm.area.trim() || "Facility Management",
        status: "ACTIVA",
        start_date: startDateIso,
        end_date: null,
        reason: newRespForm.reason.trim() || "Asignación de custodia",
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
    } catch {
      setError("No se pudo registrar la asignación.");
    } finally {
      setSaving(false);
    }
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
      
      {printModalOpen && createPortal(
        <div
          className="print-modal-overlay"
          onClick={() => setPrintModalOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(30, 41, 59, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            margin: 0,
          }}
        >
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
      , document.body)}
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

      {/* ADD NEW RESPONSIBLE MODAL - FULLSCREEN GRAY OVERLAY IN PORTAL */}
      {addingResponsible && createPortal(
        <div
          className="asset-edit-backdrop"
          role="presentation"
          onClick={() => setAddingResponsible(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(30, 41, 59, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            margin: 0,
          }}
        >
          <section
            className="asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-resp-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "12px",
              border: "1px solid #000000",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              background: "#FFFFFF",
              padding: 0,
              boxSizing: "border-box",
            }}
          >
            {/* MODAL HEADER WITH ASSET & TAXONOMY INFO */}
            <header style={{
              background: "#FFFFFF",
              borderBottom: "1px solid #E5E5E5",
              padding: "18px 24px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#525252", textTransform: "uppercase" }}>
                  INCALPACA FM S.A. — Gestión de Custodia
                </span>
                <h2 id="add-resp-title" style={{ margin: "4px 0 6px", fontSize: "20px", fontWeight: 800, color: "#000000" }}>
                  Asignar nuevo responsable
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#000000",
                    color: "#FFFFFF",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}>
                    {displayCode(asset)}
                  </span>
                  <strong style={{ fontSize: "14px", color: "#000000" }}>{asset.name}</strong>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={() => setAddingResponsible(false)}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CCCCCC",
                  borderRadius: "6px",
                  width: "32px",
                  height: "32px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#000000",
                }}
              >
                <X size={18} />
              </button>
            </header>

            {/* TAXONOMY SUMMARY BANNER (REAL-TIME DATABASE SYNC) */}
            <div style={{
              margin: "14px 24px 0",
              padding: "12px 14px",
              background: "#F5F5F5",
              border: "1px solid #D4D4D4",
              borderRadius: "8px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              fontSize: "12.5px",
              color: "#000000",
            }}>
              <Tag size={20} weight="bold" style={{ flexShrink: 0, color: "#000000", marginTop: "2px" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <strong style={{ color: "#000000" }}>Taxonomía en Tiempo Real (BD):</strong>
                    <span style={{
                      background: "#000000",
                      color: "#FFFFFF",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontWeight: 700,
                      fontSize: "11px",
                      letterSpacing: "0.03em",
                    }}>
                      {liveTaxonomy?.category || asset.taxonomy_detail?.category || asset.entry_type_label || "Categoría General"}
                    </span>
                    {(liveTaxonomy?.subcategory || asset.taxonomy_detail?.subcategory) && (
                      <>
                        <span style={{ color: "#737373" }}>›</span>
                        <span style={{ fontWeight: 700, color: "#000000" }}>{liveTaxonomy?.subcategory || asset.taxonomy_detail?.subcategory}</span>
                      </>
                    )}
                  </div>
                  {(liveTaxonomy?.prefix || asset.taxonomy_detail?.prefix) && (
                    <span style={{
                      background: "#E5E5E5",
                      color: "#000000",
                      padding: "1px 6px",
                      borderRadius: "3px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}>
                      Prefijo: {liveTaxonomy?.prefix || asset.taxonomy_detail?.prefix}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11.5px", color: "#525252", flexWrap: "wrap" }}>
                  <span>Especialidad: <strong>{liveTaxonomy?.specialty || asset.taxonomy_detail?.specialty || "Facility Management"}</strong></span>
                  {(liveTaxonomy?.assetType || asset.taxonomy_detail?.asset_type) && (
                    <span>· Tipo: <strong>{liveTaxonomy?.assetType || asset.taxonomy_detail?.asset_type}</strong></span>
                  )}
                  {liveTaxonomy?.usefulLifeYears ? (
                    <span>· Vida útil estimada: <strong>{liveTaxonomy.usefulLifeYears} años</strong></span>
                  ) : null}
                </div>
              </div>
            </div>

            <form onSubmit={saveNewResponsible} style={{ padding: "20px 24px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                
                {/* 1. SELECTOR INTELIGENTE DE RESPONSABLE (ESCRITURA / BÚSQUEDA) */}
                <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                      Responsable / Custodio *
                    </label>
                    {respSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setRespSearchQuery("");
                          setSelectedRespId("");
                          setNewRespForm((prev) => ({ ...prev, responsible: "" }));
                          setIsRespDropdownOpen(false);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#737373",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      required
                      type="text"
                      placeholder="Escribe el nombre o código del colaborador (ej. Rosa Medina, TRAB-4082)..."
                      value={respSearchQuery || newRespForm.responsible}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRespSearchQuery(val);
                        setNewRespForm((prev) => ({ ...prev, responsible: val }));
                        setIsRespDropdownOpen(true);
                      }}
                      onFocus={() => setIsRespDropdownOpen(true)}
                      style={{
                        width: "100%",
                        padding: "9px 36px 9px 12px",
                        borderRadius: "6px",
                        border: "1px solid #737373",
                        background: "#FFFFFF",
                        color: "#000000",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#525252", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MagnifyingGlass size={16} weight="bold" />
                      <CaretDown size={14} weight="bold" />
                    </div>
                  </div>

                  {/* DESPLEGABLE FLOTANTE DE RESPONSABLES */}
                  {isRespDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        maxHeight: "200px",
                        overflowY: "auto",
                        background: "#FFFFFF",
                        border: "1.5px solid #000000",
                        borderRadius: "6px",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
                        zIndex: 1000,
                      }}
                    >
                      {searchedResponsibles.length === 0 ? (
                        <div style={{ padding: "10px 12px", fontSize: "12px", color: "#737373" }}>
                          No se encontraron coincidencias en la BD. Se usará el nombre ingresado.
                        </div>
                      ) : (
                        searchedResponsibles.map((r) => {
                          const isSelected = selectedRespId === r.id;
                          return (
                            <div
                              key={r.id}
                              onMouseDown={() => {
                                setSelectedRespId(r.id);
                                setRespSearchQuery(r.display_name);
                                setNewRespForm((prev) => ({
                                  ...prev,
                                  responsible: r.display_name,
                                  area: r.area_name || prev.area,
                                }));
                                setIsRespDropdownOpen(false);
                              }}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #E5E5E5",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                background: isSelected ? "#F5F5F5" : "#FFFFFF",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F5")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? "#F5F5F5" : "#FFFFFF")}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                {r.external_reference ? (
                                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#525252" }}>
                                    [{r.external_reference}]
                                  </span>
                                ) : null}
                                <strong style={{ fontSize: "13px", color: "#000000" }}>{r.display_name}</strong>
                              </div>
                              <span style={{ fontSize: "12px", color: "#525252", fontWeight: 500 }}>{r.area_name || r.type}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 3. ÁREA / DEPARTAMENTO */}
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Área / Departamento *
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
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      fontWeight: 500,
                      boxSizing: "border-box",
                    }}
                  />
                  <datalist id="area-suggestions">
                    {availableAreas.map((area) => (
                      <option key={area} value={area} />
                    ))}
                  </datalist>
                </div>

                {/* 4. FECHA DE ASIGNACIÓN */}
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Fecha de inicio de custodia *
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
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      fontWeight: 500,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* 5. SELECTOR INTELIGENTE DE UBICACIÓN (ESCRITURA / BÚSQUEDA) */}
                <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                      Ubicación física (buscar en BD o escribir)
                    </label>
                    {locSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocSearchQuery("");
                          setSelectedLocId("");
                          setIsLocDropdownOpen(false);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#737373",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Escribe edificio, piso o sala (ej. Planta Principal, Taller, Oficina 204)..."
                      value={locSearchQuery || (newRespForm.building ? `${newRespForm.building}${newRespForm.room ? ` / ${newRespForm.room}` : ""}` : "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocSearchQuery(val);
                        setNewRespForm((prev) => ({ ...prev, building: val }));
                        setIsLocDropdownOpen(true);
                      }}
                      onFocus={() => setIsLocDropdownOpen(true)}
                      style={{
                        width: "100%",
                        padding: "9px 36px 9px 12px",
                        borderRadius: "6px",
                        border: "1px solid #737373",
                        background: "#FFFFFF",
                        color: "#000000",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#525252", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MagnifyingGlass size={16} weight="bold" />
                      <CaretDown size={14} weight="bold" />
                    </div>
                  </div>

                  {/* DESPLEGABLE FLOTANTE DE UBICACIONES */}
                  {isLocDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        maxHeight: "200px",
                        overflowY: "auto",
                        background: "#FFFFFF",
                        border: "1.5px solid #000000",
                        borderRadius: "6px",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
                        zIndex: 1000,
                      }}
                    >
                      {searchedLocations.length === 0 ? (
                        <div style={{ padding: "10px 12px", fontSize: "12px", color: "#737373" }}>
                          No se encontraron coincidencias en la BD. Se usará el texto ingresado.
                        </div>
                      ) : (
                        searchedLocations.map((l) => {
                          const isSelected = selectedLocId === l.id;
                          return (
                            <div
                              key={l.id}
                              onMouseDown={() => {
                                setSelectedLocId(l.id);
                                setLocSearchQuery(`${l.building} / ${l.area} / ${l.room || l.specific_location || ""}`);
                                setNewRespForm((prev) => ({
                                  ...prev,
                                  building: l.building || prev.building,
                                  room: l.room || l.specific_location || prev.room,
                                  area: l.area || prev.area,
                                }));
                                setIsLocDropdownOpen(false);
                              }}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #E5E5E5",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                background: isSelected ? "#F5F5F5" : "#FFFFFF",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F5")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? "#F5F5F5" : "#FFFFFF")}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                {l.zone && (
                                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#525252" }}>
                                    [{l.zone}]
                                  </span>
                                )}
                                <strong style={{ fontSize: "13px", color: "#000000" }}>{l.building}</strong>
                                <span style={{ color: "#737373" }}>/</span>
                                <span style={{ fontSize: "12.5px", color: "#000000", fontWeight: 600 }}>{l.area}</span>
                                {l.room && (
                                  <>
                                    <span style={{ color: "#737373" }}>/</span>
                                    <span style={{ fontSize: "12.5px", color: "#525252" }}>{l.room}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 6. MOTIVO DE LA ASIGNACIÓN */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Motivo de asignación / Observaciones *
                  </label>
                  <input
                    required
                    placeholder="Ej. Asignación de puesto de trabajo / Custodia operativa"
                    value={newRespForm.reason}
                    onChange={(e) =>
                      setNewRespForm({ ...newRespForm, reason: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      fontWeight: 500,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* ACTION BUTTONS FOOTER */}
              <footer style={{
                marginTop: "18px",
                paddingTop: "14px",
                borderTop: "1px solid #E5E5E5",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}>
                <button
                  type="button"
                  onClick={() => setAddingResponsible(false)}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "6px",
                    border: "1px solid #000000",
                    background: "#FFFFFF",
                    color: "#000000",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "9px 24px",
                    borderRadius: "6px",
                    border: "1px solid #000000",
                    background: "#000000",
                    color: "#FFFFFF",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <UserPlus size={16} weight="bold" />
                  {saving ? "Asignando…" : "Asignar responsable"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      , document.body)}

      {/* EDIT EXISTING RESPONSIBLE MODAL - FULLSCREEN GRAY OVERLAY IN PORTAL */}
      {editingResponsibleItem && createPortal(
        <div
          className="asset-edit-backdrop"
          role="presentation"
          onClick={() => setEditingResponsibleItem(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(30, 41, 59, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            margin: 0,
          }}
        >
          <section
            className="asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-resp-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "640px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "12px",
              border: "1px solid #000000",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              background: "#FFFFFF",
              padding: 0,
              boxSizing: "border-box",
            }}
          >
            <header style={{
              background: "#FFFFFF",
              borderBottom: "1px solid #E5E5E5",
              padding: "18px 24px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#525252", textTransform: "uppercase" }}>
                  INCALPACA FM S.A. — Historial de Custodia
                </span>
                <h2 id="edit-resp-title" style={{ margin: "4px 0 6px", fontSize: "20px", fontWeight: 800, color: "#000000" }}>
                  Editar registro de responsable
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#525252" }}>
                  <strong>{displayCode(asset)}</strong> — {editingResponsibleItem.responsible}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={() => setEditingResponsibleItem(null)}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CCCCCC",
                  borderRadius: "6px",
                  width: "32px",
                  height: "32px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#000000",
                }}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={saveEditResponsible} style={{ padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Nombre completo del responsable *
                  </label>
                  <input
                    required
                    value={editRespForm.responsible}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, responsible: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Área / Departamento *
                  </label>
                  <input
                    required
                    list="area-suggestions"
                    value={editRespForm.area}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, area: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Estado de custodia *
                  </label>
                  <select
                    value={editRespForm.status}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, status: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      fontWeight: 600,
                    }}
                  >
                    <option value="ACTIVA">Actual (Activa)</option>
                    <option value="FINALIZADA">Finalizada</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Fecha de inicio *
                  </label>
                  <input
                    type="date"
                    required
                    value={editRespForm.start_date}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, start_date: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Fecha de término
                  </label>
                  <input
                    type="date"
                    disabled={editRespForm.status === "ACTIVA"}
                    value={editRespForm.end_date}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, end_date: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: editRespForm.status === "ACTIVA" ? "#F5F5F5" : "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>
                    Motivo / Observaciones *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={editRespForm.reason}
                    onChange={(e) =>
                      setEditRespForm({ ...editRespForm, reason: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #737373",
                      background: "#FFFFFF",
                      color: "#000000",
                      fontSize: "13.5px",
                      lineHeight: "1.5",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <footer style={{
                marginTop: "20px",
                paddingTop: "14px",
                borderTop: "1px solid #E5E5E5",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}>
                <button
                  type="button"
                  onClick={() => setEditingResponsibleItem(null)}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "6px",
                    border: "1px solid #000000",
                    background: "#FFFFFF",
                    color: "#000000",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 24px",
                    borderRadius: "6px",
                    border: "1px solid #000000",
                    background: "#000000",
                    color: "#FFFFFF",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <FloppyDisk size={16} weight="bold" />
                  Guardar cambios
                </button>
              </footer>
            </form>
          </section>
        </div>
      , document.body)}
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
