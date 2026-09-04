import type { Criterio, ValorRespuesta } from '@/modules/almacen/types';
import { valorRespuestaLabels } from '@/modules/almacen/types';

export function InspeccionCriteriosList({
  criterios,
  respuestas,
  setRespuesta,
}: {
  criterios: Criterio[];
  respuestas: Record<number, { valor: ValorRespuesta | ''; observacion: string }>;
  setRespuesta: (criterioId: number, field: 'valor' | 'observacion', value: string) => void;
}) {
  return (
              <div className="form-section-heading">
                <span>Paso 4</span>
                <h2>Criterios de inspección ({criterios.length})</h2>
              </div>
              <div>
                {criterios
                  .slice()
                  .sort((a, b) => a.orden - b.orden)
                  .map((criterio) => {
                    const resp = respuestas[criterio.id] ?? { valor: "", observacion: "" };
                    return (
                      <div key={criterio.id} className="criterio-row">
                        <span className="criterio-texto">
                          <strong>{criterio.orden}.</strong> {criterio.texto}
                        </span>
                        <div className="criterio-controls">
                          <select
                            value={resp.valor}
                            onChange={(e) => setRespuesta(criterio.id, "valor", e.target.value)}
                          >
                            <option value="">— evaluar —</option>
                            {(Object.entries(valorRespuestaLabels) as [ValorRespuesta, string][]).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                          {resp.valor === "no_cumple" && (
                            <input
                              type="text"
                              placeholder="Observación (opcional)"
                              value={resp.observacion}
                              onChange={(e) => setRespuesta(criterio.id, "observacion", e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
  );
}
