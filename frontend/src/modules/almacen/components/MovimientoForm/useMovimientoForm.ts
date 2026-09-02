  const qc = useQueryClient();
  const { user } = useAuth();
  const esAlmacenero = user?.role === "ALMACENERO";
  const { almacenId } = useAlmacenActivo();
  const [params] = useSearchParams();
  const preselMaterial = params.get("material") ? Number(params.get("material")) : 0;
  const preselTipo = (params.get("tipo") as TipoMovimiento) || "salida";
  const preselOt = params.get("ot") || "";

  const [tipo, setTipo] = useState<TipoMovimiento>(preselTipo);

  // ── Estado exclusivo de Baja (single-material, sin cambios de lógica) ────
  const [materialId, setMaterialId] = useState<number>(preselMaterial);
  const [piezaId, setPiezaId] = useState<number>(0);
  const [cantidad, setCantidad] = useState(1);
  const [cantidadCajas, setCantidadCajas] = useState(1);
  const [unidadMovimientoId, setUnidadMovimientoId] = useState<number | null>(null);
  const [cantidadEnUnidadMovimiento, setCantidadEnUnidadMovimiento] = useState("");

  // ── Estado común ──────────────────────────────────────────────────────
  const [responsableId, setResponsableId] = useState<number>(0);
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [avisoEstuche, setAvisoEstuche] = useState<{ aviso: string; excluidas: number[] } | null>(null);
  const [exito, setExito] = useState(false);
  const [exitoPendiente, setExitoPendiente] = useState<string | null>(null);

  // ── Renglones unificados de Entrada / Salida (Objetivo: mezclar
  // consumibles y piezas retornables) ──────────────────────────────────────
  const [renglones, setRenglones] = useState<RenglonMovimiento[]>([renglonVacio(preselMaterial)]);

  // Orden de Trabajo seleccionada (id como string, UUID) para vincular la salida.
  const [workOrderSelected, setWorkOrderSelected] = useState<string>(preselOt);
  const [cargandoMaterialesOT, setCargandoMaterialesOT] = useState(false);

  // Resultado del lote (tabla ✓/✗ por renglón/pieza).
  const [resultadosAdmin, setResultadosAdmin] = useState<ResultadoLoteAdmin[] | null>(null);

  const [sinOT, setSinOT] = useState(false);

  function agregarRenglon() {
    setRenglones((prev) => [...prev, renglonVacio()]);
  }

  async function handleCargarMaterialesOT(otId: string) {
    if (!otId) return;
    setCargandoMaterialesOT(true);
    setError("");
    try {
      const mats = await listWorkOrderMateriales(otId);
      if (mats.length === 0) {
        setError("Esta Orden de Trabajo no tiene materiales planificados todavía.");
        return;
      }
      // Auto-set responsable if matching technician name
      const otObj = otsActivas.find((o) => o.id === otId);
      if (otObj?.technician_name && usuarios.length > 0) {
        const matchingUser = usuarios.find((u: any) => {
          const fullName = (u.full_name || u.nombre || `${u.first_name || ""} ${u.last_name || ""}`).toLowerCase();
          return fullName.includes(otObj.technician_name.toLowerCase()) || otObj.technician_name.toLowerCase().includes(fullName);
        });
        if (matchingUser) setResponsableId(matchingUser.id);
      }

      // Convert mats to renglones — solo lo que aún falta por despachar
      const nuevosRenglones: RenglonMovimiento[] = mats
        .filter((m) => (m.cantidadPendiente ?? m.cantidad) > 0)
        .map((m) => {
          const matObj = materiales.find((cat) => cat.id === m.material);
          const cantidadAUsar = m.cantidadPendiente ?? m.cantidad;   // ← fix
          return {
            id: generarUUID().slice(0, 8),
            materialId: m.material,
            cantidad: cantidadAUsar,
            cantidadCajas: matObj?.unidad_manejo_requiere_multiplicador ? Math.ceil(cantidadAUsar / (matObj.unidades_por_caja || 1)) : 1,
            unidadMovimientoId: null,
            cantidadEnUnidadMovimiento: "",
            modoPieza: "sueltas",
            piezasSeleccionadas: new Set(),
            estuchePiezaId: 0,
            estucheTodasHijas: true,
            estucheHijasSeleccionadas: new Set(),
          };
        });
      if (nuevosRenglones.length === 0) {
        setError("No hay materiales pendientes por despachar en esta OT — todo ya fue solicitado o entregado.");
        return;
      }
      setRenglones(nuevosRenglones);
    } catch {
      setError("No se pudieron cargar los materiales de la OT.");
    } finally {
      setCargandoMaterialesOT(false);
    }
  }

  function quitarRenglon(id: string) {
    setRenglones((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function actualizarRenglon(id: string, patch: Partial<RenglonMovimiento>) {
    setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function resetRenglonSelector(id: string) {
    actualizarRenglon(id, {
      cantidad: 1,
      cantidadCajas: 1,
      unidadMovimientoId: null,
      cantidadEnUnidadMovimiento: "",
      modoPieza: "sueltas",
      piezasSeleccionadas: new Set(),
      estuchePiezaId: 0,
      estucheTodasHijas: true,
      estucheHijasSeleccionadas: new Set(),
    });
  }

  const tipoId = useId();

  const { data: materiales = [], isSuccess: materialesListos } = useQuery({
    queryKey: ["materiales", almacenId],
    queryFn: () => listMateriales(almacenId),
    enabled: !!almacenId,
  });
  const { data: usuarios = [], isSuccess: usuariosListos } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsuarios,
  });

  const { data: otsActivas = [], isSuccess: otsActivasListas } = useQuery<WorkOrderActiva[]>({
    queryKey: ["ots-activas"],
    queryFn: listOrdenesTrabajoActivas,
    enabled: tipo === "salida",
  });

  // Auto-carga de materiales cuando se llega con ?ot=<id> preseleccionada
  // (ej. desde el dashboard). Espera a que materiales/usuarios/otsActivas ya
  // tengan datos (son fetches async) para no operar sobre arrays vacíos, y
  // solo dispara una vez con un ref (si no, cada refetch de esas queries
  // volvería a disparar la carga y pisaría lo que el usuario ya editó).
  const preselOtCargadaRef = useRef(false);
  useEffect(() => {
    if (preselOtCargadaRef.current) return;
    if (!preselOt || tipo !== "salida") return;
    if (!materialesListos || !usuariosListos || !otsActivasListas) return;
    preselOtCargadaRef.current = true;
    void handleCargarMaterialesOT(preselOt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselOt, tipo, materialesListos, usuariosListos, otsActivasListas]);

  const { data: unidadesMedida = [] } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: listUnidadesMedida,
  });

  // ── Solo para Baja ────────────────────────────────────────────────────
  const material = materiales.find((m) => m.id === materialId);
  const unidadBase = unidadesMedida.find((u) => u.id === material?.unidad_movimiento_base);
  const unidadesCompatibles = unidadesCompatiblesDe(material, unidadesMedida);

  useEffect(() => {
    if (tipo !== "baja") return;
    if (material?.unidad_manejo_permite_conversion_unidad && unidadBase) {
      setUnidadMovimientoId((prev) => (prev && unidadesCompatibles.some((u) => u.id === prev) ? prev : unidadBase.id));
    } else {
      setUnidadMovimientoId(null);
      setCantidadEnUnidadMovimiento("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, materialId, unidadBase?.id]);

  const { data: piezasBaja = [] } = useQuery({
    queryKey: ["piezas-baja", materialId],
    queryFn: () => listPiezas({ material: materialId }),
    enabled: !!materialId && !!material?.control_individual && tipo === "baja",
  });
  const piezaBaja = piezasBaja.find((p) => p.id === piezaId);

  const mut = useMutation({
    mutationFn: async () => {
      // ═══════════════ BAJA (sin cambios: un material a la vez) ═══════════
      if (tipo === "baja") {
        if (!materialId) throw new Error("Selecciona un material.");
        if (!responsableId) throw new Error("Selecciona un responsable.");

        if (material?.control_individual) {
          if (!piezaId) throw new Error("Selecciona una pieza.");
          return registrarBajaPieza({ pieza_id: piezaId, responsable_id: responsableId, observaciones });
        }
        const esPorEmpaque = !!material?.unidad_manejo_requiere_multiplicador;
        const esPorConversion = !!material?.unidad_manejo_permite_conversion_unidad;
        const cantidadPayload = esPorEmpaque || esPorConversion ? undefined : cantidad;
        const cantidadCajasPayload = esPorEmpaque ? cantidadCajas : undefined;
        const conversionPayload = esPorConversion
          ? {
              unidad_movimiento_id: unidadMovimientoId ?? undefined,
              cantidad_en_unidad_movimiento: cantidadEnUnidadMovimiento ? Number(cantidadEnUnidadMovimiento) : undefined,
            }
          : {};
        if (esPorConversion && (!unidadMovimientoId || !cantidadEnUnidadMovimiento)) {
          throw new Error(`Indica la cantidad y la unidad (${unidadBase?.nombre ?? "unidad base"} u otra compatible).`);
        }
        return registrarBajaMaterial({
          material_id: materialId,
          cantidad: cantidadPayload,
          cantidad_cajas: cantidadCajasPayload,
          responsable_id: responsableId,
          observaciones,
          ...conversionPayload,
        });
      }

      // ═══════ ENTRADA / SALIDA — lista unificada (consumibles + piezas) ═══
      if (!responsableId) throw new Error("Selecciona un responsable.");
      const renglonesValidos = renglones.filter((r) => r.materialId > 0);
      if (renglonesValidos.length === 0) throw new Error("Agrega al menos un material a la lista.");

      const consumibleRenglones = renglonesValidos.filter((r) => {
        const m = materiales.find((mm) => mm.id === r.materialId);
        return m && !m.control_individual;
      });
      const piezaRenglones = renglonesValidos.filter((r) => {
        const m = materiales.find((mm) => mm.id === r.materialId);
        return m && m.control_individual;
      });

      for (const r of piezaRenglones) {
        const m = materiales.find((mm) => mm.id === r.materialId)!;
        if (tipo === "entrada") {
          if (r.piezasSeleccionadas.size === 0) {
            throw new Error(`Selecciona al menos una pieza a devolver de "${m.nombre}".`);
          }
        } else {
          const tieneSueltas = r.piezasSeleccionadas.size > 0;
          const tieneEstuche = r.modoPieza === "estuche" && r.estuchePiezaId > 0;
          if (!tieneSueltas && !tieneEstuche) {
            throw new Error(`Selecciona pieza(s) o un estuche de "${m.nombre}".`);
          }
        }
      }

      // ── ENTRADA: siempre directa, sin flujo de aprobación ──────────────
      if (tipo === "entrada") {
        const resultados: ResultadoLoteAdmin[] = [];
        for (const r of consumibleRenglones) {
          const m = materiales.find((mm) => mm.id === r.materialId)!;
          const esEmp = !!m.unidad_manejo_requiere_multiplicador;
          const esConv = !!m.unidad_manejo_permite_conversion_unidad;
          try {
            await registrarEntradaMaterial({
              material_id: r.materialId,
              cantidad: esEmp || esConv ? undefined : r.cantidad,
              cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
              unidad_movimiento_id: esConv ? r.unidadMovimientoId ?? undefined : undefined,
              cantidad_en_unidad_movimiento:
                esConv && r.cantidadEnUnidadMovimiento ? Number(r.cantidadEnUnidadMovimiento) : undefined,
              responsable_id: responsableId,
              observaciones,
            });
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: true });
          } catch (err: any) {
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: false, error: mensajeError(err) });
          }
        }
        for (const r of piezaRenglones) {
          const m = materiales.find((mm) => mm.id === r.materialId)!;
          for (const piezaIdSel of r.piezasSeleccionadas) {
            try {
              await registrarEntradaPieza({ pieza_id: piezaIdSel, responsable_id: responsableId, observaciones });
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: true });
            } catch (err: any) {
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: false, error: mensajeError(err) });
            }
          }
        }
        setResultadosAdmin(resultados);
        return resultados.every((r) => r.ok) ? { batchCompleto: true } : { batchParcial: true };
      }

      // ── SALIDA ──────────────────────────────────────────────────────────
      const referenciaFinal = workOrderSelected
        ? (otsActivas.find((o) => o.id === workOrderSelected)?.code ?? referencia)
        : referencia;

      if (esAlmacenero) {
        // FIX (piezas retornables no aparecían en Solicitudes/Movimientos):
        // antes las piezas con control individual (martillo, etc.) salían
        // directo con registrarSalidaPieza, sin pasar por aprobación ni
        // quedar visibles en ningún listado para el admin. Ahora TODO lo
        // que arma el almacenero — consumibles y piezas — va al mismo
        // GrupoSolicitud, y el admin las aprueba/rechaza desde la misma
        // pantalla de Solicitudes.
        const itemsMateriales: GrupoSolicitudItemInput[] = consumibleRenglones.map((r) => {
          const m = materiales.find((mm) => mm.id === r.materialId)!;
          const esEmp = !!m.unidad_manejo_requiere_multiplicador;
          return {
            tipo: "salida_material",
            material: r.materialId,
            cantidad: esEmp ? undefined : r.cantidad,
            cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
          };
        });

        const itemsPiezas: GrupoSolicitudItemInput[] = [];
        for (const r of piezaRenglones) {
          if (r.piezasSeleccionadas.size > 0) {
            for (const piezaIdSel of r.piezasSeleccionadas) {
              itemsPiezas.push({ tipo: "salida_pieza", pieza: piezaIdSel });
            }
          } else if (r.estuchePiezaId > 0) {
            itemsPiezas.push({
              tipo: "salida_pieza",
              pieza: r.estuchePiezaId,
              piezas_hijas_ids: r.estucheTodasHijas ? undefined : Array.from(r.estucheHijasSeleccionadas),
            });
          }
        }

        const items = [...itemsMateriales, ...itemsPiezas];
        if (items.length === 0) {
          throw new Error("Agrega al menos un material a la lista.");
        }

        await crearGrupoSolicitud({
          work_order: workOrderSelected || null,
          observaciones,
          items,
        });

        return {
          solicitud_grupo_id: true,
          mensaje: "Solicitud enviada para aprobación (materiales y piezas incluidos).",
        };
      }

      // ADMIN: todo directo, mismo lote_id.
      const loteId = generarUUID().slice(0, 12);
      const resultados: ResultadoLoteAdmin[] = [];
      for (const r of consumibleRenglones) {
        const m = materiales.find((mm) => mm.id === r.materialId)!;
        const esEmp = !!m.unidad_manejo_requiere_multiplicador;
        const esConv = !!m.unidad_manejo_permite_conversion_unidad;
        try {
          await registrarSalidaMaterial({
            material_id: r.materialId,
            cantidad: esEmp || esConv ? undefined : r.cantidad,
            cantidad_cajas: esEmp ? r.cantidadCajas : undefined,
            unidad_movimiento_id: esConv ? r.unidadMovimientoId ?? undefined : undefined,
            cantidad_en_unidad_movimiento:
              esConv && r.cantidadEnUnidadMovimiento ? Number(r.cantidadEnUnidadMovimiento) : undefined,
            responsable_id: responsableId,
            referencia_externa: referenciaFinal,
            observaciones,
            lote_id: loteId,
          });
          resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: true });
        } catch (err: any) {
          resultados.push({ materialNombre: `${m.codigo} — ${m.nombre}`, ok: false, error: mensajeError(err) });
        }
      }
      for (const r of piezaRenglones) {
        const m = materiales.find((mm) => mm.id === r.materialId)!;
        if (r.piezasSeleccionadas.size > 0) {
          for (const piezaIdSel of r.piezasSeleccionadas) {
            try {
              await registrarSalidaPieza({ pieza_id: piezaIdSel, responsable_id: responsableId, referencia_externa: referenciaFinal, observaciones });
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: true });
            } catch (err: any) {
              resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (pieza)`, ok: false, error: mensajeError(err) });
            }
          }
        } else if (r.estuchePiezaId > 0) {
          try {
            const resp = await registrarSalidaPieza({
              pieza_id: r.estuchePiezaId,
              responsable_id: responsableId,
              referencia_externa: referenciaFinal,
              observaciones,
              piezas_hijas_ids: r.estucheTodasHijas ? undefined : Array.from(r.estucheHijasSeleccionadas),
            });
            const nota = resp.aviso ? ` — ⚠ ${resp.aviso}` : "";
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (estuche)${nota}`, ok: true });
          } catch (err: any) {
            resultados.push({ materialNombre: `${m.codigo} — ${m.nombre} (estuche)`, ok: false, error: mensajeError(err) });
          }
        }
      }
      setResultadosAdmin(resultados);
      return resultados.every((r) => r.ok) ? { batchCompleto: true } : { batchParcial: true };
    },
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
      qc.invalidateQueries({ queryKey: ["grupos-solicitud"] });
      qc.invalidateQueries({ queryKey: ["materiales"] });
      qc.invalidateQueries({ queryKey: ["checklist-prestados"] });
      qc.invalidateQueries({ queryKey: ["piezas-renglon-disponible"] });
      qc.invalidateQueries({ queryKey: ["piezas-renglon-prestado"] });
      qc.invalidateQueries({ queryKey: ["piezas-baja", materialId] });

      if (resp && typeof resp === "object" && ("batchCompleto" in resp || "batchParcial" in resp)) {
        if ("batchCompleto" in resp) {
          setExito(true);
        }
        return;
      }

      if (resp && typeof resp === "object" && "solicitud_grupo_id" in resp) {
        setExitoPendiente(resp.mensaje);
        return;
      }
      if (resp && typeof resp === "object" && !Array.isArray(resp) && "aviso" in resp) {
        const r = resp as { aviso?: string; hijas_excluidas?: number[] };
        if (r.aviso) {
          setAvisoEstuche({ aviso: r.aviso, excluidas: r.hijas_excluidas ?? [] });
          return;
        }
      }
      setExito(true);
    },
    onError: (e: any) => {
      setError(mensajeError(e));
    },
  });

  if (exitoPendiente) {
    return (
      <section className="success-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Clock size={22} color="var(--accent-600, #2563eb)" weight="bold" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--accent-600, #2563eb)" }}>
            Solicitud enviada — pendiente de aprobación
          </h2>
        </div>
        <p style={{ maxWidth: 440, textAlign: "center", color: "var(--neutral-600)", marginTop: 8 }}>{exitoPendiente}</p>
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/${almacenId}/movimientos/solicitudes`}>
            Ver solicitudes pendientes
          </Link>
          <Link className="button button-secondary" to={`/almacen/${almacenId}/movimientos`}>
            Ver historial
          </Link>
          <button
            className="button button-secondary"
            onClick={() => {
              setExito(false);
              setExitoPendiente(null);
              setAvisoEstuche(null);
              setPiezaId(0);
              setCantidad(1);
              setRenglones([renglonVacio()]);
              setResultadosAdmin(null);
              setObservaciones("");
              setReferencia("");
              setWorkOrderSelected("");
              setSinOT(false);
            }}
          >
            Registrar otro
          </button>
        </div>
      </section>
    );
  }

  if (exito || avisoEstuche) {
    return (
      <section className="success-panel">
        <h2>
          {tipo === "salida"
            ? "✓ Salida registrada con éxito"
            : tipo === "entrada"
            ? "✓ Entrada registrada con éxito"
            : "✓ Baja registrada con éxito"}
        </h2>
        {avisoEstuche && (
          <div className="aviso-estuche" style={{ maxWidth: 480, margin: "0 auto 20px", textAlign: "left" }}>
            <strong>⚠ Estuche incompleto</strong>
            {avisoEstuche.aviso}
            <p style={{ fontSize: 12, marginTop: 8 }}>
              {avisoEstuche.excluidas.length} pieza(s) no salieron por no estar disponibles.
            </p>
          </div>
        )}
        <div className="success-actions">
          <Link className="button button-primary" to={`/almacen/${almacenId}/movimientos`}>
            Ver historial
          </Link>
          {materialId > 0 && (
            <Link className="button button-secondary" to={`/almacen/${almacenId}/catalogo/${materialId}`}>
              Ver material
            </Link>
          )}
          <button
            className="button button-secondary"
            onClick={() => {
              setExito(false);
              setAvisoEstuche(null);
              setPiezaId(0);
              setCantidad(1);
              setRenglones([renglonVacio()]);
              setResultadosAdmin(null);
              setObservaciones("");
              setReferencia("");
              setWorkOrderSelected("");
              setSinOT(false);
            }}
          >
            Registrar otro
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="wizard-heading">
        <Link to={`/almacen/${almacenId}/movimientos`} className="back-link">
          <ArrowLeft size={16} /> Movimientos
        </Link>
        <div>
          <p className="breadcrumb">Almacén / Movimientos / Nuevo</p>
          <h1>Registrar movimiento</h1>
        </div>
      </div>

      <form
        className="wizard-layout"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setResultadosAdmin(null);
          mut.mutate();
        }}
        noValidate
      >
        <div style={{ display: "grid", gap: 20 }}>
          {/* Tipo de movimiento */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Tipo</span>
              <h2>¿Qué deseas registrar?</h2>
            </div>
            <div className="segmented-control segmented-3" role="group" aria-labelledby={tipoId}>
              {(["salida", "entrada", "baja"] as TipoMovimiento[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={tipo === t ? "is-active" : ""}
                  onClick={() => {
                    setTipo(t);
                    setPiezaId(0);
                    setRenglones([renglonVacio()]);
                    setResultadosAdmin(null);
                    setSinOT(false);
                    setWorkOrderSelected("");
                    setReferencia("");
                  }}
                >
                  {t === "salida" ? "Salida" : t === "entrada" ? "Entrada / Devolución" : "Baja"}
                </button>
              ))}
            </div>
          </div>

          {/* Material / Renglones */}
          <div className="form-panel">
            <div className="form-section-heading">
              <span>Paso 1</span>
              <h2>Materiales</h2>
            </div>

            {tipo === "baja" ? (
              /* ══════════════ BAJA: un solo material a la vez ══════════════ */
              <div className="form-grid">
                <Field label="Material" required>
                  <Combobox
                    value={materialId}
                    selectedLabel={material ? `${material.codigo} — ${material.nombre}` : ""}
                    placeholder="Buscar por código o nombre…"
                    onChange={(id) => {
                      setMaterialId(id);
                      setPiezaId(0);
                    }}
                    fetchOptions={async (q) => {
                      const res = await listMateriales(almacenId, { q });
                      return res.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }));
                    }}
                  />
                </Field>

                {material?.control_individual ? (
                  <Field label="Pieza" required>
                    <Combobox
                      value={piezaId}
                      selectedLabel={
                        piezaBaja
                          ? `${piezaBaja.codigo} — ${piezaBaja.material_nombre}${
                              piezaBaja.material_medida ? ` (${piezaBaja.material_medida})` : ""
                            } · ${piezaBaja.estado}${piezaBaja.tiene_hijas ? " [estuche]" : ""}`
                          : ""
                      }
                      placeholder="Buscar por código…"
                      onChange={(id) => setPiezaId(id)}
                      fetchOptions={async (q) => {
                        const res = await listPiezas({ material: materialId, q });
                        return res.map((p) => ({
                          id: p.id,
                          label: `${p.codigo} — ${p.material_nombre}${
                            p.material_medida ? ` (${p.material_medida})` : ""
                          } · ${p.estado}${p.tiene_hijas ? " [estuche]" : ""}`,
                        }));
                      }}
                    />
                  </Field>
                ) : material ? (
                  material.unidad_manejo_requiere_multiplicador ? (
                    <Field
                      label={`Cantidad de ${material.unidad_manejo_nombre ?? "empaque"}`}
                      required
                      hint={`Cada ${material.unidad_manejo_nombre ?? "empaque"} trae ${material.unidades_por_caja ?? "?"} unidades · Total: ${
                        cantidadCajas * (material.unidades_por_caja ?? 0)
                      } unidades`}
                    >
                      <input
