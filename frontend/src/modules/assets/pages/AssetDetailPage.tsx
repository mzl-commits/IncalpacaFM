import { Archive, ArrowLeft, CheckCircle, PencilSimple, Printer, Tag, UserPlus } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/modules/accounts/AuthContext";
import { getAssetDetail, type AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { getAssignmentCatalog, type AssignmentCatalog } from "@/modules/assignments/assignmentRepository";
import { listTaxonomies, type TaxonomyRecord } from "@/modules/taxonomy/taxonomyRepository";
import { listWorkOrders } from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

import { AssetOverviewTab } from "@/modules/assets/components/AssetDetail/AssetOverviewTab";
import { AssetResponsiblesTab } from "@/modules/assets/components/AssetDetail/AssetResponsiblesTab";
import { AssetRepairsTab } from "@/modules/assets/components/AssetDetail/AssetRepairsTab";
import { AssetQrTab } from "@/modules/assets/components/AssetDetail/AssetQrTab";
import { AssetEditModal } from "@/modules/assets/components/AssetDetail/AssetEditModal";
import { AssetClassificationPanel } from "@/modules/assets/components/AssetDetail/AssetClassificationPanel";
import { AssetPrintModal } from "@/modules/assets/components/AssetDetail/AssetPrintModal";
import { AssetResponsibleModal } from "@/modules/assets/components/AssetDetail/AssetResponsibleModal";
import { AssetResponsibleEditModal } from "@/modules/assets/components/AssetDetail/AssetResponsibleEditModal";
import { displayCode, type DetailTab, type ResponsibleItem } from "@/modules/assets/pages/assetDetailUtils";

export function AssetDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [asset, setAsset] = useState<AssetDetailRecord | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retirementWorkOrder, setRetirementWorkOrder] = useState<WorkOrder | null>(null);

  const [taxonomies, setTaxonomies] = useState<TaxonomyRecord[]>([]);
  const [catalog, setCatalog] = useState<AssignmentCatalog | null>(null);

  const [editing, setEditing] = useState(false);
  const [addingResponsible, setAddingResponsible] = useState(false);
  const [editingResponsibleItem, setEditingResponsibleItem] = useState<ResponsibleItem | null>(null);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  useEffect(() => {
    getAssetDetail(id)
      .then(setAsset)
      .catch(() => setError("No se pudo cargar la ficha del bien."));
  }, [id]);

  useEffect(() => {
    void getAssignmentCatalog().then(setCatalog).catch(() => {});
    void listTaxonomies({ active: "true" }).then(setTaxonomies).catch(() => {});
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
    if (asset) {
      QRCode.toDataURL(asset.public_url, {
        width: 420,
        margin: 2,
        color: { dark: "#002b58", light: "#ffffff" },
      }).then(setQr);
    }
  }, [asset]);

  if (!asset) {
    return <section className="loading-panel">{error || "Cargando ficha del bien…"}</section>;
  }

  const activeAssignment =
    asset.responsible_history.find(
      (item) =>
        item.status?.toUpperCase() === "ACTIVA" ||
        item.status?.toUpperCase() === "ACTIVO" ||
        item.status?.toUpperCase() === "ASIGNADO" ||
        item.end_date === null ||
        !item.end_date
    ) || asset.responsible_history[0];

  function showSuccessMessage() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3500);
  }

  function handleAssetUpdated(updatedAsset: AssetDetailRecord) {
    setAsset(updatedAsset);
    setEditing(false);
    setAddingResponsible(false);
    setEditingResponsibleItem(null);
    setClassificationOpen(false);
    showSuccessMessage();
  }

  return (
    <section className="asset-record-page">
      {saved && (
        <div className="asset-edit-success" role="status">
          <CheckCircle weight="fill" />
          Cambios registrados correctamente.
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
          <p>
            {displayCode(asset)}
            {asset.fm_code && asset.code !== displayCode(asset) && asset.code !== asset.fm_code ? <small> · {asset.code}</small> : null}
          </p>
        </div>
        <div className="detail-actions">
          <span className={`status ${asset.assignment_status === "Sin asignar" ? "status-neutral" : "status-success"}`}>
            {asset.assignment_status}
          </span>
          {user?.role === "ADMINISTRADOR" && (
            <button className="button button-secondary" type="button" onClick={() => setEditing(true)}>
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
          <button className="button button-primary" type="button" onClick={() => setAddingResponsible(true)}>
            <UserPlus />
            Asignar nuevo responsable
          </button>
          <button className="button button-secondary" onClick={() => setPrintModalOpen(true)}>
            <Printer />
            Imprimir ficha
          </button>
        </div>
      </div>

      {user?.role === "ADMINISTRADOR" && (!asset.fm_code || !asset.taxonomy_detail) && (
        <section className="asset-classification-callout">
          <Tag size={25} weight="duotone" />
          <div>
            <strong>Clasificación pendiente</strong>
            <p>Asigna una taxonomía validada para reservar el código FM sin cambiar el identificador técnico ni el enlace QR.</p>
          </div>
          <button className="button button-primary" type="button" onClick={() => setClassificationOpen((current) => !current)}>
            {classificationOpen ? "Cerrar" : "Completar clasificación"}
          </button>
        </section>
      )}

      {classificationOpen && (
        <AssetClassificationPanel
          asset={asset}
          onClose={() => setClassificationOpen(false)}
          onSuccess={handleAssetUpdated}
        />
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
        <AssetOverviewTab
          asset={asset}
          activeAssignment={activeAssignment}
          onOpenAddResponsible={() => setAddingResponsible(true)}
        />
      )}

      {tab === "responsibles" && (
        <AssetResponsiblesTab
          items={asset.responsible_history}
          onOpenAddResponsible={() => setAddingResponsible(true)}
          onOpenEditResponsible={setEditingResponsibleItem}
        />
      )}

      {tab === "repairs" && <AssetRepairsTab items={asset.repair_history} />}

      {tab === "qr" && <AssetQrTab asset={asset} qr={qr} userName={user?.fullName} />}

      {editing && (
        <AssetEditModal
          asset={asset}
          onClose={() => setEditing(false)}
          onSuccess={handleAssetUpdated}
        />
      )}

      {addingResponsible && (
        <AssetResponsibleModal
          asset={asset}
          catalog={catalog}
          taxonomies={taxonomies}
          user={user}
          onClose={() => setAddingResponsible(false)}
          onSuccess={handleAssetUpdated}
        />
      )}

      {editingResponsibleItem && (
        <AssetResponsibleEditModal
          asset={asset}
          editingItem={editingResponsibleItem}
          onClose={() => setEditingResponsibleItem(null)}
          onSuccess={handleAssetUpdated}
        />
      )}

      {printModalOpen && (
        <AssetPrintModal
          asset={asset}
          userName={user?.fullName}
          onClose={() => setPrintModalOpen(false)}
        />
      )}
    </section>
  );
}
