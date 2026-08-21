import { DownloadSimple, Eye, FilePdf, Plus, Printer, Wrench, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
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
      const url = URL.createObjectURL(result.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `informe-${selected?.code ?? "OT"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Informe descargado correctamente.");
    } catch {
      setMessage("No se pudo generar el informe.");
    }
  }

  async function handleOpenPreview(autoPrint = false) {
    if (!selectedId) return;
    setPreviewLoading(true);
    setMessage("Generando vista previa del informe PDF...");
    try {
      const report = await generateWorkOrderReport(selectedId);
      const result = await api.get(report.downloadPath, { responseType: "blob" });
      const blob = new Blob([result.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setMessage("Vista previa del informe cargada.");

      if (autoPrint) {
        setTimeout(() => {
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
          }
        }, 600);
      }
    } catch {
      setMessage("No se pudo cargar la vista previa del PDF.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleClosePreview() {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
  }

  function handleDownloadFromPreview() {
    if (!previewBlobUrl) return;
    const link = document.createElement("a");
    link.href = previewBlobUrl;
    link.download = `informe-${selected?.code ?? "OT"}.pdf`;
    link.click();
  }

  function handlePrintFromPreview() {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  }

  const manualCosts = costs.filter((c) => c.category !== "MATERIAL");
  const usedTechMaterials = techMaterials.filter((m) => m.tipo === "USADO");

  return (
    <section className="work-order-reports-page">
      <header className="page-heading">
        <div>
          <h1>Informes detallados de OT</h1>
          <p>Consolida jornadas, técnicos, satisfacción, costos y evidencias de inicio y final.</p>
        </div>
      </header>

      <div className="work-order-report-layout">
        <section className="data-panel work-order-report-config">
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>Selección de OT</h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>Selecciona la orden de trabajo a consultar</p>
          </div>

          <label className="field">
            <span style={{ fontWeight: 600, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>Orden de trabajo</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff", color: "#0f172a", marginTop: 4 }}
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.code} · {order.assetDisplayCode || order.assetCode || "Sin bien"}
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <dl className="work-order-report-summary" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "20px 0", background: "#f8fafc", padding: "14px", borderRadius: 10, border: "1px solid #f1f5f9" }}>
              <div style={{ border: 0, padding: 0 }}>
                <dt style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Código</dt>
                <dd style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 700 }}>
                  <a href={`/ordenes-trabajo/${selected.id}`} style={{ textDecoration: "none", color: "#0284c7" }}>
                    {selected.code}
                  </a>
                </dd>
              </div>
              <div style={{ border: 0, padding: 0 }}>
                <dt style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Estado</dt>
                <dd style={{ margin: "3px 0 0" }}>
                  <span className={`status ${selected.status === "CERRADA" || selected.status === "APROBADA_POR_SUPERVISOR" ? "status-success" : selected.status === "EN_PROCESO" ? "status-warning" : "status-neutral"}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                    {selected.status}
                  </span>
                </dd>
              </div>
              <div style={{ border: 0, padding: 0 }}>
                <dt style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Técnico principal</dt>
                <dd style={{ margin: "3px 0 0", fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{selected.operatorName || "Sin asignar"}</dd>
              </div>
              <div style={{ border: 0, padding: 0 }}>
                <dt style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Horas efectivas</dt>
                <dd style={{ margin: "3px 0 0", fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{Math.round((selected.effectiveWorkMinutes ?? 0) / 60 * 10) / 10} h</dd>
              </div>
              <div style={{ border: 0, padding: 0, gridColumn: "span 2" }}>
                <dt style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Satisfacción</dt>
                <dd style={{ margin: "3px 0 0", fontSize: 13, color: selected.satisfaction?.rating ? "#d97706" : "#64748b", fontWeight: 600 }}>
                  {selected.satisfaction?.rating ? `★ ${selected.satisfaction.rating} / 5` : "Pendiente"}
                </dd>
              </div>
            </dl>
          )}

          <div className="work-order-report-actions" style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button className="button button-secondary" type="button" onClick={() => void generate()} disabled={!selectedId || previewLoading} style={{ padding: "8px 10px", fontSize: 12, justifyContent: "center" }}>
              <FilePdf size={16} /> Descargar PDF
            </button>
            <button className="button button-primary" type="button" onClick={() => void handleOpenPreview(false)} disabled={!selectedId || previewLoading} style={{ flex: 1, justifyContent: "center", padding: "8px 12px", fontSize: 13 }}>
              <Eye size={16} /> {previewLoading ? "Cargando..." : "Previsualizar"}
            </button>
            <button className="button button-secondary" type="button" onClick={() => void handleOpenPreview(true)} disabled={!selectedId || previewLoading} style={{ padding: "8px 12px", fontSize: 13, justifyContent: "center" }}>
              <Printer size={16} /> Imprimir
            </button>
          </div>
          {message && <p className="save-state" style={{ marginTop: 12, fontSize: 13, color: "#0284c7", fontWeight: 500 }}>{message}</p>}
        </section>

        <section className="data-panel work-order-cost-panel">
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f0f9ff", border: "1px solid #bae6fd", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7" }}>
                <Wrench size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>Costos de la OT</h2>
                <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>Registro y consolidación de costos del informe.</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void handleAutocompletar()}
                disabled={!selectedId}
                style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6 }}
              >
                Sincronizar materiales
              </button>
              <div style={{ background: "#f8fafc", padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", textAlign: "right" }}>
                <span style={{ fontSize: 10, color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Total</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>S/ {total.toFixed(2)}</strong>
              </div>
            </div>
          </header>

          {/* Tab Navigation */}
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e2e8f0", margin: "16px 0" }}>
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              style={{
                padding: "10px 16px",
                border: 0,
                background: "none",
                borderBottom: activeTab === "manual" ? "2px solid #0284c7" : "2px solid transparent",
                fontWeight: activeTab === "manual" ? 600 : 500,
                color: activeTab === "manual" ? "#0284c7" : "#64748b",
                cursor: "pointer",
                fontSize: 13,
                transition: "all 0.15s ease",
              }}
            >
              Mano de Obra y Otros
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("materials")}
              style={{
                padding: "10px 16px",
                border: 0,
                background: "none",
                borderBottom: activeTab === "materials" ? "2px solid #0284c7" : "2px solid transparent",
                fontWeight: activeTab === "materials" ? 600 : 500,
                color: activeTab === "materials" ? "#0284c7" : "#64748b",
                cursor: "pointer",
                fontSize: 13,
                transition: "all 0.15s ease",
              }}
            >
              Materiales Usados ({usedTechMaterials.length})
            </button>
          </div>

          {activeTab === "manual" ? (
            <>
              <form onSubmit={saveCost} className="work-order-cost-form" style={{ display: "grid", gridTemplateColumns: "140px 1fr 110px auto", gap: 10, marginBottom: 16 }}>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ borderRadius: 6, border: "1px solid #cbd5e1", padding: "8px 10px", fontSize: 13, background: "#fff" }}>
                  {manualCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del costo" required style={{ borderRadius: 6, border: "1px solid #cbd5e1", padding: "8px 12px", fontSize: 13 }} />
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Importe S/" required style={{ borderRadius: 6, border: "1px solid #cbd5e1", padding: "8px 12px", fontSize: 13 }} />
                <button className="button button-primary" type="submit" style={{ padding: "8px 14px", fontSize: 13 }}>
                  <Plus size={16} /> Agregar
                </button>
              </form>
              <div className="table-scroll" style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Tipo</th>
                      <th style={{ textAlign: "left" }}>Descripción</th>
                      <th style={{ textAlign: "right" }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualCosts.length ? manualCosts.map((item) => {
                      const isAmountNull = item.amount === null || item.amount === "";
                      return (
                        <tr key={item.id}>
                          <td>{item.categoryLabel}</td>
                          <td style={{ color: "#0f172a", fontWeight: 500 }}>{item.description}</td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                              <span style={{ fontSize: 12, color: "#64748b" }}>S/</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={editingAmounts[item.id] !== undefined ? editingAmounts[item.id] : (item.amount || "")}
                                onChange={(e) => setEditingAmounts({ ...editingAmounts, [item.id]: e.target.value })}
                                onBlur={() => void handleUpdateAmount(item.id)}
                                style={{
                                  width: 90,
                                  fontSize: 13,
                                  textAlign: "right",
                                  padding: "4px 8px",
                                  border: isAmountNull ? "1px solid #ef4444" : "1px solid #cbd5e1",
                                  borderRadius: 6,
                                  background: isAmountNull ? "#fef2f2" : "#ffffff"
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={3} className="empty-row" style={{ padding: "24px 14px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                          Sin costos registrados para esta OT.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="table-scroll" style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <table className="clean-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Material</th>
                    <th style={{ textAlign: "left" }}>Cantidad Usada</th>
                    <th style={{ textAlign: "right" }}>Importe</th>
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
                          <strong style={{ color: "#0f172a" }}>{m.materialNombre}</strong>
                          <code style={{ fontSize: 11, marginLeft: 8, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{m.materialCodigo}</code>
                        </td>
                        <td>{m.cantidad} unidades</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                            <span style={{ fontSize: 12, color: "#64748b" }}>S/</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
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
                                width: 90,
                                fontSize: 13,
                                textAlign: "right",
                                padding: "4px 8px",
                                border: isAmountNull ? "1px solid #ef4444" : "1px solid #cbd5e1",
                                borderRadius: 6,
                                background: isAmountNull ? "#fef2f2" : "#ffffff"
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={3} className="empty-row" style={{ padding: "24px 14px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                        El técnico no ha registrado materiales usados en esta OT.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="report-module-links" style={{ marginTop: 24, padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>Informes por sección</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            El informe ejecutivo mantiene sus indicadores de bienes, asignaciones, bajas, técnicos y operaciones. Para una OT específica usa el informe detallado y almacenable.
          </p>
        </div>
        <a className="button button-secondary" href="/informes" style={{ textDecoration: "none", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <DownloadSimple size={18} /> Abrir informe ejecutivo
        </a>
      </section>

      {/* MODAL PREVISUALIZADOR DE IMPRIMIR PDF */}
      {previewBlobUrl && (
        <div className="print-modal-overlay" onClick={handleClosePreview} style={{ zIndex: 9999 }}>
          <div
            className="print-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "1000px", width: "92vw", height: "88vh", display: "flex", flexDirection: "column" }}
          >
            <div className="print-modal-header" style={{ padding: "14px 20px" }}>
              <div className="print-modal-title-group">
                <FilePdf size={22} weight="duotone" style={{ color: "#0284c7" }} />
                <div>
                  <h2 style={{ fontSize: 16 }}>Previsualizador de Imprimir — {selected?.code}</h2>
                  <p style={{ fontSize: 12 }}>Revisa la ficha técnica antes de imprimir o descargar</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handlePrintFromPreview}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  <Printer size={16} /> Imprimir
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleDownloadFromPreview}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  <DownloadSimple size={16} /> Descargar PDF
                </button>
                <button className="print-modal-close" type="button" onClick={handleClosePreview} aria-label="Cerrar">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="print-modal-body" style={{ flex: 1, padding: 0, overflow: "hidden", background: "#525659" }}>
              <iframe
                ref={iframeRef}
                src={previewBlobUrl}
                title={`Vista previa PDF ${selected?.code}`}
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
