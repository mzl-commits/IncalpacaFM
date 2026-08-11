import { useQuery } from "@tanstack/react-query";
import { CheckCircle, DownloadSimple, File, FilePdf, Files, MagnifyingGlass, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { fetchDocuments, openDocument, type DocumentRecord } from "../documentRepository";
import { downloadExcel } from "@/utils/exportCsv";

function formatSize(size: number) {
  if (!size) return "Sin peso registrado";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  if (!value) return "Fecha no registrada";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function DocumentGroupCards({ groups, openingId, onOpen }: { groups: DocumentRecord[][]; openingId: string | null; onOpen: (record: DocumentRecord) => void }) {
  return <div className="registry-group-grid" aria-label="Expedientes agrupados">{groups.map((group) => { const first = group[0]; const availableDocs = group.filter((item) => item.hasContent).length; return <article className="registry-group-card" key={`${first.assetCode}-${first.entityCode}-${first.id}`}><header><div><span className="registry-group-kicker">Expediente</span><h3>{first.assetCode || first.entityCode || "Sin bien asociado"}</h3><p>{first.assetCode ? first.entityCode : "Documentos vinculados a este registro"}</p></div><span className="registry-group-count">{group.length} {group.length === 1 ? "documento" : "documentos"}</span></header><div className="registry-group-documents">{group.map((item) => <div className="registry-group-document" key={item.id}><div className="document-name">{item.mimeType.includes("pdf") ? <FilePdf size={20} /> : <File size={20} />}<span><strong>{item.name}</strong><small>{item.sourceLabel} · {formatSize(item.size)}</small></span></div><div className="registry-group-document-action"><span className={`availability ${item.hasContent ? "is-available" : "is-metadata"}`}>{item.hasContent ? "Disponible" : "Solo registro"}</span><button className="table-action" type="button" disabled={!item.hasContent || openingId === item.id} onClick={() => onOpen(item)}>{openingId === item.id ? "Abriendo..." : "Ver"}</button></div></div>)}</div><footer><span>{availableDocs} de {group.length} con copia digital</span><span>{formatDate(first.createdAt)}</span></footer></article>; })}</div>;
}

export function DocumentRegistryPage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("ALL");
  const [availability, setAvailability] = useState("ALL");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const documents = useQuery({ queryKey: ["documents"], queryFn: fetchDocuments });

  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return (documents.data?.results ?? []).filter((item) => {
      const matchesQuery = !normalized || [item.name, item.entityCode, item.assetCode, item.sourceLabel, item.category]
        .join(" ").toLocaleLowerCase("es").includes(normalized);
      return matchesQuery
        && (source === "ALL" || item.source === source)
        && (availability === "ALL" || (availability === "AVAILABLE") === item.hasContent);
    });
  }, [availability, documents.data?.results, query, source]);

  const groups = useMemo(() => {
    const grouped = new Map<string, DocumentRecord[]>();
    rows.forEach((item) => {
      const key = `${item.assetCode || "sin-bien"}|${item.entityCode || item.id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });
    return [...grouped.values()].sort((left, right) => (right.length - left.length) || left[0].name.localeCompare(right[0].name));
  }, [rows]);

  async function handleOpen(record: DocumentRecord) {
    setMessage("");
    setOpeningId(record.id);
    try {
      await openDocument(record);
    } catch {
      setMessage("No existe una copia digital descargable para este registro. El metadato se conserva como parte del expediente.");
    } finally {
      setOpeningId(null);
    }
  }

  function exportDocuments() {
    downloadExcel(`documentos-sgtb-${new Date().toISOString().slice(0, 10)}.xlsx`, ["Documento", "Origen", "Bien", "Expediente", "Registro", "Disponibilidad"], rows.map((item) => [item.name, item.sourceLabel, item.assetCode || "Sin bien", item.entityCode, formatDate(item.createdAt), item.hasContent ? "Archivo disponible" : "Solo registro"]), "Documentos");
  }

  const total = documents.data?.count ?? 0;
  const available = documents.data?.results.filter((item) => item.hasContent).length ?? 0;
  const linkedAssets = new Set(documents.data?.results.map((item) => item.assetCode).filter(Boolean)).size;

  return (
    <section className="registry-page">
      <header className="page-heading registry-heading">
        <div><h1>Gestión documental</h1><p>Consulta evidencias, actas y archivos vinculados al expediente de cada bien.</p></div>
      </header>

      <div className="registry-metrics" aria-label="Resumen documental">
        <div><Files size={22} weight="duotone" /><span><strong>{total}</strong><small>registros documentales</small></span></div>
        <div><CheckCircle size={22} weight="duotone" /><span><strong>{available}</strong><small>con copia digital</small></span></div>
        <div><ShieldCheck size={22} weight="duotone" /><span><strong>{linkedAssets}</strong><small>bienes relacionados</small></span></div>
      </div>

      <section className="registry-workspace" aria-labelledby="document-results-title">
        <div className="registry-toolbar">
          <label className="registry-search"><MagnifyingGlass size={19} /><span className="sr-only">Buscar documentos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, código de bien o expediente" /></label>
          <label><span>Origen</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="ALL">Todos los procesos</option>{Object.entries(documents.data?.sources ?? {}).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>Disponibilidad</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="ALL">Todos</option><option value="AVAILABLE">Con archivo</option><option value="METADATA">Solo registro</option></select></label>
        </div>

        {message && <div className="registry-notice" role="status"><WarningCircle size={20} /><span>{message}</span><button type="button" onClick={() => setMessage("")}>Cerrar</button></div>}

        <div className="registry-result-heading"><div><h2 id="document-results-title">Expedientes encontrados</h2><p>{rows.length} resultado(s) con los filtros actuales</p></div><button className="button button-secondary" type="button" onClick={exportDocuments} disabled={!rows.length}><DownloadSimple size={18} />Exportar Excel</button></div>
        {!documents.isLoading && !documents.isError && rows.length > 0 && <DocumentGroupCards groups={groups} openingId={openingId} onOpen={handleOpen} />}

        {documents.isLoading ? <div className="registry-state" aria-busy="true">Cargando el registro documental...</div> : documents.isError ? <div className="registry-state is-error"><WarningCircle size={28} /><strong>No se pudo consultar Documentos</strong><button className="button button-secondary" type="button" onClick={() => documents.refetch()}>Reintentar</button></div> : rows.length === 0 ? <div className="registry-state"><File size={30} /><strong>No hay documentos para estos criterios</strong><span>Prueba con otro origen o limpia la búsqueda.</span></div> : (
          <div className="registry-table-wrap"><table className="registry-table"><thead><tr><th>Documento</th><th>Proceso</th><th>Bien</th><th>Expediente</th><th>Registro</th><th>Disponibilidad</th><th><span className="sr-only">Acción</span></th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><div className="document-name">{item.mimeType.includes("pdf") ? <FilePdf size={21} /> : <File size={21} />}<span><strong>{item.name}</strong><small>{formatSize(item.size)}</small></span></div></td><td>{item.sourceLabel}</td><td><strong>{item.assetCode || "Sin bien"}</strong></td><td>{item.entityCode}</td><td>{formatDate(item.createdAt)}</td><td><span className={`availability ${item.hasContent ? "is-available" : "is-metadata"}`}>{item.hasContent ? "Archivo disponible" : "Solo registro"}</span></td><td><button className="table-action" type="button" disabled={!item.hasContent || openingId === item.id} onClick={() => handleOpen(item)}>{openingId === item.id ? "Abriendo..." : "Ver"}</button></td></tr>)}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
