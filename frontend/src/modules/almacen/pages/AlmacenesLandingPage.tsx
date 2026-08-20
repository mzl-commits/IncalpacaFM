import {
  ClockCounterClockwise,
  FolderPlus,
  MagnifyingGlass,
  MapPin,
  Package,
  PencilSimple,
  Plus,
  Stack,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createAlmacen,
  deleteAlmacen,
  listAlmacenes,
  listMateriales,
  listPiezas,
  updateAlmacen,
} from "@/modules/almacen/catalogoRepository";
import { listMovimientos } from "@/modules/almacen/inventarioRepository";
import { useAuth } from "@/modules/accounts/AuthContext";
import type { Almacen, Material, Movimiento, PiezaBase } from "@/modules/almacen/types";

// ─── Helpers de presentación del resultado de búsqueda ─────────────────────

function StockGlobalLabel({ material, piezas }: { material: Material; piezas?: PiezaBase[] }) {
  if (!material.control_individual) {
    return <>{material.cantidad_total} en stock</>;
  }
  if (!piezas) return <>Cargando piezas…</>;
  const disponibles = piezas.filter((p) => p.estado === "Disponible").length;
  return <>{disponibles} / {piezas.length} piezas disponibles</>;
}

function UltimoMovimientoLabel({ mov }: { mov: Movimiento | null | undefined }) {
  if (mov === undefined) return <>Cargando…</>;
  if (!mov) return <>Sin movimientos registrados</>;
  const fecha = new Date(mov.fecha).toLocaleDateString("es-PE");
  if (mov.tipo === "salida") {
    return <>Salió el {fecha} — en poder de <strong>{mov.responsable_nombre}</strong></>;
  }
  if (mov.tipo === "baja") {
    return <span style={{ color: "var(--error)" }}>Dado de baja el {fecha}</span>;
  }
  return <>Ingresó el {fecha} — sigue en almacén</>;
}

/** Roles que están asignados a un único almacén y no deben ver la pantalla de selección. */
const ROLES_ALMACEN_FIJO = ["ALMACENERO", "INSPECTOR"] as const;
type RolAlmacenFijo = (typeof ROLES_ALMACEN_FIJO)[number];

function esRolAlmacenFijo(role: string | undefined): role is RolAlmacenFijo {
  return ROLES_ALMACEN_FIJO.includes(role as RolAlmacenFijo);
}

export function AlmacenesLandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Redirección temprana para ALMACENERO / INSPECTOR ──────────────────────
  // Si el rol tiene almacén fijo y ya sabemos su ID, redirigimos inmediatamente
  // antes de montar queries innecesarias.
  const rolFijo = esRolAlmacenFijo(user?.role);

  useEffect(() => {
    if (rolFijo && user?.almacenId) {
      navigate(`/almacen/${user.almacenId}`, { replace: true });
    }
  }, [rolFijo, user?.almacenId, navigate]);

  // Si tiene rol fijo y NO tiene almacén asignado (perfil mal configurado)
  if (rolFijo && !user?.almacenId) {
    return (
      <section>
        <header className="page-heading">
          <p className="breadcrumb">Almacén</p>
          <h1>Sin almacén asignado</h1>
        </header>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <WarningCircle size={40} style={{ color: "var(--warning, #f59e0b)" }} />
          <p style={{ fontSize: 15, color: "var(--muted)", maxWidth: 380 }}>
            Tu cuenta no tiene un almacén asignado. Comunícate con un{" "}
            <strong>Administrador</strong> para que configure tu perfil correctamente.
          </p>
        </div>
      </section>
    );
  }

  // Si ya sabemos que va a redirigir (tiene rol fijo + almacenId), no renderizamos
  // el contenido de administrador para evitar un flash de pantalla.
  if (rolFijo && user?.almacenId) {
    return null;
  }

  // ── Vista de Administrador / Supervisor (multi-almacén) ───────────────────
  return <AlmacenesAdminView />;
}

