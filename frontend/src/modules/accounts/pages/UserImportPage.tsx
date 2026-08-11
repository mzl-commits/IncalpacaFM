import { useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { importTechnicians } from "@/modules/accounts/technicianRepository";

export function UserImportPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setMessage("");
    try { const result = await importTechnicians(file); setMessage(`${result.created} usuarios creados, ${result.updated} actualizados${result.errors.length ? ` y ${result.errors.length} con errores.` : "."}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo importar el archivo."); }
    finally { setBusy(false); }
  }
  return <section className="data-panel" style={{ maxWidth: 760, margin: "40px auto", padding: 32 }}><p className="breadcrumb">Administración / Usuarios</p><h1>Importar usuarios por Excel</h1><p>Sube una hoja con las columnas obligatorias <strong>nombre</strong>, <strong>codigo_trabajador</strong> y <strong>dni</strong>. También puedes incluir correo, especialidad y contraseña_temporal.</p><label className="button button-primary"><UploadSimple size={18} />{busy ? "Importando…" : "Seleccionar archivo Excel"}<input hidden type="file" accept=".xlsx,.xlsm" onChange={onFile} /></label>{message && <p role="status" style={{ marginTop: 20 }}>{message}</p>}</section>;
}
