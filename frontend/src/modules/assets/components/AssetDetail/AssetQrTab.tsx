import { DownloadSimple, Printer } from "@phosphor-icons/react";
import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { printAssetPdf } from "@/modules/assets/assetDetailRepository";
import { displayCode } from "@/modules/assets/pages/assetDetailUtils";

interface AssetQrTabProps {
  asset: AssetDetailRecord;
  qr: string;
  userName: string | undefined;
}

export function AssetQrTab({ asset, qr, userName }: AssetQrTabProps) {
  return (
    <section className="detail-section qr-record">
      <div>
        <h2>Identificación QR</h2>
        <p>Este código abre la ficha pública segura del bien.</p>
        <strong>{displayCode(asset)}</strong>
        {asset.fm_code && <small>ID técnico: {asset.code}</small>}
      </div>
      {qr && <img src={qr} alt={`Código QR de ${displayCode(asset)}`} />}
      <div className="qr-record-actions">
        <button className="button button-primary" onClick={() => void printAssetPdf(asset.id, "print", userName)}>
          <Printer />
          Imprimir etiqueta
        </button>
        <a className="button button-secondary" href={qr} download={`${displayCode(asset)}-QR.png`}>
          <DownloadSimple />
          Descargar PNG
        </a>
      </div>
    </section>
  );
}
