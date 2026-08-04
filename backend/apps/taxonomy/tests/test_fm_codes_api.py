from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset, Taxonomy
from apps.taxonomy.services import allocate_fm_identifier


class FMCodeApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(username="fm-code-admin")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="FM-CODE-ADMIN",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = user_model.objects.create_user(username="fm-code-tech")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="FM-CODE-TECH",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.client = APIClient()
        self.im = Taxonomy.objects.get(prefix="IM")
        self.rad = Taxonomy.objects.get(prefix="RAD")

        self.im_one = self._create_issued_asset(
            taxonomy=self.im,
            index=1,
            name="Impresora administrativa",
            brand="Epson",
            operational_status="Operativo",
            assignment_status="Sin asignar",
        )
        self.im_two = self._create_issued_asset(
            taxonomy=self.im,
            index=2,
            name="Impresora de almacén",
            brand="Brother",
            operational_status="En mantenimiento",
            assignment_status="Asignado",
        )
        self.rad_one = self._create_issued_asset(
            taxonomy=self.rad,
            index=3,
            name="Radiador auxiliar",
            brand="Bosch",
            operational_status="Operativo",
            assignment_status="Sin asignar",
        )
        self.pending = Asset.objects.create(
            code="INC-BIEN-2026-900004",
            fm_code=None,
            fm_sequence_value=None,
            taxonomy=None,
            entry_type=Asset.EntryType.PURCHASE,
            name="Equipo por clasificar",
            description="Pendiente de validación taxonómica",
            brand="Acer",
            model="Pending 1",
            condition="Nuevo",
            operational_status="No evaluado",
            assignment_status="Sin asignar",
            entry_payload={"evidence": "x" * 2000},
            registered_by=self.admin,
        )

    def _create_issued_asset(
        self,
        *,
        taxonomy,
        index,
        name,
        brand,
        operational_status,
        assignment_status,
    ):
        fm_code, fm_sequence_value = allocate_fm_identifier(taxonomy)
        return Asset.objects.create(
            code=f"INC-BIEN-2026-90000{index}",
            fm_code=fm_code,
            fm_sequence_value=fm_sequence_value,
            taxonomy=taxonomy,
            entry_type=Asset.EntryType.PURCHASE,
            name=name,
            description="Descripción que no pertenece al listado compacto",
            brand=brand,
            model=f"Modelo {index}",
            condition="Bueno",
            operational_status=operational_status,
            assignment_status=assignment_status,
            entry_payload={"evidence": "x" * 2000},
            registered_by=self.admin,
        )

    def test_endpoints_are_administrator_only(self):
        for url in ("/api/v1/fm-codes/", "/api/v1/fm-codes/summary/"):
            self.client.force_authenticate(user=None)
            self.assertEqual(self.client.get(url).status_code, 401)

            self.client.force_authenticate(self.technician)
            self.assertEqual(self.client.get(url).status_code, 403)

            self.client.force_authenticate(self.admin)
            self.assertEqual(self.client.get(url).status_code, 200)

    def test_list_is_paginated_and_omits_heavy_or_private_fields(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/v1/fm-codes/",
            {"state": "issued", "page_size": 2, "ordering": "fm_code"},
        )
        self.assertEqual(response.status_code, 200, response.json())
        body = response.json()
        self.assertEqual(body["count"], 3)
        self.assertEqual(len(body["results"]), 2)
        self.assertIsNotNone(body["next"])
        row = body["results"][0]
        self.assertEqual(
            set(row),
            {
                "id",
                "code",
                "fm_code",
                "name",
                "brand",
                "model",
                "administrative_status",
                "operational_status",
                "assignment_status",
                "created_at",
                "taxonomy_detail",
            },
        )
        self.assertNotIn("entry_payload", row)
        self.assertNotIn("description", row)
        self.assertNotIn("public_token", row)
        self.assertEqual(
            set(row["taxonomy_detail"]),
            {"id", "prefix", "name", "category", "subcategory"},
        )

    def test_state_search_taxonomy_and_status_filters(self):
        self.client.force_authenticate(self.admin)

        pending = self.client.get("/api/v1/fm-codes/", {"state": "pending"})
        self.assertEqual(pending.status_code, 200)
        self.assertEqual(pending.json()["count"], 1)
        self.assertEqual(pending.json()["results"][0]["id"], str(self.pending.id))

        searched = self.client.get(
            "/api/v1/fm-codes/", {"state": "pending", "search": "Acer"}
        )
        self.assertEqual(searched.json()["count"], 1)

        by_taxonomy = self.client.get(
            "/api/v1/fm-codes/",
            {"state": "issued", "taxonomy_id": str(self.im.id)},
        )
        self.assertEqual(by_taxonomy.json()["count"], 2)
        self.assertTrue(
            all(
                row["taxonomy_detail"]["prefix"] == "IM"
                for row in by_taxonomy.json()["results"]
            )
        )

        by_status = self.client.get(
            "/api/v1/fm-codes/",
            {
                "state": "issued",
                "operational_status": "Operativo",
                "assignment_status": "Sin asignar",
                "ordering": "-name",
            },
        )
        self.assertEqual(by_status.json()["count"], 2)
        self.assertEqual(
            [row["name"] for row in by_status.json()["results"]],
            ["Radiador auxiliar", "Impresora administrativa"],
        )

    def test_invalid_filters_are_rejected_safely(self):
        self.client.force_authenticate(self.admin)
        invalid_queries = (
            {"state": "all"},
            {"taxonomy_id": "not-a-uuid"},
            {"ordering": "entry_payload"},
            {"page_size": "zero"},
            {"page_size": 0},
            {"page_size": 101},
        )
        for query in invalid_queries:
            with self.subTest(query=query):
                response = self.client.get("/api/v1/fm-codes/", query)
                self.assertEqual(response.status_code, 400, response.content)

    def test_summary_matches_catalog_and_filter_option_contract(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/v1/fm-codes/summary/")
        self.assertEqual(response.status_code, 200, response.json())
        body = response.json()
        self.assertEqual(body["issued_count"], 3)
        self.assertEqual(body["pending_count"], 1)
        self.assertEqual(body["taxonomy_count"], 2)
        self.assertEqual(body["unassigned_count"], 2)

        taxonomy_options = {row["prefix"]: row for row in body["taxonomies"]}
        self.assertEqual(taxonomy_options["IM"]["count"], 2)
        self.assertEqual(taxonomy_options["RAD"]["count"], 1)
        self.assertEqual(taxonomy_options["IM"]["value"], str(self.im.id))
        self.assertEqual(
            taxonomy_options["IM"]["label"], f"IM — {self.im.name}"
        )

        operational = {
            row["value"]: row for row in body["operational_statuses"]
        }
        assignment = {row["value"]: row for row in body["assignment_statuses"]}
        self.assertEqual(operational["Operativo"]["count"], 2)
        self.assertNotIn("No evaluado", operational)
        self.assertEqual(assignment["Sin asignar"]["count"], 2)
