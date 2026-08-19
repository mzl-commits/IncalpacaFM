import { DownloadSimple, FilePdf, Plus, Printer, Wrench } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { addWorkOrderCost, generateWorkOrderReport, listWorkOrderCosts, listWorkOrders, type WorkOrderCost } from "@/modules/workorders/workOrderRepository";
import { autocompletarCostosMateriales, updateWorkOrderCostAmount, listWorkOrderMateriales, type WorkOrderMaterial } from "@/modules/workorders/workOrderMaterialRepository";
import type { WorkOrder } from "@/modules/workorders/types";

const manualCategories = [{ value: "MANO_OBRA", label: "Mano de obra" }, { value: "SERVICIO", label: "Servicio externo" }, { value: "OTRO", label: "Otro" }];

export function WorkOrderReportsPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [costs, setCosts] = useState<WorkOrderCost[]>([]);
  const [techMaterials, setTechMaterials] = useState<WorkOrderMaterial[]>([]);
  const [activeTab, setActiveTab] = useState<"manual" | "materials">("manual");
  const [form, setForm] = useState({ category: "MANO_OBRA", description: "", amount: "" });
  const [message, setMessage] = useState("");
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  
  const selected = useMemo(() => orders.find((item) => item.id === selectedId), [orders, selectedId]);

  useEffect(() => { void listWorkOrders().then((items) => { setOrders(items); setSelectedId(items[0]?.id ?? ""); }); }, []);
  
  useEffect(() => {
    if (selectedId) {
      // Auto-sync materials to costs on load/select, then refresh lists
      void autocompletarCostosMateriales(selectedId)
        .then(() => Promise.all([listWorkOrderCosts(selectedId), listWorkOrderMateriales(selectedId)]))
        .then(([costsData, materialsData]) => {
          setCosts(costsData);
          setTechMaterials(materialsData);
        })
        .catch(() => {
          // fallback if something fails
          void Promise.all([listWorkOrderCosts(selectedId), listWorkOrderMateriales(selectedId)])
            .then(([costsData, materialsData]) => {
              setCosts(costsData);
              setTechMaterials(materialsData);
            });
        });
    } else {
      setCosts([]);
      setTechMaterials([]);
    }
  }, [selectedId]);

  const total = costs.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  async function saveCost(event: React.FormEvent) {
    event.preventDefault(); if (!selectedId || !form.description || !Number(form.amount)) return;
    const saved = await addWorkOrderCost(selectedId, { category: form.category, description: form.description, amount: Number(form.amount) });
    setCosts((current) => [...current, saved]); setForm({ category: "MANO_OBRA", description: "", amount: "" });
  }

  async function handleAutocompletar() {
    if (!selectedId) return;
    try {
      const data = await autocompletarCostosMateriales(selectedId);
      setCosts(data as WorkOrderCost[]);
      setMessage("Costos de materiales sincronizados.");
    } catch {
      alert("No se pudo autocompletar los materiales.");
    }
  }

  async function handleUpdateAmount(costId: string) {
    const val = editingAmounts[costId];
    if (val === undefined) return;
    try {
      const updated = await updateWorkOrderCostAmount(selectedId, costId, val === "" ? null : Number(val));
      setCosts((current) =>
        current.map((c) =>
          c.id === costId ? { ...c, amount: updated.amount ?? "" } : c
        )
      );
    } catch {
      alert("No se pudo actualizar el importe del costo.");
    }
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

  async function printPdf() {
    if (!selectedId) return;
    setMessage("Preparando PDF para impresión...");
    try {
      const report = await generateWorkOrderReport(selectedId);
      const result = await api.get(report.downloadPath, { responseType: "blob" });
      const blob = new Blob([result.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setMessage("Diálogo de impresión del PDF abierto.");
        }, 300);
      };
    } catch {
      setMessage("No se pudo abrir la impresión del PDF.");
    }
  }

  const manualCosts = costs.filter((c) => c.category !== "MATERIAL");
  const usedTechMaterials = techMaterials.filter((m) => m.tipo === "USADO");

  return <section className="work-order-reports-page"><header className="page-heading"><div><p className="breadcrumb">Informes / Órdenes de trabajo</p><h1>Informes detallados de OT</h1><p>Consolida jornadas, técnicos, satisfacción, costos y evidencias de inicio y final.</p></div></header>
    <div className="work-order-report-layout"><section className="data-panel work-order-report-config"><label className="field"><span>Orden de trabajo</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{orders.map((order) => <option key={order.id} value={order.id}>{order.code} · {order.assetDisplayCode || order.assetCode || "Sin bien"}</option>)}</select></label>{selected && <dl className="work-order-report-summary"><div><dt>Código</dt><dd><a href={`/ordenes-trabajo/${selected.id}`} style={{textDecoration: "underline", color: "var(--brand-primary)"}}>{selected.code}</a></dd></div><div><dt>Estado</dt><dd>{selected.status}</dd></div><div><dt>Técnico principal</dt><dd>{selected.operatorName}</dd></div><div><dt>Horas efectivas</dt><dd>{Math.round((selected.effectiveWorkMinutes ?? 0) / 60 * 10) / 10} h</dd></div><div><dt>Satisfacción</dt><dd>{selected.satisfaction?.rating ? `${selected.satisfaction.rating}/5` : "Pendiente"}</dd></div></dl>}<div className="work-order-report-actions"><button className="button button-primary" type="button" onClick={() => void generate()} disabled={!selectedId}><FilePdf size={18}/>Generar PDF</button><button className="button button-secondary" type="button" onClick={() => void printPdf()} disabled={!selectedId}><Printer size={18}/>Imprimir</button></div>{message && <p className="save-state">{message}</p>}</section>
      <section className="data-panel work-order-cost-panel">
        <header>
          <div>
            <Wrench size={20}/>
            <div>
              <h2>Costos de la OT</h2>
              <p>Registro y consolidación de costos del informe.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void handleAutocompletar()}
              disabled={!selectedId}
              style={{ padding: "4px 10px", fontSize: 12 }}
            >
              Sincronizar materiales
            </button>
            <strong>S/ {total.toFixed(2)}</strong>
          </div>
        </header>

        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border, #e5e7eb)", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            style={{
              padding: "8px 16px",
              border: 0,
              background: "none",
              borderBottom: activeTab === "manual" ? "2px solid var(--brand-primary, #0056b3)" : "none",
              fontWeight: activeTab === "manual" ? 600 : 400,
              color: activeTab === "manual" ? "var(--brand-primary, #0056b3)" : "var(--muted)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Mano de Obra y Otros
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("materials")}
            style={{
              padding: "8px 16px",
              border: 0,
              background: "none",
              borderBottom: activeTab === "materials" ? "2px solid var(--brand-primary, #0056b3)" : "none",
              fontWeight: activeTab === "materials" ? 600 : 400,
              color: activeTab === "materials" ? "var(--brand-primary, #0056b3)" : "var(--muted)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Materiales Usados ({usedTechMaterials.length})
          </button>
        </div>

        {activeTab === "manual" ? (
          <>
            <form onSubmit={saveCost} className="work-order-cost-form">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {manualCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" required/>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Importe" required/>
              <button className="button button-secondary" type="submit"><Plus size={17}/>Agregar</button>
            </form>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {manualCosts.length ? manualCosts.map((item) => {
                    const isAmountNull = item.amount === null || item.amount === "";
                    return (
                      <tr key={item.id}>
                        <td>{item.categoryLabel}</td>
                        <td>{item.description}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>S/ </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Asignar"
                              value={editingAmounts[item.id] !== undefined ? editingAmounts[item.id] : (item.amount || "")}
                              onChange={(e) => setEditingAmounts({ ...editingAmounts, [item.id]: e.target.value })}
                              onBlur={() => void handleUpdateAmount(item.id)}
                              style={{
                                width: 80,
                                fontSize: 13,
                                padding: "2px 4px",
                                border: isAmountNull ? "1px solid var(--error, #dc2626)" : "1px solid var(--border, #e5e7eb)",
                                borderRadius: 4,
                                background: isAmountNull ? "rgba(220,38,38,0.04)" : "inherit"
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={3} className="empty-row">Sin costos registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Cantidad Usada</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {usedTechMaterials.length ? usedTechMaterials.map((m) => {
                  const costItem = costs.find(c => c.category === "MATERIAL" && c.description === m.materialNombre);
                  const amountVal = costItem ? (editingAmounts[costItem.id] !== undefined ? editingAmounts[costItem.id] : (costItem.amount || "")) : "";
                  const isAmountNull = !amountVal;
                  return (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.materialNombre}</strong>
                        <code style={{ fontSize: 11, marginLeft: 6, color: "var(--muted)" }}>{m.materialCodigo}</code>
                      </td>
                      <td>{m.cantidad} unidades</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>S/ </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Asignar"
                            value={amountVal}
                            disabled={!costItem}
                            onChange={(e) => {
                              if (costItem) {
                                setEditingAmounts({ ...editingAmounts, [costItem.id]: e.target.value });
                              }
                            }}
                            onBlur={() => {
                              if (costItem) {
                                void handleUpdateAmount(costItem.id);
                              }
                            }}
                            style={{
                              width: 80,
                              fontSize: 13,
                              padding: "2px 4px",
                              border: isAmountNull ? "1px solid var(--error, #dc2626)" : "1px solid var(--border, #e5e7eb)",
                              borderRadius: 4,
                              background: isAmountNull ? "rgba(220,38,38,0.04)" : "inherit"
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={3} className="empty-row">El técnico no ha registrado materiales usados en esta OT.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
    <section className="report-module-links"><h2>Informes por sección</h2><p>El informe ejecutivo mantiene sus indicadores de bienes, asignaciones, bajas, técnicos y operaciones. Para una OT específica usa el informe detallado y almacenable.</p><a href="/informes"><DownloadSimple size={18}/>Abrir informe ejecutivo</a></section>
  </section>;
}
