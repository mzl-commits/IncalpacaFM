import os
import tempfile
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset, FacilityPlan, FacilityPlanMarker, Taxonomy


class FacilityPlanApiTests(TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        storage_root = Path(self.temporary_directory.name)
        self.public_media_root = storage_root / "public"
        self.private_media_root = storage_root / "private"
        self.override_storage = override_settings(
            MEDIA_ROOT=self.public_media_root,
            PRIVATE_MEDIA_ROOT=self.private_media_root,
        )
        self.override_storage.enable()
        self.addCleanup(self.override_storage.disable)

        user_model = get_user_model()
        self.admin = user_model.objects.create_user(username="plan-admin")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="PLAN-ADMIN",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = user_model.objects.create_user(username="plan-technician")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="PLAN-TECH",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.taxonomy = Taxonomy.objects.get(prefix="IM")
        self.other_taxonomy = Taxonomy.objects.get(prefix="RAD")
        self.asset = Asset.objects.create(
            code="INC-BIEN-2026-990001",
            fm_code="IM-9901",
            fm_sequence_value=9901,
            taxonomy=self.taxonomy,
            entry_type=Asset.EntryType.PURCHASE,
            name="Impresora del plano",
            description="Bien de prueba",
            condition="Bueno",
            registered_by=self.admin,
        )
        self.plan = FacilityPlan.objects.create(
            code="PLANTA-01",
            name="Planta principal",
            version="2025.1",
            level_name="Nivel 1",
            source_filename="planta.dwg",
            source_sha256="a" * 64,
            image="facility_plans/planta.svg",
            min_x=Decimal("0"),
            min_y=Decimal("0"),
            max_x=Decimal("100"),
            max_y=Decimal("50"),
            metadata={"source": "LibreDWG"},
        )
        self.exact_marker = self.marker(
            1,
            "IM-9901",
            FacilityPlanMarker.Status.TAXONOMY_ONLY,
            taxonomy=self.taxonomy,
        )
        self.placeholder_marker = self.marker(
            2,
            "IM-XXXX",
            FacilityPlanMarker.Status.PLACEHOLDER,
            taxonomy=self.taxonomy,
        )
        self.other_marker = self.marker(
            3,
            "RAD-9000",
            FacilityPlanMarker.Status.TAXONOMY_ONLY,
            taxonomy=self.other_taxonomy,
        )
        self.client = APIClient()

    def marker(self, index, raw_code, status, *, taxonomy):
        return FacilityPlanMarker.objects.create(
            plan=self.plan,
            source_index=index,
            raw_code=raw_code,
            label=raw_code,
            layer="FM-CODES",
            source_x=Decimal(index * 10),
            source_y=Decimal(index * 5),
            normalized_x=Decimal("0.10000000") * index,
            normalized_y=Decimal("0.90000000") - Decimal("0.10000000") * index,
            taxonomy=taxonomy,
            status=status,
        )

    def test_operational_users_can_read_plans_but_only_administrators_reconcile(self):
        read_endpoints = (
            ("get", "/api/v1/facility-plans/"),
            ("get", f"/api/v1/facility-plans/{self.plan.id}/"),
        )
        for method, url in read_endpoints:
            self.client.force_authenticate(user=None)
            self.assertEqual(getattr(self.client, method)(url).status_code, 401)
            self.client.force_authenticate(self.technician)
            response = getattr(self.client, method)(url)
            self.assertEqual(response.status_code, 200)

        reconcile_url = f"/api/v1/facility-plans/{self.plan.id}/reconcile/"
        self.client.force_authenticate(self.technician)
        self.assertEqual(self.client.post(reconcile_url).status_code, 403)

    def test_list_returns_absolute_image_bounds_and_full_summary(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/v1/facility-plans/")

        self.assertEqual(response.status_code, 200, response.json())
        body = response.json()
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["bounds"]["max_x"], "100.000000")
        self.assertEqual(
            body[0]["image_url"],
            f"http://testserver/api/v1/facility-plans/{self.plan.id}/image/",
        )
        self.assertEqual(
            body[0]["summary"],
            {
                "total": 3,
                "matched": 0,
                "taxonomy_only": 2,
                "placeholder": 1,
                "unknown": 0,
            },
        )

    def test_image_is_private_and_operational_users_can_stream_it(self):
        image_content = (
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
            b'<path d="M0 0H10V10H0Z"/></svg>'
        )
        self.plan.image.save("planta-privada.svg", ContentFile(image_content), save=True)
        image_url = f"/api/v1/facility-plans/{self.plan.id}/image/"

        private_path = Path(self.plan.image.path)
        self.assertTrue(private_path.is_file())
        self.assertTrue(os.path.samefile(private_path.parents[1], self.private_media_root))
        self.assertFalse((self.public_media_root / self.plan.image.name).exists())
        with self.assertRaisesMessage(ValueError, "not accessible via a URL"):
            _ = self.plan.image.url

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(image_url).status_code, 401)
        self.client.force_authenticate(self.technician)
        response = self.client.get(image_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/svg+xml")
        self.assertIn("inline", response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "private, no-store, max-age=0")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["Content-Security-Policy"], "default-src 'none'; sandbox")
        self.assertEqual(response["Cross-Origin-Resource-Policy"], "same-origin")
        self.assertIn("Authorization", response["Vary"])
        self.assertEqual(int(response["Content-Length"]), len(image_content))
        response._resource_closers[0]()

        public_response = self.client.get(f"/media/{self.plan.image.name}")
        self.assertEqual(public_response.status_code, 404)

    def test_optional_filters_limit_plans_and_detail_markers_not_summary(self):
        self.client.force_authenticate(self.admin)
        list_response = self.client.get(
            "/api/v1/facility-plans/",
            {"taxonomy": self.taxonomy.id, "status": "PLACEHOLDER"},
        )
        self.assertEqual(list_response.status_code, 200, list_response.json())
        self.assertEqual([item["id"] for item in list_response.json()], [str(self.plan.id)])

        detail_response = self.client.get(
            f"/api/v1/facility-plans/{self.plan.id}/",
            {"taxonomy": self.taxonomy.id, "status": "PLACEHOLDER"},
        )
        self.assertEqual(detail_response.status_code, 200, detail_response.json())
        body = detail_response.json()
        self.assertEqual([item["raw_code"] for item in body["markers"]], ["IM-XXXX"])
        self.assertEqual(body["summary"]["total"], 3)
        self.assertEqual(body["markers"][0]["taxonomy"]["prefix"], "IM")
        self.assertEqual(body["markers"][0]["normalized"]["x"], "0.20000000")

        empty_response = self.client.get(
            "/api/v1/facility-plans/",
            {"taxonomy": self.other_taxonomy.id, "status": "MATCHED"},
        )
        self.assertEqual(empty_response.status_code, 200)
        self.assertEqual(empty_response.json(), [])

    def test_invalid_filters_are_rejected(self):
        self.client.force_authenticate(self.admin)
        invalid_taxonomy = self.client.get("/api/v1/facility-plans/", {"taxonomy": "not-a-uuid"})
        self.assertEqual(invalid_taxonomy.status_code, 400)
        self.assertIn("taxonomy", invalid_taxonomy.json())

        invalid_status = self.client.get(
            f"/api/v1/facility-plans/{self.plan.id}/", {"status": "BROKEN"}
        )
        self.assertEqual(invalid_status.status_code, 400)
        self.assertIn("status", invalid_status.json())

    def test_reconcile_links_exact_fm_code_and_preserves_placeholder(self):
        self.placeholder_marker.asset = self.asset
        self.placeholder_marker.status = FacilityPlanMarker.Status.MATCHED
        self.placeholder_marker.save(update_fields=("asset", "status"))
        self.client.force_authenticate(self.admin)

        response = self.client.post(f"/api/v1/facility-plans/{self.plan.id}/reconcile/")

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["plan_id"], str(self.plan.id))
        self.assertEqual(response.json()["updated"], 2)
        self.assertEqual(response.json()["summary"]["matched"], 1)
        self.assertEqual(response.json()["summary"]["placeholder"], 1)
        self.exact_marker.refresh_from_db()
        self.placeholder_marker.refresh_from_db()
        self.assertEqual(self.exact_marker.asset_id, self.asset.id)
        self.assertEqual(self.exact_marker.status, FacilityPlanMarker.Status.MATCHED)
        self.assertIsNone(self.placeholder_marker.asset_id)
        self.assertEqual(self.placeholder_marker.status, FacilityPlanMarker.Status.PLACEHOLDER)
