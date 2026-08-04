import { DownloadSimple, FilePdf, Plus, Printer, Wrench } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { addWorkOrderCost, generateWorkOrderReport, listWorkOrderCosts, listWorkOrders, type WorkOrderCost } from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

const categories = [{ value: "MANO_OBRA", label: "Mano de obra" }, { value: "MATERIAL", label: "Material" }, { value: "SERVICIO", label: "Servicio externo" }, { value: "OTRO", label: "Otro" }];

export function WorkOrderReportsPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [costs, setCosts] = useState<WorkOrderCost[]>([]);
  const [form, setForm] = useState({ category: "MATERIAL", description: "", amount: "" });
  const [message, setMessage] = useState("");
  const selected = useMemo(() => orders.find((item) => item.id === selectedId), [orders, selectedId]);

  useEffect(() => { void listWorkOrders().then((items) => { setOrders(items); setSelectedId(items[0]?.id ?? ""); }); }, []);
  useEffect(() => { if (selectedId) void listWorkOrderCosts(selectedId).then(setCosts); else setCosts([]); }, [selectedId]);
  const total = costs.reduce((sum, item) => sum + Number(item.amount), 0);

  async function saveCost(event: React.FormEvent) {
    event.preventDefault(); if (!selectedId || !form.description || !Number(form.amount)) return;
    const saved = await addWorkOrderCost(selectedId, { category: form.category, description: form.description, amount: Number(form.amount) });
    setCosts((current) => [...current, saved]); setForm({ category: "MATERIAL", description: "", amount: "" });
  }
  async function generate() {
    if (!selectedId) return;
    setMessage("Generando PDF...");
    try {
      const report = await generateWorkOrderReport(selectedId);
      const result = await api.get(report.downloadPath, { responseType: "blob" });
      const url = URL.createObjectURL(result.data); const link = document.createElement("a"); link.href = url; link.download = `informe-${selected?.code ?? "OT"}.pdf`; link.click(); URL.revokeObjectURL(url);
      setMessage("Informe generado y almacenado.");
    } catch { setMessage("No se pudo generar el informe."); }
  }
  return <section className="work-order-reports-page"><header className="page-heading"><div><p className="breadcrumb">Informes / Órdenes de trabajo</p><h1>Informes detallados de OT</h1><p>Consolida jornadas, técnicos, satisfacción, costos y evidencias de inicio y final.</p></div></header>
    <div className="work-order-report-layout"><section className="data-panel work-order-report-config"><label className="field"><span>Orden de trabajo</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{orders.map((order) => <option key={order.id} value={order.id}>{order.code} · {order.assetDisplayCode || order.assetCode || "Sin bien"}</option>)}</select></label>{selected && <dl className="work-order-report-summary"><div><dt>Estado</dt><dd>{selected.status}</dd></div><div><dt>Técnico principal</dt><dd>{selected.operatorName}</dd></div><div><dt>Horas efectivas</dt><dd>{Math.round((selected.effectiveWorkMinutes ?? 0) / 60 * 10) / 10} h</dd></div><div><dt>Satisfacción</dt><dd>{selected.satisfaction?.rating ? `${selected.satisfaction.rating}/5` : "Pendiente"}</dd></div></dl>}<div className="work-order-report-actions"><button className="button button-primary" type="button" onClick={() => void generate()} disabled={!selectedId}><FilePdf size={18}/>Generar PDF</button><button className="button button-secondary" type="button" onClick={() => window.print()}><Printer size={18}/>Imprimir vista</button></div>{message && <p className="save-state">{message}</p>}</section>
      <section className="data-panel work-order-cost-panel"><header><div><Wrench size={20}/><div><h2>Costos de la OT</h2><p>Registro manual para el informe final.</p></div></div><strong>S/ {total.toFixed(2)}</strong></header><form onSubmit={saveCost} className="work-order-cost-form"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" required/><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Importe" required/><button className="button button-secondary" type="submit"><Plus size={17}/>Agregar</button></form><div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Importe</th></tr></thead><tbody>{costs.length ? costs.map((item) => <tr key={item.id}><td>{item.categoryLabel}</td><td>{item.description}</td><td>S/ {Number(item.amount).toFixed(2)}</td></tr>) : <tr><td colSpan={3} className="empty-row">Sin costos registrados.</td></tr>}</tbody></table></div></section></div>
    <section className="report-module-links"><h2>Informes por sección</h2><p>El informe ejecutivo mantiene sus indicadores de bienes, asignaciones, bajas, técnicos y operaciones. Para una OT específica usa el informe detallado y almacenable.</p><a href="/informes"><DownloadSimple size={18}/>Abrir informe ejecutivo</a></section>
  </section>;
}
