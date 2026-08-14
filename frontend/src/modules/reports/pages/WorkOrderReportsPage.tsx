import { DownloadSimple, FilePdf, Plus, Printer, Wrench } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { addWorkOrderCost, generateWorkOrderReport, listWorkOrderCosts, listWorkOrders, type WorkOrderCost } from "@/modules/workorders/workOrderRepository";
import { listWorkOrderMateriales, updateWorkOrderCostAmount, updateWorkOrderMaterial, type WorkOrderMaterial } from "@/modules/workorders/workOrderMaterialRepository";
import type { WorkOrder } from "@/modules/workorders/types";
import { generateWorkOrderApaPdf } from "@/modules/reports/utils/workOrderReportPdf";

const manualCategories = [{ value: "MANO_OBRA", label: "Mano de obra" }, { value: "SERVICIO", label: "Servicio externo" }, { value: "OTRO", label: "Otro" }];

export function WorkOrderReportsPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [costs, setCosts] = useState<WorkOrderCost[]>([]);
  const [materials, setMaterials] = useState<WorkOrderMaterial[]>([]);
  const [activeTab, setActiveTab] = useState<"manual" | "consumables" | "equipment">("manual");
  const [form, setForm] = useState({ category: "MANO_OBRA", description: "", amount: "" });
  const [message, setMessage] = useState("");
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});

  const selected = useMemo(() => orders.find((item) => item.id === selectedId), [orders, selectedId]);
  const total = costs.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const usedMaterials = materials.filter((item) => item.tipo === "USADO");
  const consumables = usedMaterials.filter((item) => item.clasificacionOperativa === "CONSUMIBLE");
  const reusableItems = usedMaterials.filter((item) => item.clasificacionOperativa !== "CONSUMIBLE");
  const manualCosts = costs.filter((item) => item.category !== "MATERIAL");

  function refreshOrderData(orderId = selectedId) {
    if (!orderId) {
      setCosts([]);
      setMaterials([]);
      return;
    }
    void Promise.all([listWorkOrderCosts(orderId), listWorkOrderMateriales(orderId)])
      .then(([costsData, materialsData]) => {
        setCosts(costsData);
        setMaterials(materialsData);
      })
      .catch(() => setMessage("No se pudieron cargar los costos y materiales de esta OT."));
  }

  useEffect(() => {
    void listWorkOrders().then((items) => {
      setOrders(items);
      setSelectedId(items[0]?.id ?? "");
    });
  }, []);
  useEffect(() => { refreshOrderData(); }, [selectedId]); // La sincronizaciÃ³n ocurre en el servidor al registrar un uso.

  async function saveCost(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !form.description || !Number(form.amount)) return;
    const saved = await addWorkOrderCost(selectedId, { category: form.category, description: form.description, amount: Number(form.amount) });
    setCosts((current) => [...current, saved]);
    setForm({ category: "MANO_OBRA", description: "", amount: "" });
  }

  async function saveUnitPrice(item: WorkOrderMaterial) {
    if (!selectedId) return;
    const rawPrice = editingPrices[item.id];
    if (rawPrice === undefined) return;
    try {
      const updated = await updateWorkOrderMaterial(selectedId, item.id, {
        material: item.material,
        cantidad: item.cantidad,
        tipo: item.tipo,
        precioUnitario: rawPrice === "" ? null : Number(rawPrice),
      });
      setMaterials((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      refreshOrderData();
      setMessage("Precio unitario actualizado y costo recalculado automáticamente.");
    } catch {
      setMessage("No se pudo actualizar el precio unitario del material.");
    }
  }

  async function saveManualAmount(costId: string) {
    if (!selectedId || editingAmounts[costId] === undefined) return;
    try {
      const updated = await updateWorkOrderCostAmount(selectedId, costId, editingAmounts[costId] === "" ? null : Number(editingAmounts[costId]));
      setCosts((current) => current.map((item) => item.id === costId ? (updated as unknown as WorkOrderCost) : item));
    } catch { setMessage("No se pudo actualizar el importe del costo."); }
  }

  async function generate() {
    if (!selected) return;
    setMessage("Generando informe en formato APA...");
    try {
      await generateWorkOrderApaPdf({ order: selected, costs, materials, action: "download" });
      setMessage("Informe técnico APA generado correctamente.");
    } catch {
      setMessage("No se pudo generar el informe APA.");
    }
  }

  async function printPdf() {
    if (!selected) return;
    setMessage("Preparando informe APA para impresión...");
    try {
      await generateWorkOrderApaPdf({ order: selected, costs, materials, action: "print" });
      setMessage("Diálogo de impresión del informe APA abierto.");
    } catch {
      setMessage("No se pudo abrir la impresión del informe APA.");
    }
  }

  return <section className="work-order-reports-page">
    <header className="page-heading"><div><p className="breadcrumb">Informes / Ã“rdenes de trabajo</p><h1>Informes detallados de OT</h1><p>Consolida jornadas, costos y evidencias con trazabilidad de los materiales utilizados.</p></div></header>
    <div className="work-order-report-layout">
      <section className="data-panel work-order-report-config">
        <label className="field"><span>Orden de trabajo</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{orders.map((order) => <option key={order.id} value={order.id}>{order.code} Â· {order.assetDisplayCode || order.assetCode || "Sin bien"}</option>)}</select></label>
        {selected && <dl className="work-order-report-summary"><div><dt>CÃ³digo</dt><dd><a href={`/ordenes-trabajo/${selected.id}`}>{selected.code}</a></dd></div><div><dt>Estado</dt><dd>{selected.status}</dd></div><div><dt>TÃ©cnico principal</dt><dd>{selected.operatorName}</dd></div><div><dt>Horas efectivas</dt><dd>{Math.round((selected.effectiveWorkMinutes ?? 0) / 6) / 10} h</dd></div></dl>}
        <div className="work-order-report-actions"><button className="button button-primary" type="button" onClick={() => void generate()} disabled={!selectedId}><FilePdf size={18}/>Generar PDF</button><button className="button button-secondary" type="button" onClick={() => void printPdf()} disabled={!selectedId}><Printer size={18}/>Imprimir</button></div>
        {message && <p className="save-state" role="status">{message}</p>}
      </section>
      <section className="data-panel work-order-cost-panel">
        <header><div><Wrench size={20}/><div><h2>Costos y uso operativo</h2><p>Los consumibles se calculan al guardar; herramientas y EPP no se suman al costo.</p></div></div><strong>S/ {total.toFixed(2)}</strong></header>
        <div className="report-tabs" role="tablist" aria-label="Detalle de costos y uso">
          <button type="button" role="tab" aria-selected={activeTab === "manual"} className={activeTab === "manual" ? "is-active" : ""} onClick={() => setActiveTab("manual")}>Mano de obra y otros</button>
          <button type="button" role="tab" aria-selected={activeTab === "consumables"} className={activeTab === "consumables" ? "is-active" : ""} onClick={() => setActiveTab("consumables")}>Consumibles ({consumables.length})</button>
          <button type="button" role="tab" aria-selected={activeTab === "equipment"} className={activeTab === "equipment" ? "is-active" : ""} onClick={() => setActiveTab("equipment")}>Herramientas y EPP ({reusableItems.length})</button>
        </div>
        {activeTab === "manual" && <><form onSubmit={saveCost} className="work-order-cost-form"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{manualCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="DescripciÃ³n" required/><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Importe" required/><button className="button button-secondary" type="submit"><Plus size={17}/>Agregar</button></form><CostTable costs={manualCosts} editingAmounts={editingAmounts} onEdit={setEditingAmounts} onSave={saveManualAmount}/></>}
        {activeTab === "consumables" && <MaterialUsageTable items={consumables} costs={costs} editingPrices={editingPrices} onEditPrice={setEditingPrices} onSavePrice={saveUnitPrice} showPrice />}
        {activeTab === "equipment" && <MaterialUsageTable items={reusableItems} costs={costs} editingPrices={editingPrices} onEditPrice={setEditingPrices} onSavePrice={saveUnitPrice} />}
      </section>
    </div>
    <section className="report-module-links"><h2>Informes por secciÃ³n</h2><p>Los cambios de cantidad, tipo de uso o precio unitario se reflejan automÃ¡ticamente en el consolidado.</p><a href="/informes"><DownloadSimple size={18}/>Abrir informe ejecutivo</a></section>
  </section>;
}

function CostTable({ costs, editingAmounts, onEdit, onSave }: { costs: WorkOrderCost[]; editingAmounts: Record<string, string>; onEdit: (value: Record<string, string>) => void; onSave: (costId: string) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>Tipo</th><th>DescripciÃ³n</th><th>Importe</th></tr></thead><tbody>{costs.length ? costs.map((item) => <tr key={item.id}><td>{item.categoryLabel}</td><td>{item.description}</td><td><span>S/ </span><input type="number" min="0" step="0.01" value={editingAmounts[item.id] ?? item.amount ?? ""} onChange={(event) => onEdit({ ...editingAmounts, [item.id]: event.target.value })} onBlur={() => void onSave(item.id)}/></td></tr>) : <tr><td colSpan={3} className="empty-row">Sin costos registrados.</td></tr>}</tbody></table></div>;
}

function MaterialUsageTable({ items, costs, editingPrices, onEditPrice, onSavePrice, showPrice = false }: { items: WorkOrderMaterial[]; costs: WorkOrderCost[]; editingPrices: Record<string, string>; onEditPrice: (value: Record<string, string>) => void; onSavePrice: (item: WorkOrderMaterial) => void; showPrice?: boolean }) {
  return <div className="table-scroll"><table><thead><tr><th>Elemento</th><th>Uso</th><th>Cantidad</th>{showPrice && <><th>Precio unitario</th><th>Costo calculado</th></>}</tr></thead><tbody>{items.length ? items.map((item) => {
    const cost = costs.find((entry) => entry.description.includes(item.materialNombre));
    return <tr key={item.id}><td><strong>{item.materialNombre}</strong><small>{item.clasificacionOperativaLabel || "Material"}</small></td><td>{item.tipoLabel}</td><td>{item.cantidad}</td>{showPrice && <><td><span>S/ </span><input type="number" min="0" step="0.01" value={editingPrices[item.id] ?? (item.precioUnitario as string) ?? ""} onChange={(event) => onEditPrice({ ...editingPrices, [item.id]: event.target.value })} onBlur={() => void onSavePrice(item)} aria-label={`Precio unitario de ${item.materialNombre}`}/></td><td>{cost?.amount === null ? "Sin precio" : `S/ ${Number(cost?.amount || 0).toFixed(2)}`}</td></>}</tr>;
  }) : <tr><td colSpan={showPrice ? 5 : 3} className="empty-row">No hay registros en esta categoría.</td></tr>}</tbody></table></div>;
}