/** Vista completa con listado y CRUD de almacenes, solo para ADMIN/SUPERVISOR. */
function AlmacenesAdminView() {
  const { user } = useAuth();
  const puedeAdministrar = user?.role === "ADMINISTRADOR";
  const queryClient = useQueryClient();

  const { data: almacenes = [], isLoading } = useQuery({
    queryKey: ["almacenes"],
    queryFn: listAlmacenes,
  });

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Almacen | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState("");

  function resetForm() {
    setEditando(null);
    setNombre("");
    setCodigo("");
    setUbicacion("");
    setActivo(true);
    setError("");
    setMostrarForm(false);
  }

  function abrirEdicion(a: Almacen) {
    setEditando(a);
    setNombre(a.nombre);
    setCodigo(a.codigo);
    setUbicacion(a.ubicacion || "");
    setActivo(a.activo);
    setError("");
    setMostrarForm(true);
  }

  const guardarMut = useMutation({
    mutationFn: async () => {
      setError("");
      if (!nombre.trim() || !codigo.trim()) {
        throw new Error("Nombre y código son obligatorios.");
      }
      const payload = { nombre: nombre.trim(), codigo: codigo.trim(), ubicacion: ubicacion.trim(), activo };
      return editando ? updateAlmacen(editando.id, payload) : createAlmacen(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["almacenes"] });
      resetForm();
    },
    onError: (err: Error) => setError(err.message || "No se pudo guardar el almacén."),
  });

  const eliminarMut = useMutation({
    mutationFn: (id: number) => deleteAlmacen(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["almacenes"] }),
    onError: () => setError("No se puede eliminar: el almacén tiene categorías o materiales asociados."),
  });

  // ── Búsqueda global de materiales (todos los almacenes) ─────────────────
  const [busqueda, setBusqueda] = useState("");
  const [terminoDebounced, setTerminoDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTerminoDebounced(busqueda.trim()), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const busquedaActiva = terminoDebounced.length >= 3;

  const { data: resultados = [], isFetching: buscando } = useQuery({
    queryKey: ["busqueda-global-materiales", terminoDebounced],
    queryFn: () => listMateriales(undefined, { q: terminoDebounced }),
    enabled: busquedaActiva,
  });

  // Último movimiento de cada resultado — dice si sigue en almacén,
  // si fue dado de baja, o quién lo tiene prestado.
  const movimientosQueries = useQueries({
    queries: resultados.map((m) => ({
      queryKey: ["ultimo-movimiento-material", m.id],
      queryFn: async () => {
        const movs = await listMovimientos(m.almacen, { material: m.id });
        return (
          movs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0] ?? null
        );
      },
      enabled: busquedaActiva,
    })),
  });

  // Si el material tiene control individual, necesitamos sus piezas
  // para mostrar disponibles/total (en vez de cantidad_total).
  const piezasQueries = useQueries({
    queries: resultados.map((m) => ({
      queryKey: ["piezas-material", m.id],
      queryFn: () => listPiezas({ material: m.id }),
      enabled: busquedaActiva && m.control_individual,
    })),
  });

  return (
    <section>
      <header className="page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="breadcrumb">Almacén</p>
          <h1>Selecciona un almacén</h1>
          <p>Cada almacén maneja su propio catálogo, movimientos e inspecciones.</p>
        </div>
        {puedeAdministrar && (
          <button type="button" className="btn-primary" onClick={() => { resetForm(); setMostrarForm(true); }}>
            <Plus size={18} weight="bold" /> Nuevo almacén
          </button>
        )}
      </header>

      {/* ── Búsqueda global de materiales/piezas en todos los almacenes ── */}
      <div className="data-panel" style={{ marginBottom: 24 }}>
        <div className="table-toolbar">
          <strong style={{ fontSize: 15 }}>Búsqueda rápida de material</strong>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ position: "relative" }}>
            <MagnifyingGlass
              size={18}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
            />
            <input
              type="search"
              placeholder="Buscar por código, marca, código EKIPU o nombre."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: "100%", paddingLeft: 38 }}
            />
          </div>

          {busqueda.trim().length > 0 && busqueda.trim().length < 3 && (
            <p className="text-muted-sm" style={{ marginTop: 8 }}>Escribe al menos 3 caracteres para buscar.</p>
          )}

          {busquedaActiva && (
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {buscando && <p className="text-muted-sm">Buscando…</p>}
              {!buscando && resultados.length === 0 && (
                <p className="empty-row">No se encontraron materiales con ese término en ningún almacén.</p>
              )}
              {resultados.map((m, i) => (
                <Link
                  key={m.id}
                  to={`/almacen/${m.almacen}/catalogo/${m.id}`}
                  className="material-card"
                  style={{ display: "block", padding: 14, textDecoration: "none", color: "inherit" }}
                >
                  <strong style={{ fontSize: 14 }}>{m.codigo} — {m.nombre}</strong>
                  {m.codigo_quipu && (
                    <span className="text-muted-sm" style={{ marginLeft: 8 }}>QUIPU: {m.codigo_quipu}</span>
                  )}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={13} /> {m.almacen_nombre}{m.ubicacion_fisica ? ` · ${m.ubicacion_fisica}` : ""}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Stack size={13} />
                      <StockGlobalLabel material={m} piezas={piezasQueries[i]?.data} />
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <ClockCounterClockwise size={13} />
                    <UltimoMovimientoLabel mov={movimientosQueries[i]?.data} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {mostrarForm && puedeAdministrar && (
        <div style={{
          background: "var(--surface, #fff)", borderRadius: 12, border: "1px solid var(--border, #e5e7eb)",
          padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderPlus size={20} style={{ color: "var(--accent, #6366f1)" }} />
              <strong style={{ fontSize: 15 }}>{editando ? "Editar almacén" : "Nuevo almacén"}</strong>
            </div>
            <button type="button" onClick={resetForm} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)" }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
            <input
              type="text" placeholder="Nombre (ej. Almacén de Herramientas)"
              value={nombre} onChange={(e) => setNombre(e.target.value)}
              style={{ fontSize: 13 }}
            />
            <input
              type="text" placeholder="Código (ej. ALM-HERR)"
              value={codigo} onChange={(e) => setCodigo(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>
          <input
            type="text" placeholder="Ubicación (opcional)"
            value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}
            style={{ fontSize: 13, width: "100%", marginBottom: 10 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Almacén activo
          </label>

          {error && (
            <p style={{ fontSize: 12, color: "var(--error, #dc2626)", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
              <WarningCircle size={14} /> {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={resetForm} className="button button-secondary" style={{ fontSize: 13 }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => guardarMut.mutate()}
              disabled={guardarMut.isPending}
              className="button button-primary"
              style={{ fontSize: 13 }}
            >
              {guardarMut.isPending ? "Guardando…" : editando ? "Guardar cambios" : "Crear almacén"}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="loading-panel">Cargando almacenes…</div>}

      {!isLoading && almacenes.length === 0 && (
        <div className="empty-row">
          <WarningCircle size={18} /> No hay almacenes registrados todavía.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {almacenes.map((a) => (
          <div key={a.id} className="material-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, position: "relative", opacity: a.activo ? 1 : 0.6 }}>
            {puedeAdministrar && (
              <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); abrirEdicion(a); }}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 4 }}
                  title="Editar almacén"
                >
                  <PencilSimple size={15} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm(`¿Eliminar el almacén "${a.nombre}"? Esta acción no se puede deshacer.`)) {
                      eliminarMut.mutate(a.id);
                    }
                  }}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--error, #dc2626)", padding: 4 }}
                  title="Eliminar almacén"
                >
                  <Trash size={15} />
                </button>
              </div>
            )}
            <Link to={`/almacen/${a.id}/catalogo`} style={{ display: "flex", flexDirection: "column", gap: 8, textDecoration: "none", color: "inherit" }}>
              <Package size={28} style={{ color: "var(--accent, #6366f1)" }} />
              <strong style={{ fontSize: 16 }}>{a.nombre}</strong>
              <code style={{ fontSize: 12, color: "var(--muted)" }}>{a.codigo}</code>
              {a.ubicacion && <span style={{ fontSize: 12, color: "var(--muted)" }}>{a.ubicacion}</span>}
              {!a.activo && <span style={{ fontSize: 11, color: "var(--error, #dc2626)" }}>Inactivo</span>}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
