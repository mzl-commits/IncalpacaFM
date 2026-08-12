import {
  Buildings,
  CheckCircle,
  FileImage,
  MagnifyingGlass,
  MapPin,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  useLocationMapImage,
  useLocations,
  useRemoveLocationMap,
  useUpdateLocationArea,
  useUpdateBuildingArea,
  useUploadLocationMap,
} from "../locationMapQueries";

type MapFilter = "ALL" | "WITH_MAP" | "WITHOUT_MAP";

export function LocationMapAdminPage() {
  const locationsQuery = useLocations();
  const uploadMutation = useUploadLocationMap();
  const removeMutation = useRemoveLocationMap();
  const updateAreaMutation = useUpdateLocationArea();
  const updateBuildingAreaMutation = useUpdateBuildingArea();
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MapFilter>("ALL");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [squareMeters, setSquareMeters] = useState("");
  const [buildingSquareMeters, setBuildingSquareMeters] = useState("");

  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const selected = locations.find((item) => item.id === selectedId) ?? locations[0] ?? null;
  const imageQuery = useLocationMapImage(selected?.activeMap?.id);

  useEffect(() => {
    if (!selectedId && locations.length) setSelectedId(locations[0].id);
  }, [locations, selectedId]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    setSquareMeters(selected?.squareMeters == null ? "" : String(selected.squareMeters));
  }, [selected?.id, selected?.squareMeters]);

  useEffect(() => {
    setBuildingSquareMeters(selected?.buildingSquareMeters == null ? "" : String(selected.buildingSquareMeters));
  }, [selected?.building, selected?.buildingSquareMeters, selected?.zone]);

  const filteredLocations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-PE");
    return locations.filter((item) => {
      const matchesQuery = !normalized || item.displayName.toLocaleLowerCase("es-PE").includes(normalized);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "WITH_MAP" && item.activeMap) ||
        (filter === "WITHOUT_MAP" && !item.activeMap);
      return matchesQuery && matchesFilter;
    });
  }, [filter, locations, query]);

  const mappedCount = locations.filter((item) => item.activeMap).length;

  function selectLocation(id: string) {
    setSelectedId(id);
    setFile(null);
    setDescription("");
    setMessage("");
    setConfirmRemoval(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : "");
    setMessage("");
    setMessageTone("success");
    event.target.value = "";
  }

  async function upload() {
    if (!selected || !file) return;
    setMessage("");
    try {
      const result = await uploadMutation.mutateAsync({
        locationId: selected.id,
        image: file,
        description,
      });
      setFile(null);
      setDescription("");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setMessage(`Imagen v${result.version} publicada para este ambiente.`);
      setMessageTone("success");
    } catch {
      setMessage("No se pudo publicar la imagen. Verifica el formato, tamaño y dimensiones.");
      setMessageTone("error");
    }
  }

  async function removeActiveMap() {
    if (!selected?.activeMap) return;
    setMessage("");
    try {
      await removeMutation.mutateAsync(selected.activeMap.id);
      setConfirmRemoval(false);
      setMessage("La imagen dejó de estar disponible para nuevas ubicaciones. El historial se conservó.");
      setMessageTone("success");
    } catch {
      setMessage("No se pudo retirar la imagen. Inténtalo nuevamente.");
      setMessageTone("error");
    }
  }

  async function saveArea() {
    if (!selected) return;
    const normalized = squareMeters.trim().replace(",", ".");
    const value = normalized === "" ? null : Number(normalized);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setMessage("Ingresa un tamaño mayor a 0 m² o deja el campo vacío para quitarlo.");
      setMessageTone("error");
      return;
    }
    setMessage("");
    try {
      await updateAreaMutation.mutateAsync({ locationId: selected.id, squareMeters: value });
      setMessage(value === null ? "Se quitó el tamaño registrado del ambiente." : "Tamaño del ambiente actualizado.");
      setMessageTone("success");
    } catch {
      setMessage("No se pudo actualizar el tamaño. Usa hasta dos decimales.");
      setMessageTone("error");
    }
  }

  async function saveBuildingArea() {
    if (!selected) return;
    const normalized = buildingSquareMeters.trim().replace(",", ".");
    const value = normalized === "" ? null : Number(normalized);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setMessage("Ingresa un tamaño de edificio mayor a 0 m² o deja el campo vacío para quitarlo.");
      setMessageTone("error");
      return;
    }
    setMessage("");
    try {
      await updateBuildingAreaMutation.mutateAsync({ locationId: selected.id, squareMeters: value });
      setMessage(value === null ? "Se quitó el tamaño registrado del edificio." : "Tamaño del edificio actualizado.");
      setMessageTone("success");
    } catch {
      setMessage("No se pudo actualizar el tamaño del edificio. Usa hasta dos decimales.");
      setMessageTone("error");
    }
  }

  return (
    <section className="location-map-admin-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Ubicaciones / Mapas referenciales</p>
          <h1>Mapas de ambientes</h1>
          <p>Asocia una fotografía o plano simple a cada ambiente para ubicar bienes visualmente durante su registro.</p>
        </div>
      </div>

      <div className="location-map-principle" role="note">
        <MapPin weight="duotone" />
        <p><strong>La imagen orienta; no reemplaza la ubicación maestra.</strong><span>La zona, edificio, área y ambiente siguen siendo el dato oficial. El marcador añade una referencia visual.</span></p>
      </div>

      <dl className="location-map-admin-summary">
        <div><dt>Ambientes activos</dt><dd>{locations.length}</dd></div>
        <div><dt>Con imagen</dt><dd>{mappedCount}</dd></div>
        <div><dt>Pendientes</dt><dd>{locations.length - mappedCount}</dd></div>
      </dl>

      <div className="location-map-admin-layout">
        <aside className="location-map-catalog" aria-label="Catálogo de ambientes">
          <div className="location-map-catalog-filters">
            <label><MagnifyingGlass /><span className="sr-only">Buscar ambiente</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar zona o ambiente" /></label>
            <select value={filter} onChange={(event) => setFilter(event.target.value as MapFilter)} aria-label="Filtrar ambientes">
              <option value="ALL">Todos</option>
              <option value="WITH_MAP">Con imagen</option>
              <option value="WITHOUT_MAP">Sin imagen</option>
            </select>
          </div>
          {locationsQuery.isPending ? <div className="location-map-list-skeleton" aria-label="Cargando ambientes" />
          : locationsQuery.isError ? <div className="location-map-list-empty" role="alert"><WarningCircle /><span>No se pudo cargar el catálogo.</span></div>
          : filteredLocations.length ? <div className="location-map-location-list">{filteredLocations.map((item) => (
            <button type="button" className={item.id === selected?.id ? "is-selected" : ""} onClick={() => selectLocation(item.id)} key={item.id}>
              <Buildings weight="duotone" />
              <span><strong>{item.locationCode ? `${item.locationCode} · ` : ""}{item.room}</strong><small>{item.zone} · {item.building}<br />{item.area}{item.requiresReview ? " · Requiere revisión" : ""}</small></span>
              {item.activeMap ? <CheckCircle className="has-map" weight="fill" aria-label="Con imagen" /> : <i aria-label="Sin imagen" />}
            </button>
          ))}</div>
          : <div className="location-map-list-empty"><MagnifyingGlass /><span>No hay ambientes con estos filtros.</span></div>}
        </aside>

        <main className="location-map-editor">
          {!selected ? <div className="location-map-editor-empty"><Buildings /><strong>Selecciona un ambiente</strong><span>Podrás cargar su referencia visual.</span></div> : <>
            <header>
              <div><span>{selected.zone} / {selected.building} / {selected.area}</span><h2>{selected.locationCode ? `${selected.locationCode} · ` : ""}{selected.room}</h2>{selected.requiresReview && <p>{selected.reviewNotes}</p>}</div>
              {selected.activeMap && <span className="status status-success">Imagen v{selected.activeMap.version}</span>}
            </header>

            <section className="location-map-area-panel" aria-labelledby="location-area-title">
              <div><h3 id="location-area-title">Tamaño del ambiente</h3><p>Registra los metros cuadrados para calcular densidad, aforo y capacidad operativa.</p></div>
              <div className="location-map-area-control">
                <label><span className="sr-only">Metros cuadrados</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={squareMeters} onChange={(event) => setSquareMeters(event.target.value)} placeholder="Ej. 45.50" /><b>m²</b></label>
                <button className="button button-secondary" type="button" disabled={updateAreaMutation.isPending} onClick={() => void saveArea()}>{updateAreaMutation.isPending ? "Guardando…" : "Guardar tamaño"}</button>
              </div>
            </section>

            <section className="location-map-area-panel location-map-building-area-panel" aria-labelledby="building-area-title">
              <div><h3 id="building-area-title">Tamaño del edificio</h3><p>Este valor es compartido por todos los ambientes de <strong>{selected.building}</strong>. No modifica los m² propios de cada ambiente.</p></div>
              <div className="location-map-area-control">
                <label><span className="sr-only">Metros cuadrados del edificio</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={buildingSquareMeters} onChange={(event) => setBuildingSquareMeters(event.target.value)} placeholder="Ej. 1,250.00" /><b>m²</b></label>
                <button className="button button-secondary" type="button" disabled={updateBuildingAreaMutation.isPending} onClick={() => void saveBuildingArea()}>{updateBuildingAreaMutation.isPending ? "Guardando…" : "Guardar edificio"}</button>
              </div>
            </section>

            <div className="location-map-preview">
              {previewUrl ? <img src={previewUrl} alt="Vista previa de la nueva imagen" />
              : imageQuery.data ? <img src={imageQuery.data} alt={`Imagen referencial de ${selected.room}`} />
              : imageQuery.isPending && selected.activeMap ? <div className="location-map-skeleton" />
              : <div className="location-map-preview-empty"><FileImage weight="duotone" /><strong>Sin imagen referencial</strong><span>Sube una fotografía frontal o un plano simple y legible del ambiente.</span></div>}
            </div>

            <section className="location-map-upload-panel">
              <div><h3>{selected.activeMap ? "Publicar una nueva versión" : "Agregar imagen del ambiente"}</h3><p>JPG, PNG o WEBP · máximo 10 MB · mínimo 320 × 320 px.</p></div>
              <label className="button button-secondary"><UploadSimple /> Seleccionar imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} /></label>
              {file && <div className="location-map-file"><FileImage /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span></div>}
              <label className="location-map-description"><span>Descripción opcional</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Vista actualizada del almacén, ingreso por puerta norte" /></label>
              {selected.activeMap && <p className="location-map-version-note"><WarningCircle />Los bienes ya registrados conservarán la versión anterior y su marcador. Los nuevos usarán esta imagen.</p>}
              {confirmRemoval && selected.activeMap && <div className="location-map-remove-confirm" role="alert">
                <div><WarningCircle /><p><strong>¿Retirar esta imagen del ambiente?</strong><span>Dejará de aparecer en nuevos registros. Los bienes históricos conservarán su marcador.</span></p></div>
                <div><button className="button button-secondary" type="button" onClick={() => setConfirmRemoval(false)}>Cancelar</button><button className="button button-danger" type="button" disabled={removeMutation.isPending} onClick={removeActiveMap}>{removeMutation.isPending ? "Retirando…" : "Sí, retirar imagen"}</button></div>
              </div>}
              {message && <p className={messageTone === "error" ? "location-map-message is-error" : "location-map-message"} role="status">{messageTone === "error" ? <WarningCircle /> : <CheckCircle weight="fill" />}{message}</p>}
              <div className="location-map-actions">
                {selected.activeMap && !confirmRemoval && <button className="button button-secondary location-map-remove" type="button" onClick={() => setConfirmRemoval(true)}><Trash /> Retirar imagen actual</button>}
                <button className="button button-primary" type="button" disabled={!file || uploadMutation.isPending} onClick={upload}>{uploadMutation.isPending ? "Publicando…" : "Publicar imagen"}</button>
              </div>
            </section>
          </>}
        </main>
      </div>
    </section>
  );
}
