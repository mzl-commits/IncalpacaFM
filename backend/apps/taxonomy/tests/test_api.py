from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Taxonomy, TaxonomySequence
from apps.audit.models import AuditEvent
from apps.taxonomy.serializers import TaxonomySerializer
from apps.taxonomy.views import TaxonomyDetailView


class TaxonomyCatalogApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(username="catalog-admin")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="CAT-ADMIN",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = user_model.objects.create_user(username="catalog-tech")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="CAT-TECH",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.client = APIClient()

    def test_migration_seeds_only_47_canonical_prefixes_and_historical_maxima(self):
        self.assertEqual(Taxonomy.objects.filter(prefix__isnull=False).count(), 47)
        expected = {
            "SL": (774, 4),
            "ME": (590, 4),
            "IM": (12, 4),
            "MC": (14, 4),
            "MC1": (14, 4),
            "RK": (28, 4),
            "MN": (15, 4),
            "PI": (35, 4),
            "TR": (2, 4),
            "RAD": (12, 3),
        }
        for prefix, (last_value, digits) in expected.items():
            taxonomy = Taxonomy.objects.get(prefix=prefix)
            self.assertEqual(taxonomy.sequence.last_value, last_value)
            self.assertEqual(taxonomy.sequence_digits, digits)
        self.assertFalse(
            Taxonomy.objects.filter(
                prefix__in=["MD", "MK", "MND", "P", "TP", "SILLA", "SL-G1"]
            ).exists()
        )
        self.assertIn("SLGV", Taxonomy.objects.get(prefix="SL").aliases)
        self.assertEqual(Taxonomy.objects.get(prefix="SL").name, "Familia de sillas")

    def test_authenticated_list_exposes_sequence_contract_and_alias_search(self):
        self.client.force_authenticate(self.technician)
        response = self.client.get("/api/v1/taxonomies/", {"search": "SLGV"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        row = response.json()[0]
        self.assertEqual(row["prefix"], "SL")
        self.assertEqual(row["last_sequence"], 774)
        self.assertEqual(row["next_code_preview"], "SL-0775")
        self.assertIn("asset_count", row)

    def test_technician_reads_but_cannot_write(self):
        self.client.force_authenticate(self.technician)
        self.assertEqual(self.client.get("/api/v1/taxonomies/").status_code, 200)
        response = self.client.post(
            "/api/v1/taxonomies/",
            {
                "prefix": "ZZ",
                "name": "Prueba",
                "asset_type": "Equipamiento",
                "category": "Pruebas",
                "subcategory": "Prueba",
                "specialty": "Facility Management",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_administrator_creates_normalized_prefix_and_delete_is_not_allowed(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/v1/taxonomies/",
            {
                "prefix": "zz1",
                "name": "Taxonomía de prueba",
                "asset_type": "Equipamiento",
                "category": "Pruebas",
                "subcategory": "Prueba",
                "specialty": "Facility Management",
                "sequence_digits": 4,
                "issuance_enabled": True,
                "review_status": "VALIDATED",
                "active": True,
                "aliases": ["Ensayo", "ensayo"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()["prefix"], "ZZ1")
        self.assertEqual(response.json()["aliases"], ["Ensayo"])
        self.assertEqual(response.json()["next_code_preview"], "ZZ1-0001")
        self.assertEqual(
            self.client.delete(
                f"/api/v1/taxonomies/{response.json()['id']}/"
            ).status_code,
            405,
        )

    def test_digits_must_be_between_three_and_eight(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/v1/taxonomies/",
            {
                "prefix": "ZZ",
                "name": "Prueba",
                "asset_type": "Equipamiento",
                "category": "Pruebas",
                "subcategory": "Prueba",
                "specialty": "Facility Management",
                "sequence_digits": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("sequence_digits", response.json())

    def test_prefix_and_digits_are_locked_after_historical_issuance(self):
        self.client.force_authenticate(self.admin)
        taxonomy = Taxonomy.objects.get(prefix="IM")
        response = self.client.patch(
            f"/api/v1/taxonomies/{taxonomy.id}/",
            {"prefix": "IMP", "sequence_digits": 5},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        taxonomy.refresh_from_db()
        self.assertEqual(taxonomy.prefix, "IM")
        self.assertEqual(taxonomy.sequence_digits, 4)

    def test_update_revalidates_with_locked_sequence_and_audits_inside_request(self):
        self.client.force_authenticate(self.admin)
        taxonomy = Taxonomy.objects.get(prefix="IM")
        captured = {}
        original_get_serializer = TaxonomyDetailView.get_serializer

        def capture_context(view, *args, **kwargs):
            captured.update(kwargs.get("context", {}))
            return original_get_serializer(view, *args, **kwargs)

        with patch.object(TaxonomyDetailView, "get_serializer", new=capture_context):
            response = self.client.patch(
                f"/api/v1/taxonomies/{taxonomy.id}/",
                {"name": "Impresora actualizada"},
                format="json",
            )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(captured["locked_sequence_last_value"], 12)
        event = AuditEvent.objects.get(
            action="TAXONOMY_UPDATED", entity_id=str(taxonomy.id)
        )
        self.assertEqual(event.before["name"], taxonomy.name)
        self.assertEqual(event.after["name"], "Impresora actualizada")

    def test_serializer_uses_locked_value_instead_of_stale_relation_cache(self):
        taxonomy = Taxonomy.objects.create(
            prefix="ZZ",
            canonical_prefix="ZZ",
            name="Sin emisiones",
            asset_type="Equipo",
            category="Prueba",
            subcategory="Prueba",
            specialty="FM",
        )
        TaxonomySequence.objects.create(taxonomy=taxonomy, last_value=0)
        stale_taxonomy = Taxonomy.objects.select_related("sequence").get(pk=taxonomy.id)
        TaxonomySequence.objects.filter(taxonomy=taxonomy).update(last_value=1)

        serializer = TaxonomySerializer(
            stale_taxonomy,
            data={"prefix": "ZY"},
            partial=True,
            context={"locked_sequence_last_value": 1},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("prefix", serializer.errors)

    def test_put_remains_supported(self):
        self.client.force_authenticate(self.admin)
        taxonomy = Taxonomy.objects.get(prefix="IM")
        response = self.client.put(
            f"/api/v1/taxonomies/{taxonomy.id}/",
            {
                "prefix": taxonomy.prefix,
                "name": "Impresoras y multifuncionales",
                "asset_type": taxonomy.asset_type,
                "category": taxonomy.category,
                "subcategory": taxonomy.subcategory,
                "specialty": taxonomy.specialty,
                "sequence_digits": taxonomy.sequence_digits,
                "default_criticality": taxonomy.default_criticality,
                "requires_maintenance": taxonomy.requires_maintenance,
                "requires_certification": taxonomy.requires_certification,
                "issuance_enabled": taxonomy.issuance_enabled,
                "review_status": taxonomy.review_status,
                "aliases": taxonomy.aliases,
                "active": taxonomy.active,
                "notes": taxonomy.notes,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["name"], "Impresoras y multifuncionales")

    def test_deactivate_and_activate_are_auditable_actions(self):
        self.client.force_authenticate(self.admin)
        taxonomy = Taxonomy.objects.get(prefix="IM")
        response = self.client.post(f"/api/v1/taxonomies/{taxonomy.id}/deactivate/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["active"])
        self.assertFalse(response.json()["issuance_enabled"])
        response = self.client.post(f"/api/v1/taxonomies/{taxonomy.id}/activate/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["active"])
        self.assertTrue(response.json()["issuance_enabled"])

    def test_issuable_filter_excludes_review_records(self):
        review = Taxonomy.objects.create(
            prefix="ZZ",
            canonical_prefix="ZZ",
            name="Pendiente",
            asset_type="Equipamiento",
            category="Pruebas",
            subcategory="Pendiente",
            specialty="Facility Management",
            active=True,
            issuance_enabled=False,
            review_status=Taxonomy.ReviewStatus.REVIEW,
        )
        TaxonomySequence.objects.create(taxonomy=review)
        self.client.force_authenticate(self.technician)
        response = self.client.get("/api/v1/taxonomies/", {"issuable": "true"})
        self.assertEqual(response.status_code, 200)
        prefixes = {row["prefix"] for row in response.json()}
        self.assertNotIn("ZZ", prefixes)
        self.assertEqual(len(prefixes), 47)
