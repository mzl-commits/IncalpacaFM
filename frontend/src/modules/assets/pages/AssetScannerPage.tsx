import { Camera, Image, Keyboard, QrCode, X } from "@phosphor-icons/react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function extractToken(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/\/q\/([^/?#]+)/);
  return decodeURIComponent(match?.[1] ?? trimmed);
}

export function AssetScannerPage() {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const [code, setCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => () => controls.current?.stop(), []);
  function openResult(value: string) {
    const token = extractToken(value);
    if (token) navigate(`/q/${token}`);
  }
  async function startCamera() {
    if (!video.current) return;
    setCameraError(""); setScanning(true);
    try {
      const reader = new BrowserQRCodeReader();
      controls.current = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video.current, (result) => { if (result) { controls.current?.stop(); openResult(result.getText()); } });
    } catch { setCameraError("No fue posible abrir la cámara. Revisa el permiso o usa una imagen/código manual."); setScanning(false); }
  }
  async function readImage(file?: File) {
    if (!file) return;
    try { const url = URL.createObjectURL(file); const result = await new BrowserQRCodeReader().decodeFromImageUrl(url); URL.revokeObjectURL(url); openResult(result.getText()); }
    catch { setCameraError("No encontramos un QR legible en la imagen."); }
  }
  return <main className="main-content scanner-page"><header className="page-heading"><div><p className="breadcrumb">Bienes / Escáner</p><h1>Escanear bien</h1><p>Abre la ficha pública desde la cámara, una imagen o el código del QR.</p></div></header><section className="scanner-shell"><div className="scanner-viewfinder">{scanning ? <video ref={video} muted playsInline /> : <QrCode size={66} weight="duotone" />}<div className="scanner-frame" />{scanning && <button className="scanner-stop" onClick={() => { controls.current?.stop(); setScanning(false); }}><X /> Detener cámara</button>}</div><div className="scanner-actions"><button className="button button-primary" onClick={startCamera}><Camera /> Usar cámara</button><label className="button button-secondary"><Image /> Leer imagen<input type="file" accept="image/*" capture="environment" onChange={(event) => readImage(event.target.files?.[0])} /></label></div>{cameraError && <p className="form-error">{cameraError}</p>}<form className="scanner-manual" onSubmit={(event) => { event.preventDefault(); openResult(code); }}><label><Keyboard /> Código o enlace QR<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Pega el enlace o escribe el identificador" required /></label><button className="button button-secondary">Abrir ficha</button></form><p className="scanner-note">La cámara requiere HTTPS en producción. Si no hay conexión, guarda las evidencias en cola desde la orden de trabajo y sincronízalas al recuperar señal.</p></section></main>;
}
