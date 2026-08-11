import { api } from "@/services/api";
import { offlineDb, type OfflineOperation } from "./db";
import { createClientId } from "@/utils/uuid";

export async function queueOperationalSync(input: Omit<OfflineOperation, "id" | "status" | "createdAt" | "idempotencyKey">) {
  const id = createClientId("operation");
  await offlineDb.operations.put({ ...input, id, status: "pending", createdAt: new Date().toISOString(), idempotencyKey: createClientId("idempotency") });
  return id;
}

export async function flushOperationalQueue() {
  if (!navigator.onLine) return;
  const pending = await offlineDb.operations.where("status").anyOf("pending", "failed").toArray();
  for (const item of pending) {
    await offlineDb.operations.update(item.id, { status: "syncing", error: undefined });
    try {
      const form = new FormData(); Object.entries(item.payload).forEach(([key, value]) => form.append(key, typeof value === "string" ? value : JSON.stringify(value)));
      item.files.forEach((file) => form.append("files", file.blob, file.name));
      await api.request({ url: item.endpoint, method: item.method, data: form, headers: { "Content-Type": "multipart/form-data", "Idempotency-Key": item.idempotencyKey, "If-Unmodified-Since": item.baseUpdatedAt ?? "" } });
      await offlineDb.operations.delete(item.id);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      await offlineDb.operations.update(item.id, { status: status === 409 || status === 412 ? "conflict" : "failed", error: status === 409 || status === 412 ? "El registro cambió en el servidor. Revisa antes de reenviar." : "No se pudo sincronizar; se reintentará." });
    }
  }
}

window.addEventListener("online", () => { void flushOperationalQueue(); });
