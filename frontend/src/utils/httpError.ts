type ErrorResponseData = string | unknown[] | Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getResponseData(error: unknown): ErrorResponseData | undefined {
  if (!isRecord(error) || !isRecord(error.response)) return undefined;
  const { data } = error.response;
  if (typeof data === "string" || Array.isArray(data) || isRecord(data)) return data;
  return undefined;
}

function toMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) {
    const messages = value.map(toMessage).filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(" ") : undefined;
  }
  if (isRecord(value)) {
    const messages = Object.values(value).map(toMessage).filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(" ") : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

/** Convierte los errores de red y de API en un mensaje claro para la interfaz. */
export function getApiErrorMessage(
  error: unknown,
  fallback: string,
  preferredFields: readonly string[] = [],
): string {
  const data = getResponseData(error);
  if (typeof data === "string" || Array.isArray(data)) return toMessage(data) ?? fallback;

  if (data) {
    for (const field of [...preferredFields, "detail", "message", "non_field_errors"]) {
      const message = toMessage(data[field]);
      if (message) return message;
    }
    const genericMessage = toMessage(data);
    if (genericMessage) return genericMessage;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
