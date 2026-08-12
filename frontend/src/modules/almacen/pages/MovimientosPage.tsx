import { ArrowRight, ClockCountdown, FileXls, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Fragment, useMemo, useState } from "react";

import { listMateriales, listPiezas } from "@/modules/almacen/catalogoRepository";
import type { Material, PiezaBase } from "@/modules/almacen/types";
import { FilterSelect, FilterDate, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  listMovimientos,
  listChecklistPrestados,
  listSolicitudes,
  listGruposSolicitud,
  aprobarSolicitud,
  rechazarSolicitud,
  descargarExcelMovimientos,
} from "@/modules/almacen/inventarioRepository";
import { useAuth } from "@/modules/accounts/AuthContext";

const FILTER_KEYS = ["material", "pieza", "tipo", "desde", "hasta"] as const;

export function MovimientosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const esAdmin = user?.role === "ADMINISTRADOR";
  const esAlmacenero = user?.role === "ALMACENERO";
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  // El campo "Buscar" (values.material) es texto libre (código/nombre de
  // material o código de pieza), no un ID — por eso NO se manda al backend
  // como filtro `material` (que espera un ID numérico y no matchea texto).
  // El backend de movimientos no tiene búsqueda por texto, así que el
  // matcheo se hace en el frontend sobre `material_codigo` / `material_nombre`
  // / `pieza_codigo`, que ya vienen en cada Movimiento (ver `filtrados` más
  // abajo). Esto también evita disparar una consulta por cada tecla escrita.
  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ["movimientos", values.pieza, values.tipo],
    queryFn: () =>
      listMovimientos({
        pieza: values.pieza ? Number(values.pieza) : undefined,
        tipo: values.tipo || undefined,
      }),
  });

  // Índice de piezas (padre, tiene_hijas) para poder agrupar sin tocar el backend
  const { data: piezasIndex = [] } = useQuery({
    queryKey: ["piezas-index"],
    queryFn: () => listPiezas({}),
    staleTime: 60_000,
  });
  const piezasById = useMemo(() => {
    const map = new Map<number, PiezaBase>();
    piezasIndex.forEach((p) => map.set(p.id, p));
    return map;
  }, [piezasIndex]);

  // Índice de materiales, para resolver el código real del CONTENEDOR en
  // devoluciones agrupadas. PiezaBase no trae material_codigo (solo
  // material_nombre), así que se busca acá por el id de material de la pieza.
  const { data: materialesIndex = [] } = useQuery({
    queryKey: ["materiales"],
    queryFn: () => listMateriales(),
    staleTime: 60_000,
  });
  const materialesById = useMemo(() => {
    const map = new Map<number, Material>();
    materialesIndex.forEach((m) => map.set(m.id, m));
    return map;
  }, [materialesIndex]);

  // Checklist: piezas prestadas sin devolver (todos los días, no solo hoy)
  const { data: prestadas = [] } = useQuery({
    queryKey: ["checklist-prestados"],
    queryFn: () => listChecklistPrestados(),
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const prestadasAntiguas = prestadas.filter((p) => {
    const fechaMov = p.ultimo_movimiento?.fecha?.slice(0, 10);
    return fechaMov && fechaMov < hoy;
  });

  // Solicitudes pendientes por grupo (solo para admin)
  const { data: gruposPendientes = [] } = useQuery({
    queryKey: ["grupos-solicitud", "pendiente"],
    queryFn: () => listGruposSolicitud({ estado: "pendiente" }),
    enabled: esAdmin,
    refetchInterval: 30_000,
  });

  // Solicitudes pendientes individuales (legacy / respaldos)
  const { data: solicitudesPendientes = [] } = useQuery({
    queryKey: ["solicitudes", "pendiente"],
    queryFn: () => listSolicitudes({ estado: "pendiente" }),
    enabled: esAdmin,
    refetchInterval: 30_000,
  });

  const aprobarMut = useMutation({
    mutationFn: (id: number) => aprobarSolicitud(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    },
  });

  const rechazarMut = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      rechazarSolicitud(id, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["solicitudes"] }),
  });

  const [motivoRechazos, setMotivoRechazos] = useState<Record<number, string>>({});
  const [excelLoading, setExcelLoading] = useState(false);

  async function handleExcel() {
    setExcelLoading(true);
    try {
      const materialFiltro = values.pieza ? undefined : undefined; // se extiende si hay filtro por material
      await descargarExcelMovimientos(materialFiltro);
    } finally {
      setExcelLoading(false);
    }
  }

  // Stats
  const totalSalidas = movimientos.filter((m) => m.tipo === "salida").length;
  const totalEntradas = movimientos.filter((m) => m.tipo === "entrada").length;
  const totalBajas = movimientos.filter((m) => m.tipo === "baja").length;

  // Filtrado local por fechas (las fechas no se mandan al backend aún) y por
  // el texto del buscador (código/nombre de material o código de pieza).
  const filtrados = useMemo(() => {
    const q = values.material.trim().toLowerCase();
    return movimientos.filter((m) => {
      const fecha = m.fecha.slice(0, 10);
      if (values.desde && fecha < values.desde) return false;
      if (values.hasta && fecha > values.hasta) return false;
      if (q) {
        const matchMaterial =
          m.material_codigo?.toLowerCase().includes(q) ||
          m.material_nombre?.toLowerCase().includes(q);
        const matchPieza = m.pieza_codigo?.toLowerCase().includes(q);
        if (!matchMaterial && !matchPieza) return false;
      }
      return true;
    });
  }, [movimientos, values.desde, values.hasta, values.material]);

  type Mov = (typeof filtrados)[number];

  interface GrupoMovimiento {
    key: string;
    esGrupo: boolean;
    tipo: Mov["tipo"];
    tipoDisplay: string;
    fecha: string;
    codigoDisplay: string;
    materialNombre: string;
    materialCodigo: string;
    responsableNombre: string;
    referencia: string;
    observaciones: string;
    extraTexto?: string;
    hijas: Mov[];
  }

  const grupos = useMemo<GrupoMovimiento[]>(() => {
    const resultado: GrupoMovimiento[] = [];
    const usados = new Set<number>();

    // 1) Salidas: agrupadas por lote_id (contenedor + hijas de la misma transacción)
    const porLote = new Map<string, Mov[]>();
    filtrados.forEach((m) => {
      if (m.tipo === "salida" && m.lote_id) {
        const arr = porLote.get(m.lote_id) ?? [];
        arr.push(m);
        porLote.set(m.lote_id, arr);
      }
    });
    porLote.forEach((movs) => {
      const principal = movs.find((m) => m.pieza != null && piezasById.get(m.pieza)?.padre == null) ?? movs[0];
      const hijas = movs.filter((m) => m.id !== principal.id);
      movs.forEach((m) => usados.add(m.id));

      const contenedorId = principal.pieza;
      const totalHijas = contenedorId
        ? Array.from(piezasById.values()).filter((p) => p.padre === contenedorId).length
        : 0;

      resultado.push({
        key: `salida-${principal.id}`,
        esGrupo: hijas.length > 0,
        tipo: principal.tipo,
        tipoDisplay: principal.tipo_display,
        fecha: principal.fecha,
        codigoDisplay: principal.pieza_codigo
          ?? (principal.cantidad_cajas
            ? `${principal.cantidad_cajas} caja(s) · ${principal.cantidad} u.`
            : `${principal.cantidad} u.`),
        materialNombre: principal.material_nombre,
        materialCodigo: principal.material_codigo,
        responsableNombre: principal.responsable_nombre,
        referencia: principal.referencia_externa,
        observaciones: principal.observaciones,
        extraTexto: hijas.length > 0 ? `${hijas.length} de ${totalHijas} pza(s)` : undefined,
        hijas,
      });
    });

    // 2) Entradas de piezas-hijas devueltas juntas (mismo padre, mismo responsable, mismo minuto)
    const porDevolucion = new Map<string, Mov[]>();
    filtrados.forEach((m) => {
      if (usados.has(m.id) || m.tipo !== "entrada" || !m.pieza) return;
      const padre = piezasById.get(m.pieza)?.padre;
      if (!padre) return; // solo agrupa piezas hijas, no piezas sueltas ni contenedores
      const minuto = m.fecha.slice(0, 16); // YYYY-MM-DDTHH:mm
      const key = `${padre}-${m.responsable}-${minuto}`;
      const arr = porDevolucion.get(key) ?? [];
      arr.push(m);
      porDevolucion.set(key, arr);
    });
    porDevolucion.forEach((movs) => {
      // Se agrupa siempre bajo el estuche, igual que en salida — incluso si es una sola
      // pieza devuelta, para que muestre el contenedor con su desplegable.
      movs.forEach((m) => usados.add(m.id));
      const primero = movs[0];
      const padreId = piezasById.get(primero.pieza as number)?.padre as number;
      const padrePieza = piezasById.get(padreId);
      // El contenedor es el que define el material a mostrar (ej. "Destornillador
      // Mixto" / H0003), no la pieza hija devuelta (ej. "Punta plana" / H80GT).
      // PiezaBase no trae material_codigo, así que se resuelve vía materialesById
      // usando el id de material del contenedor.
      const padreMaterial = padrePieza ? materialesById.get(padrePieza.material) : undefined;

      resultado.push({
        key: `entrada-${padreId}-${primero.id}`,
        esGrupo: true,
        tipo: "entrada",
        tipoDisplay: primero.tipo_display,
        fecha: primero.fecha,
        codigoDisplay: padrePieza?.codigo ?? "—",
        materialNombre: padreMaterial?.nombre ?? padrePieza?.material_nombre ?? primero.material_nombre,
        materialCodigo: padreMaterial?.codigo ?? primero.material_codigo,
        responsableNombre: primero.responsable_nombre,
        referencia: primero.referencia_externa,
        observaciones: "",
        extraTexto: `${movs.length} pza(s) devueltas`,
        hijas: movs,
      });
    });

    // 3) Todo lo demás, sin agrupar
    filtrados.forEach((m) => {
      if (usados.has(m.id)) return;
      resultado.push({
        key: `mov-${m.id}`,
        esGrupo: false,
        tipo: m.tipo,
        tipoDisplay: m.tipo_display,
        fecha: m.fecha,
        codigoDisplay: m.pieza_codigo
          ?? (m.cantidad_cajas
            ? `${m.cantidad_cajas} caja(s) · ${m.cantidad} u.`
            : `${m.cantidad} u.`),
        materialNombre: m.material_nombre,
        materialCodigo: m.material_codigo,
        responsableNombre: m.responsable_nombre,
        referencia: m.referencia_externa,
        observaciones: m.observaciones,
        hijas: [],
      });
    });

    return resultado.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [filtrados, piezasById, materialesById]);

  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  function toggleExpandido(key: string) {
    setExpandido((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const tipoOptions = buildFilterOptions(["salida", "entrada", "baja"], {
    salida: "Salida",
    entrada: "Entrada",
    baja: "Baja",
  });

  const activeFilters = [];
  if (values.tipo)
    activeFilters.push({ key: "tipo", label: "Tipo", value: values.tipo === "salida" ? "Salida" : values.tipo === "entrada" ? "Entrada" : "Baja", onRemove: () => setValue("tipo", "") });
  if (values.desde)
    activeFilters.push({ key: "desde", label: "Desde", value: values.desde, onRemove: () => setValue("desde", "") });
  if (values.hasta)
    activeFilters.push({ key: "hasta", label: "Hasta", value: values.hasta, onRemove: () => setValue("hasta", "") });

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Almacén / Movimientos</p>
          <h1>Movimientos de stock</h1>
          <p>Historial de salidas, entradas y bajas del almacén.</p>
        </div>
      <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleExcel}
            disabled={excelLoading}
            title="Exportar historial a Excel"
          >
            <FileXls size={16} />{excelLoading ? " Generando..." : " Exportar Excel"}
          </button>
          <Link to="/almacen/checklist" className="button button-secondary">
            Checklist del día
          </Link>
          {!esAlmacenero && (
            <Link to="/almacen/movimientos/nuevo" className="button button-primary">
              <ArrowRight size={16} /> Registrar movimiento
            </Link>
          )}
          {esAlmacenero && (
            <Link to="/almacen/movimientos/nuevo" className="button button-primary">
              <ClockCountdown size={16} /> Solicitar movimiento
            </Link>
          )}
        </div>
      </div>

      {/* Banner almacenero: aviso de flujo de aprobación */}
      {esAlmacenero && (
        <div className="alert-banner" style={{ background: "var(--accent-50, #eff6ff)", borderColor: "var(--accent-300, #93c5fd)" }}>
          <ClockCountdown size={20} style={{ color: "var(--accent-600, #2563eb)" }} />
          <div>
            <strong>Tus movimientos de salida y baja requieren aprobación</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              Al solicitar una salida o baja, quedará pendiente hasta que un administrador la apruebe.
              Las entradas se registran de forma inmediata.
            </p>
          </div>
        </div>
      )}

      {/* Alertas de piezas prestadas sin devolver */}
      {prestadasAntiguas.length > 0 && (
        <div className="alert-banner alert-banner-warning">
          <WarningCircle size={20} />
          <div>
            <strong>
              {prestadasAntiguas.length} pieza(s) prestadas de días anteriores sin devolver
            </strong>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              Revisa el checklist para registrar las devoluciones pendientes.{" "}
              <Link to="/almacen/checklist" style={{ color: "inherit", fontWeight: 700 }}>
                Ver checklist →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Panel de solicitudes de grupo pendientes para admin */}
      {esAdmin && gruposPendientes.length > 0 && (
        <div className="panel" style={{ marginBottom: "1.5rem", borderLeft: "4px solid var(--accent-600, #2563eb)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <ClockCountdown size={20} style={{ color: "var(--accent-600, #2563eb)" }} />
                Grupos de solicitud pendientes ({gruposPendientes.length})
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
                Hay {gruposPendientes.length} grupo(s) de materiales pendientes de revisión y aprobación.
              </p>
            </div>
            <Link
              to={`/almacen/movimientos/solicitudes/${gruposPendientes[0].id}`}
              className="button button-primary button-sm"
            >
              Revisar grupo #{gruposPendientes[0].id}
            </Link>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {gruposPendientes.map((g) => (
              <Link
                key={g.id}
                to={`/almacen/movimientos/solicitudes/${g.id}`}
                className="button button-secondary button-sm"
                style={{ fontSize: 12 }}
              >
                Grupo #{g.id} ({g.items.length} items) — {g.solicitado_por_nombre}
              </Link>
            ))}
          </div>
        </div>
      )}


      {/* Stats */}
      <div className="almacen-stats">
        <StatCard icon={<ArrowRight size={20} />} value={totalSalidas} label="Salidas" />
        <StatCard icon={<ArrowRight size={20} style={{ transform: "rotate(180deg)" }} />} value={totalEntradas} label="Entradas" />
        <StatCard icon={<WarningCircle size={20} />} value={totalBajas} label="Bajas" variant={totalBajas > 0 ? "error" : "default"} />
        <StatCard icon={<WarningCircle size={20} />} value={prestadas.length} label="Prestadas" sublabel="actualmente" variant={prestadasAntiguas.length > 0 ? "warning" : "default"} />
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Filtrar movimientos"
          description="Filtra por tipo, material o rango de fechas."
          searchLabel="Buscar"
          searchPlaceholder="Código de material o pieza"
          searchValue={values.material}
          onSearchChange={(v) => setValue("material", v)}
          resultCount={grupos.length}
          totalCount={movimientos.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            { key: "salida", label: "Salidas", count: totalSalidas, active: values.tipo === "salida", onSelect: () => setValue("tipo", values.tipo === "salida" ? "" : "salida") },
            { key: "entrada", label: "Entradas", count: totalEntradas, active: values.tipo === "entrada", onSelect: () => setValue("tipo", values.tipo === "entrada" ? "" : "entrada") },
            { key: "baja", label: "Bajas", count: totalBajas, active: values.tipo === "baja", onSelect: () => setValue("tipo", values.tipo === "baja" ? "" : "baja") },
          ]}
        >
          <FilterSelect
            label="Tipo"
            value={values.tipo}
            onChange={(v) => setValue("tipo", v)}
            options={tipoOptions}
            allLabel="Todos los tipos"
          />
          <FilterDate label="Desde" value={values.desde} onChange={(v) => setValue("desde", v)} />
          <FilterDate label="Hasta" value={values.hasta} onChange={(v) => setValue("hasta", v)} max={hoy} />
        </ListFilterPanel>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Pieza / Cant.</th>
                <th>Tipo</th>
                <th>Responsable</th>
                <th>Referencia</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="empty-row">Cargando movimientos…</td></tr>
              )}
              {!isLoading && grupos.length === 0 && (
                <tr><td colSpan={7} className="empty-row">No hay movimientos con esos criterios.</td></tr>
              )}
              {grupos.map((g) => {
                const abierto = expandido.has(g.key);
                return (
                  <Fragment key={g.key}>
                    <tr
                      onClick={g.esGrupo ? () => toggleExpandido(g.key) : undefined}
                      style={g.esGrupo ? { cursor: "pointer" } : undefined}
                    >
                      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {new Date(g.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td>
                        <strong style={{ fontSize: 13 }}>{g.materialNombre}</strong>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{g.materialCodigo}</div>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                        {g.codigoDisplay}
                        {g.esGrupo && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted)", fontFamily: "inherit" }}>
                            {abierto ? "▾" : "▸"} {g.extraTexto}
                          </span>
                        )}
                      </td>
                      <td><StatusBadge value={g.tipo} label={g.tipoDisplay} /></td>
                      <td style={{ fontSize: 12 }}>
                        {g.referencia ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: "var(--surface-subtle, #f3f4f6)",
                              color: "var(--foreground, #111827)",
                              border: "1px solid var(--border, #e5e7eb)",
                            }}
                          >
                            {g.referencia}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.observaciones || "—"}
                      </td>
                    </tr>
                    {g.esGrupo && abierto && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: "var(--surface-muted, #fafafa)" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 16px 14px 40px" }}>
                            {g.hijas.map((h) => (
                              <div
                                key={h.id}
                                style={{ border: "1px solid var(--border, #e2e2e2)", borderRadius: 8, padding: "6px 10px", fontSize: 12, minWidth: 140 }}
                              >
                                <strong>{h.pieza_codigo}</strong>
                                <div style={{ color: "var(--muted)" }}>{h.material_nombre}</div>
                                {h.observaciones && (
                                  <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{h.observaciones}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}