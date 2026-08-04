import { ArrowCounterClockwise, Crosshair, MapPin, WarningCircle } from "@phosphor-icons/react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useLocationMapImage } from "../locationMapQueries";
import type { LocationMapSummary } from "../locationMapTypes";

type MarkerStyle = CSSProperties & {
  "--location-marker-x": string;
  "--location-marker-y": string;
};

interface LocationMarkerPickerProps {
  locationName: string;
  locationMap: LocationMapSummary;
  markerX: number | null;
  markerY: number | null;
  error?: string;
  subjectLabel?: string;
  onChange: (x: number | null, y: number | null) => void;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function LocationMarkerPicker({
  locationName,
  locationMap,
  markerX,
  markerY,
  error,
  subjectLabel = "bien",
  onChange,
}: LocationMarkerPickerProps) {
  const imageQuery = useLocationMapImage(locationMap.id);
  const hasMarker = markerX !== null && markerY !== null;

  function placeFromPointer(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) {
      if (!hasMarker) onChange(0.5, 0.5);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    onChange(
      clamp((event.clientX - bounds.left) / bounds.width),
      clamp((event.clientY - bounds.top) / bounds.height),
    );
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.01;
    let nextX = markerX ?? 0.5;
    let nextY = markerY ?? 0.5;
    if (event.key === "ArrowLeft") nextX -= step;
    if (event.key === "ArrowRight") nextX += step;
    if (event.key === "ArrowUp") nextY -= step;
    if (event.key === "ArrowDown") nextY += step;
    onChange(clamp(nextX), clamp(nextY));
  }

  const markerStyle: MarkerStyle | undefined = hasMarker
    ? {
        "--location-marker-x": `${markerX * 100}%`,
        "--location-marker-y": `${markerY * 100}%`,
      }
    : undefined;

  return (
    <section className={`location-marker-picker ${error ? "has-error" : ""}`}>
      <header>
        <div>
          <span>Imagen referencial · versión {locationMap.version}</span>
          <strong>{locationName}</strong>
        </div>
        {hasMarker && (
          <button type="button" onClick={() => onChange(null, null)}>
            <ArrowCounterClockwise /> Quitar marcador
          </button>
        )}
      </header>

      {imageQuery.isPending ? (
        <div className="location-map-skeleton" aria-label="Cargando imagen del ambiente" />
      ) : imageQuery.isError || !imageQuery.data ? (
        <div className="location-map-load-error" role="alert">
          <WarningCircle />
          <span>No se pudo cargar la imagen protegida del ambiente.</span>
          <button type="button" onClick={() => imageQuery.refetch()}>Reintentar</button>
        </div>
      ) : (
        <button
          className="location-marker-stage"
          type="button"
          aria-label={
            hasMarker
              ? `Cambiar la posición del ${subjectLabel} en el ambiente`
              : `Colocar el ${subjectLabel} en la imagen del ambiente`
          }
          aria-describedby="location-marker-help"
          onClick={placeFromPointer}
          onKeyDown={moveWithKeyboard}
        >
          <img src={imageQuery.data} alt={`Referencia visual de ${locationName}`} draggable={false} />
          {hasMarker && (
            <span className="location-asset-pin" style={markerStyle} aria-hidden="true">
              <MapPin weight="fill" />
              <i />
            </span>
          )}
        </button>
      )}

      <footer id="location-marker-help">
        <Crosshair weight="duotone" />
        <span>
          {hasMarker
            ? "Posición definida. Haz clic en otro punto o usa las flechas para ajustarla."
            : `Haz clic sobre la imagen para indicar dónde ocurrió el ${subjectLabel}.`}
        </span>
      </footer>
      {error && <small className="field-error"><WarningCircle />{error}</small>}
    </section>
  );
}
