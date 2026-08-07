import os
f = 'frontend/src/modules/assets/pages/AssetQrInventoryPage.tsx'
lines = open(f, encoding='utf-8').read().split('\n')
before = lines[:61]
after = lines[96:]
mid = """  const path = [
    asset.draft.zone,
    asset.draft.building,
    asset.draft.locationArea,
    asset.draft.room,
  ].filter(Boolean);

  return path.length ? path.join(" / ") : "Ubicación no registrada";
}

function matchesSearch(asset: RegisteredAsset, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  if (!normalizedSearch) return true;

  return [
    asset.code,
    asset.fmCode,
    asset.draft.name,
    asset.draft.brand,
    asset.draft.model,
    getCategory(asset),
    getLocation(asset),
  ]
    .join(" ")
    .toLocaleLowerCase("es")
    .includes(normalizedSearch);
}

async function createQrDataUrl(publicUrl: string, width = 320) {
  return QRCode.toDataURL(publicUrl, {
    width,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

function AssetQrPreview({ asset }: { asset: RegisteredAsset }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl("");
    setFailed(false);

    createQrDataUrl(asset.publicUrl, 220)
      .then((value) => {
        if (active) setDataUrl(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [asset.publicUrl]);

  if (failed) {
    return (
      <span className="qr-inventory-preview-state is-error" role="status">
        <WarningCircle size={24} aria-hidden="true" />
        <span>No se pudo generar el QR</span>
      </span>
    );
  }

  if (!dataUrl) {
    return (
      <span
        className="qr-inventory-preview-state is-loading"
        aria-label={`Generando código QR de ${getAssetDisplayCode(asset)}`}
      >
        <QrCode size={30} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      className="qr-inventory-preview-image"
      src={dataUrl}
      alt={`Código QR del bien ${getAssetDisplayCode(asset)}`}
      loading="lazy"
    />
  );
}"""
open(f, 'w', encoding='utf-8').write('\n'.join(before) + '\n' + mid + '\n' + '\n'.join(after))
