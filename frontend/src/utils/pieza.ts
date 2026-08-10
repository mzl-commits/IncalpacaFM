/**
 * Devuelve el identificador visible de una pieza.
 * - Si tiene codigo (piezas raiz/sueltas), lo devuelve.
 * - Si no tiene codigo (nuevas piezas hijas de estuche), devuelve
 *   "nombre (medida)" del material, o "ID-{id}" como ultimo fallback.
 */
export function labelPieza(p: {
  codigo: string | null;
  material_nombre?: string;
  material_medida?: string;
  id: number;
}): string {
  if (p.codigo) return p.codigo;
  const parts = [
    p.material_nombre,
    p.material_medida ? `(${p.material_medida})` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : `ID-${p.id}`;
}
