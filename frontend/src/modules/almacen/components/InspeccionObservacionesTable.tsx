import { Plus, Trash } from '@phosphor-icons/react';
import type { ObservacionInspeccion, PiezaBase } from '@/modules/almacen/types';

export function InspeccionObservacionesTable({
  esPlantillaEPP,
  tipo,
  piezasLote,
  piezas,
  itemsObservacion,
  addItemObservacion,
  updateItemObservacion,
  removeItemObservacion,
}: {
  esPlantillaEPP: boolean;
  tipo: 'individual' | 'grupal';
  piezasLote: Set<number>;
  piezas: PiezaBase[];
  itemsObservacion: ObservacionInspeccion[];
  addItemObservacion: () => void;
  updateItemObservacion: (index: number, field: keyof ObservacionInspeccion, value: string) => void;
  removeItemObservacion: (index: number) => void;
}) {
  return (
              <div className="form-section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span>CondiciÃ³n insegura</span>
                  <h2>{esPlantillaEPP ? "EPP con observaciones" : "Herramientas con observaciones"}</h2>
                </div>
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={addItemObservacion}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Plus size={14} /> Agregar fila
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#64748B", marginTop: 2, marginBottom: 12 }}>
                {esPlantillaEPP
                  ? "EPP CON OBSERVACIONES (registrar Ãºnicamente los que presenten condiciÃ³n insegura o requieran acciÃ³n)."
                  : "HERRAMIENTAS CON OBSERVACIONES (registrar Ãºnicamente las que presenten condiciÃ³n insegura o requieran acciÃ³n)."}
              </p>

              {itemsObservacion.length > 0 ? (
                <div className="table-scroll" style={{ border: "1px solid #E2E8F0", borderRadius: 6, overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", width: 130 }}>CÃ³digo</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", minWidth: 160 }}>
                          {esPlantillaEPP ? "Nombre del EPP" : "Nombre de la herramienta"}
                        </th>
                        <th style={{ padding: "8px 10px", textAlign: "left", minWidth: 200 }}>ObservaciÃ³n encontrada</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", minWidth: 160 }}>AcciÃ³n recomendada</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", width: 120 }}>Estado</th>
                        <th style={{ padding: "8px 10px", width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsObservacion.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "6px 8px" }}>
                            {tipo === "grupal" && piezasLote.size > 0 ? (
                              <select
                                value={item.codigo}
                                onChange={(e) => updateItemObservacion(idx, "codigo", e.target.value)}
                                style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                              >
                                <option value="">â€” CÃ³digo â€”</option>
                                {piezas.filter((p) => piezasLote.has(p.id)).map((p) => (
                                  <option key={p.id} value={p.codigo}>{p.codigo}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={item.codigo}
                                onChange={(e) => updateItemObservacion(idx, "codigo", e.target.value)}
                                placeholder="CÃ³digo"
                                style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                              />
                            )}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={item.nombre}
                              onChange={(e) => updateItemObservacion(idx, "nombre", e.target.value)}
                              placeholder={esPlantillaEPP ? "Ej. Guantes de cuero" : "Ej. Martillo de bola"}
                              style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={item.observacion_encontrada}
                              onChange={(e) => updateItemObservacion(idx, "observacion_encontrada", e.target.value)}
                              placeholder="CondiciÃ³n insegura detectada..."
                              style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={item.accion_recomendada || ""}
                              onChange={(e) => updateItemObservacion(idx, "accion_recomendada", e.target.value)}
                              placeholder="Ej. Cambio de mango, dar de baja..."
                              style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              value={item.estado || "Operativa"}
                              onChange={(e) => updateItemObservacion(idx, "estado", e.target.value)}
                              style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            >
                              <option value="Operativa">Operativa</option>
                              <option value="Mantenimiento">Mantenimiento</option>
                              <option value="Baja">Baja</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeItemObservacion(idx)}
                              title="Eliminar fila"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 4 }}
                            >
                              <Trash size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  style={{
                    padding: "14px",
                    textAlign: "center",
                    background: "#F8FAFC",
                    borderRadius: 6,
                    border: "1px dashed #CBD5E1",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                    No hay Ã­tems con observaciones registrados. Si todos se encuentran conformes, continÃºa al siguiente paso.
                  </p>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={addItemObservacion}
                    style={{ marginTop: 8 }}
                  >
                    <Plus size={13} /> Agregar fila con observaciÃ³n
                  </button>
                </div>
              )}
            </div>
  );
}

