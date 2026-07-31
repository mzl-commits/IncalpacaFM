import base64
import hashlib
from dataclasses import dataclass
from typing import Any
from urllib.parse import unquote_to_bytes

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.assets.models import Asset
from apps.assignments.models import DeliveryEvidence, DeliverySignature
from apps.incidents.models import Incident
from apps.lifecycle.models import RetirementRequest, TechnicalDiagnosis
from apps.workorders.models import WorkOrder

from .serializers import DocumentRegistrySerializer

SOURCE_LABELS = {
    "ASSET_ENTRY": "Entrada de bien",
    "DELIVERY_EVIDENCE": "Acta de entrega",
    "DELIVERY_SIGNATURE": "Firma de entrega",
    "INCIDENT": "Incidencia",
    "WORK_ORDER_PROGRESS": "Orden de trabajo",
    "DIAGNOSIS": "Diagnóstico técnico",
    "DISPOSAL": "Disposición final",
}


@dataclass
class RegistryItem:
    source: str
    entity_id: str
    item_key: str
    name: str
    category: str
    entity_code: str
    asset_code: str
    mime_type: str
    size: int
    created_at: Any
    content: str = ""
    integrity_hash: str = ""

    def as_dict(self) -> dict[str, Any]:
        identity = f"{self.source}:{self.entity_id}:{self.item_key}"
        return {
            "id": hashlib.sha256(identity.encode()).hexdigest()[:24],
            "source": self.source,
            "sourceLabel": SOURCE_LABELS[self.source],
            "entityId": self.entity_id,
            "entityCode": self.entity_code,
            "assetCode": self.asset_code,
            "name": self.name,
            "category": self.category,
            "mimeType": self.mime_type or "application/octet-stream",
            "size": self.size or 0,
            "createdAt": self.created_at,
            "hasContent": bool(self.content),
            "integrityHash": self.integrity_hash,
            "downloadPath": (
                f"/documents/files/{self.source}/{self.entity_id}/{self.item_key}/"
                if self.content
                else None
            ),
        }


def _evidence_values(value: Any) -> list[dict[str, Any]]:
    return value if isinstance(value, list) else []


def _content(item: dict[str, Any]) -> str:
    return str(item.get("dataUrl") or item.get("content_data_url") or "")


def _mime(item: dict[str, Any]) -> str:
    return str(item.get("mimeType") or item.get("mime_type") or "application/octet-stream")


def _size(item: dict[str, Any]) -> int:
    try:
        return int(item.get("size") or 0)
    except (TypeError, ValueError):
        return 0


def build_registry() -> list[RegistryItem]:
    records: list[RegistryItem] = []

    for asset in Asset.objects.only("id", "code", "fm_code", "entry_payload", "created_at"):
        payload = asset.entry_payload if isinstance(asset.entry_payload, dict) else {}
        for index, item in enumerate(_evidence_values(payload.get("evidence"))):
            records.append(RegistryItem(
                "ASSET_ENTRY", str(asset.id), str(index), str(item.get("name") or "Documento de entrada"),
                str(item.get("category") or "other"), asset.fm_code or asset.code,
                asset.fm_code or asset.code, _mime(item), _size(item), asset.created_at, _content(item),
            ))

    evidences = DeliveryEvidence.objects.select_related("act__assignment__asset")
    for item in evidences:
        asset = item.act.assignment.asset
        records.append(RegistryItem(
            "DELIVERY_EVIDENCE", str(item.id), "0", item.name, item.category, item.act.code,
            asset.fm_code or asset.code, item.mime_type, item.size, item.created_at,
            item.content_data_url, item.hash_sha256,
        ))

    signatures = DeliverySignature.objects.select_related("act__assignment__asset")
    for item in signatures:
        asset = item.act.assignment.asset
        records.append(RegistryItem(
            "DELIVERY_SIGNATURE", str(item.id), "0", f"Firma de {item.signer_name}", item.role,
            item.act.code, asset.fm_code or asset.code, "image/png", 0, item.signed_at,
            item.signature_data_url,
        ))

    for incident in Incident.objects.select_related("asset"):
        for index, item in enumerate(_evidence_values(incident.evidence)):
            records.append(RegistryItem(
                "INCIDENT", str(incident.id), str(index), str(item.get("name") or "Evidencia de incidencia"),
                "evidence", incident.code, (incident.asset.fm_code or incident.asset.code) if incident.asset else "",
                _mime(item), _size(item), incident.created_at, _content(item),
            ))

    for order in WorkOrder.objects.select_related("incident__asset"):
        asset = order.incident.asset
        for advance_index, advance in enumerate(_evidence_values(order.advances)):
            if not isinstance(advance, dict):
                continue
            for evidence_index, item in enumerate(_evidence_values(advance.get("evidence"))):
                records.append(RegistryItem(
                    "WORK_ORDER_PROGRESS", str(order.id), f"{advance_index}.{evidence_index}",
                    str(item.get("name") or "Evidencia de avance"), "progress", order.code,
                    (asset.fm_code or asset.code) if asset else "", _mime(item), _size(item),
                    advance.get("createdAt") or order.created_at, _content(item),
                ))

    for diagnosis in TechnicalDiagnosis.objects.select_related("asset"):
        for index, item in enumerate(_evidence_values(diagnosis.evidence)):
            item = item if isinstance(item, dict) else {"name": str(item)}
            records.append(RegistryItem(
                "DIAGNOSIS", str(diagnosis.id), str(index), str(item.get("name") or "Evidencia técnica"),
                "technical", diagnosis.work_order_code, diagnosis.asset.fm_code or diagnosis.asset.code,
                _mime(item), _size(item), diagnosis.created_at, _content(item),
            ))

    for request in RetirementRequest.objects.select_related("asset"):
        disposal = request.disposal if isinstance(request.disposal, dict) else {}
        for index, item in enumerate(_evidence_values(disposal.get("evidence"))):
            item = item if isinstance(item, dict) else {"name": str(item)}
            records.append(RegistryItem(
                "DISPOSAL", str(request.id), str(index), str(item.get("name") or "Acta de disposición"),
                "disposal", request.code, request.asset.fm_code or request.asset.code,
                _mime(item), _size(item), request.updated_at, _content(item),
            ))

    return records


