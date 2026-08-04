from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset


class DocumentRegistryTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="docs-admin", password="test")
        AccountProfile.objects.create(
            user=self.user,
            worker_code="DOC-ADMIN",
            role=AccountProfile.Role.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.asset = Asset.objects.create(
            code="INC-BIEN-2026-999901",
            entry_type=Asset.EntryType.PURCHASE,
            name="Bien documental",
            description="Bien para validar el registro documental.",
            condition="Bueno",
            entry_payload={
                "evidence": [{
                    "id": "doc-1",
                    "name": "orden-compra.pdf",
                    "category": "origin",
                    "mimeType": "application/pdf",
                    "size": 4,
                    "dataUrl": "data:application/pdf;base64,VEVTVA==",
                }]
            },
            registered_by=self.user,
        )

    def test_registry_lists_existing_asset_documents(self):
        response = self.client.get("/api/v1/documents/?q=orden-compra")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["entityCode"], self.asset.code)
        self.assertTrue(response.data["results"][0]["hasContent"])

    def test_authenticated_download_returns_original_content(self):
        response = self.client.get(
            f"/api/v1/documents/files/ASSET_ENTRY/{self.asset.id}/0/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"TEST")
        self.assertEqual(response["Content-Type"], "application/pdf")
