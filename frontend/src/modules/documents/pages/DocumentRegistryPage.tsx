import { useQuery } from "@tanstack/react-query";
import { CheckCircle, File, FilePdf, Files, MagnifyingGlass, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { fetchDocuments, openDocument, type DocumentRecord } from "../documentRepository";

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

        <div className="registry-result-heading"><div><h2 id="document-results-title">Expedientes encontrados</h2><p>{rows.length} resultado(s) con los filtros actuales</p></div></div>

        {documents.isLoading ? <div className="registry-state" aria-busy="true">Cargando el registro documental...</div> : documents.isError ? <div className="registry-state is-error"><WarningCircle size={28} /><strong>No se pudo consultar Documentos</strong><button className="button button-secondary" type="button" onClick={() => documents.refetch()}>Reintentar</button></div> : rows.length === 0 ? <div className="registry-state"><File size={30} /><strong>No hay documentos para estos criterios</strong><span>Prueba con otro origen o limpia la búsqueda.</span></div> : (
          <div className="registry-table-wrap"><table className="registry-table"><thead><tr><th>Documento</th><th>Proceso</th><th>Bien</th><th>Expediente</th><th>Registro</th><th>Disponibilidad</th><th><span className="sr-only">Acción</span></th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><div className="document-name">{item.mimeType.includes("pdf") ? <FilePdf size={21} /> : <File size={21} />}<span><strong>{item.name}</strong><small>{formatSize(item.size)}</small></span></div></td><td>{item.sourceLabel}</td><td><strong>{item.assetCode || "Sin bien"}</strong></td><td>{item.entityCode}</td><td>{formatDate(item.createdAt)}</td><td><span className={`availability ${item.hasContent ? "is-available" : "is-metadata"}`}>{item.hasContent ? "Archivo disponible" : "Solo registro"}</span></td><td><button className="table-action" type="button" disabled={!item.hasContent || openingId === item.id} onClick={() => handleOpen(item)}>{openingId === item.id ? "Abriendo..." : "Ver"}</button></td></tr>)}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
