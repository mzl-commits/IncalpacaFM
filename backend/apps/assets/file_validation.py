"""Política única para archivos cargados al SGTB."""
import hashlib
from io import BytesIO
from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
DOCUMENT_EXTENSIONS = {".pdf"}
RETENTION_POLICY = "Conservar 5 años desde el cierre del expediente"


def validate_uploaded_file(upload, *, allow_documents=False):
    suffix = Path(upload.name).suffix.lower()
    allowed = IMAGE_EXTENSIONS | (DOCUMENT_EXTENSIONS if allow_documents else set())
    if suffix not in allowed:
        raise ValidationError("Extensión no permitida. Usa JPG, PNG, WEBP o PDF cuando corresponda.")
    if upload.size > MAX_UPLOAD_BYTES:
        raise ValidationError("El archivo supera el límite de 8 MB.")
    content = upload.read()
    upload.seek(0)
    if suffix == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise ValidationError("El contenido cargado no es un PDF válido.")
        detected_mime = "application/pdf"
    else:
        try:
            image = Image.open(BytesIO(content))
            image.verify()
            detected_format = Image.open(BytesIO(content)).format
        except (UnidentifiedImageError, OSError):
            raise ValidationError("El contenido cargado no es una imagen válida.") from None
        expected = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}[suffix]
        if detected_format != expected:
            raise ValidationError("La extensión no coincide con el tipo real del archivo.")
        detected_mime = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}[detected_format]
    upload.seek(0)
    upload.sha256 = hashlib.sha256(content).hexdigest()
    upload.detected_mime = detected_mime
    upload.retention_policy = RETENTION_POLICY
    return upload