class DocumentRegistryView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(responses=DocumentRegistrySerializer)
    def get(self, request):
        records = build_registry()
        query = request.query_params.get("q", "").strip().casefold()
        source = request.query_params.get("source", "").strip().upper()
        if source:
            records = [item for item in records if item.source == source]
        if query:
            records = [
                item for item in records
                if query in " ".join((item.name, item.entity_code, item.asset_code, item.category)).casefold()
            ]
        records.sort(key=lambda item: str(item.created_at), reverse=True)
        payload = [item.as_dict() for item in records[:1000]]
        return Response({"count": len(payload), "results": payload, "sources": SOURCE_LABELS})


def _decode_data_url(data_url: str) -> tuple[str, bytes]:
    if not data_url.startswith("data:") or "," not in data_url:
        raise ValueError("El documento no contiene datos descargables.")
    header, encoded = data_url.split(",", 1)
    mime_type = header[5:].split(";", 1)[0] or "application/octet-stream"
    if ";base64" in header:
        return mime_type, base64.b64decode(encoded)
    return mime_type, unquote_to_bytes(encoded)


def _resolve_content(source: str, entity_id, item_key: str) -> tuple[str, str]:
    if source == "ASSET_ENTRY":
        owner = get_object_or_404(Asset, pk=entity_id)
        item = _evidence_values(owner.entry_payload.get("evidence"))[int(item_key)]
        return str(item.get("name") or "documento"), _content(item)
    if source == "INCIDENT":
        owner = get_object_or_404(Incident, pk=entity_id)
        item = _evidence_values(owner.evidence)[int(item_key)]
        return str(item.get("name") or "evidencia"), _content(item)
    if source == "DELIVERY_EVIDENCE":
        item = get_object_or_404(DeliveryEvidence, pk=entity_id)
        return item.name, item.content_data_url
    if source == "DELIVERY_SIGNATURE":
        item = get_object_or_404(DeliverySignature, pk=entity_id)
        return f"firma-{item.signer_name}.png", item.signature_data_url
    if source == "WORK_ORDER_PROGRESS":
        owner = get_object_or_404(WorkOrder, pk=entity_id)
        advance_index, evidence_index = (int(value) for value in item_key.split(".", 1))
        item = _evidence_values(_evidence_values(owner.advances)[advance_index].get("evidence"))[evidence_index]
        return str(item.get("name") or "evidencia"), _content(item)
    if source == "DIAGNOSIS":
        owner = get_object_or_404(TechnicalDiagnosis, pk=entity_id)
        item = _evidence_values(owner.evidence)[int(item_key)]
        item = item if isinstance(item, dict) else {"name": str(item)}
        return str(item.get("name") or "evidencia"), _content(item)
    if source == "DISPOSAL":
        owner = get_object_or_404(RetirementRequest, pk=entity_id)
        disposal = owner.disposal if isinstance(owner.disposal, dict) else {}
        item = _evidence_values(disposal.get("evidence"))[int(item_key)]
        item = item if isinstance(item, dict) else {"name": str(item)}
        return str(item.get("name") or "evidencia"), _content(item)
    raise ValueError("Origen documental no válido.")


class DocumentDownloadView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(responses={200: OpenApiTypes.BINARY})
    def get(self, request, source, entity_id, item_key):
        try:
            filename, content = _resolve_content(source, entity_id, item_key)
            mime_type, decoded = _decode_data_url(content)
        except (IndexError, KeyError, TypeError, ValueError, base64.binascii.Error):
            return Response({"detail": "El contenido del documento no está disponible."}, status=404)
        response = HttpResponse(decoded, content_type=mime_type)
        response["Content-Disposition"] = f'inline; filename="{filename.replace(chr(34), "")}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response
