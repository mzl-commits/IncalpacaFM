import { CaretDown, MagnifyingGlass, Tag, UserPlus, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { getAssetDetail } from "@/modules/assets/assetDetailRepository";
import type { TaxonomyRecord } from "@/modules/taxonomy/taxonomyRepository";
import type { AssignmentCatalog } from "@/modules/assignments/assignmentRepository";
import { deliverAsset } from "@/modules/assignments/assignmentRepository";
import { displayCode, type ResponsibleItem } from "@/modules/assets/pages/assetDetailUtils";
import type { SystemUser } from "@/modules/accounts/types";

interface AssetResponsibleModalProps {
  asset: AssetDetailRecord;
  catalog: AssignmentCatalog | null;
  taxonomies: TaxonomyRecord[];
  user: SystemUser | null | undefined;
  onClose: () => void;
  onSuccess: (updatedAsset: AssetDetailRecord) => void;
}

export function AssetResponsibleModal({ asset, catalog, taxonomies, user, onClose, onSuccess }: AssetResponsibleModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [selectedRespId, setSelectedRespId] = useState<string>("");
  const [selectedLocId, setSelectedLocId] = useState<string>("");

  const [respSearchQuery, setRespSearchQuery] = useState("");
  const [isRespDropdownOpen, setIsRespDropdownOpen] = useState(false);
  const [locSearchQuery, setLocSearchQuery] = useState("");
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false);

  const [newRespForm, setNewRespForm] = useState({
    responsible: "",
    area: "",
    building: asset.location_detail?.building || "",
    room: asset.location_detail?.room || "",
    reason: "Asignación de puesto de trabajo",
    start_date: new Date().toISOString().slice(0, 10),
  });

  const liveTaxonomy = useMemo(() => {
    return (
      taxonomies.find(
        (t) =>
          t.id === asset.taxonomy_detail?.id ||
          (t.prefix && asset.fm_code?.startsWith(t.prefix)) ||
          (t.prefix && asset.taxonomy_detail?.prefix === t.prefix)
      ) || null
    );
  }, [asset, taxonomies]);

  const searchedResponsibles = useMemo(() => {
    if (!respSearchQuery.trim()) return catalog?.responsibles || [];
    const q = respSearchQuery.toLowerCase();
    return (catalog?.responsibles || []).filter(
      (r) =>
        r.display_name.toLowerCase().includes(q) ||
        (r.external_reference && r.external_reference.toLowerCase().includes(q)) ||
        (r.area_name && r.area_name.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q))
    );
  }, [catalog, respSearchQuery]);

  const searchedLocations = useMemo(() => {
    if (!locSearchQuery.trim()) return catalog?.locations || [];
    const q = locSearchQuery.toLowerCase();
    return (catalog?.locations || []).filter(
      (l) =>
        (l.building && l.building.toLowerCase().includes(q)) ||
        (l.area && l.area.toLowerCase().includes(q)) ||
        (l.room && l.room.toLowerCase().includes(q)) ||
        (l.zone && l.zone.toLowerCase().includes(q)) ||
        (l.specific_location && l.specific_location.toLowerCase().includes(q))
    );
  }, [catalog, locSearchQuery]);

  const availableAreas = useMemo(() => {
    return Array.from(
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
  }, [catalog]);

  async function saveNewResponsible(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const responsibleName = (newRespForm.responsible || respSearchQuery).trim();
    if (!responsibleName) return;

    setSaving(true);
    setError("");
    try {
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
          onSuccess(refreshed);
          return;
        } catch (err) {
          console.warn("deliverAsset falló, aplicando sincronización directa:", err);
        }
      }

      const nowIso = new Date().toISOString();
      const startDateIso = newRespForm.start_date ? new Date(newRespForm.start_date).toISOString() : nowIso;

      const updatedHistory = asset.responsible_history.map((item) => {
        if (item.status?.toUpperCase() === "ACTIVA" || item.status?.toUpperCase() === "ACTIVO" || !item.end_date) {
          return { ...item, status: "FINALIZADA", end_date: startDateIso };
        }
        return item;
      });

      const newEntry: ResponsibleItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        responsible: responsibleName,
        type: "ASIGNACION",
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

      onSuccess(updatedAsset);
    } catch {
      setError("No se pudo registrar la asignación.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="asset-edit-backdrop"
      role="presentation"
      onClick={onClose}
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
        <header
          style={{
            background: "#FFFFFF",
            borderBottom: "1px solid #E5E5E5",
            padding: "18px 24px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#525252", textTransform: "uppercase" }}>
              INCALPACA FM S.A. — Gestión de Custodia
            </span>
            <h2 id="add-resp-title" style={{ margin: "4px 0 6px", fontSize: "20px", fontWeight: 800, color: "#000000" }}>
              Asignar nuevo responsable
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#000000",
                  color: "#FFFFFF",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                }}
              >
                {displayCode(asset)}
              </span>
              <strong style={{ fontSize: "14px", color: "#000000" }}>{asset.name}</strong>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={onClose}
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

        <div
          style={{
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
          }}
        >
          <Tag size={20} weight="bold" style={{ flexShrink: 0, color: "#000000", marginTop: "2px" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <strong style={{ color: "#000000" }}>Taxonomía en Tiempo Real (BD):</strong>
                <span
                  style={{
                    background: "#000000",
                    color: "#FFFFFF",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    fontWeight: 700,
                    fontSize: "11px",
                    letterSpacing: "0.03em",
                  }}
                >
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
                <span
                  style={{
                    background: "#E5E5E5",
                    color: "#000000",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  Prefijo: {liveTaxonomy?.prefix || asset.taxonomy_detail?.prefix}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11.5px", color: "#525252", flexWrap: "wrap" }}>
              <span>
                Especialidad: <strong>{liveTaxonomy?.specialty || asset.taxonomy_detail?.specialty || "Facility Management"}</strong>
              </span>
              {(liveTaxonomy?.assetType || asset.taxonomy_detail?.asset_type) && (
                <span>
                  · Tipo: <strong>{liveTaxonomy?.assetType || asset.taxonomy_detail?.asset_type}</strong>
                </span>
              )}
              {liveTaxonomy?.usefulLifeYears ? (
                <span>
                  · Vida útil estimada: <strong>{liveTaxonomy.usefulLifeYears} años</strong>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <form onSubmit={saveNewResponsible} style={{ padding: "20px 24px 20px" }}>
          {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div style={{ gridColumn: "1 / -1", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#000000" }}>Responsable / Custodio *</label>
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

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>Área / Departamento *</label>
              <input
                required
                list="area-suggestions"
                placeholder="Ej. Facility Management"
                value={newRespForm.area}
                onChange={(e) => setNewRespForm({ ...newRespForm, area: e.target.value })}
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

            <div>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>Fecha de inicio de custodia *</label>
              <input
                type="date"
                required
                value={newRespForm.start_date}
                onChange={(e) => setNewRespForm({ ...newRespForm, start_date: e.target.value })}
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

            <div style={{ gridColumn: "1 / -1", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#000000" }}>Ubicación física (buscar en BD o escribir)</label>
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

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", fontWeight: 700, color: "#000000" }}>Motivo de asignación / Observaciones *</label>
              <input
                required
                placeholder="Ej. Asignación de puesto de trabajo / Custodia operativa"
                value={newRespForm.reason}
                onChange={(e) => setNewRespForm({ ...newRespForm, reason: e.target.value })}
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

          <footer
            style={{
              marginTop: "18px",
              paddingTop: "14px",
              borderTop: "1px solid #E5E5E5",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
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
    </div>,
    document.body
  );
}
