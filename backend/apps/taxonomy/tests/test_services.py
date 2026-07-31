from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Taxonomy, TaxonomySequence
from apps.taxonomy.services import allocate_fm_identifier, sync_taxonomy_catalog


class TaxonomySequenceServiceTests(TestCase):
    def test_sequence_change_rolls_back_with_enclosing_transaction(self):
        taxonomy = Taxonomy.objects.get(prefix="IM")
        before = taxonomy.sequence.last_value
        with self.assertRaises(RuntimeError), transaction.atomic():
            allocate_fm_identifier(taxonomy)
            raise RuntimeError("rollback")
        taxonomy.sequence.refresh_from_db()
        self.assertEqual(taxonomy.sequence.last_value, before)

    def test_different_prefixes_keep_independent_sequences(self):
        im = Taxonomy.objects.get(prefix="IM")
        rad = Taxonomy.objects.get(prefix="RAD")
        im_code, im_value = allocate_fm_identifier(im)
        rad_code, rad_value = allocate_fm_identifier(rad)
        self.assertEqual(im_code, "IM-0013")
        self.assertEqual(im_value, 13)
        self.assertEqual(rad_code, "RAD-013")
        self.assertEqual(rad_value, 13)

    def test_review_taxonomy_cannot_issue_codes(self):
        taxonomy = Taxonomy.objects.get(prefix="IM")
        taxonomy.review_status = Taxonomy.ReviewStatus.REVIEW
        taxonomy.issuance_enabled = False
        taxonomy.save(update_fields=("review_status", "issuance_enabled", "updated_at"))
        with self.assertRaises(ValidationError):
            allocate_fm_identifier(taxonomy)


class PostgreSQLTaxonomyConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        sync_taxonomy_catalog()

    @skipUnless(
        connection.vendor == "postgresql",
        "El bloqueo concurrente select_for_update se certifica con PostgreSQL.",
    )
    def test_concurrent_allocations_are_unique_and_contiguous(self):
        taxonomy_id = Taxonomy.objects.get(prefix="IM").id

        def allocate_one(_):
            close_old_connections()
            try:
                taxonomy = Taxonomy.objects.get(pk=taxonomy_id)
                return allocate_fm_identifier(taxonomy)
            finally:
                # Worker-thread connections outlive close_old_connections() when
                # CONN_MAX_AGE is enabled and otherwise prevent test DB teardown.
                connection.close()

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(allocate_one, range(20)))

        codes = {code for code, _ in results}
        values = sorted(value for _, value in results)
        self.assertEqual(len(codes), 20)
        self.assertEqual(values, list(range(13, 33)))


class PostgreSQLTaxonomyUpdateConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        user = get_user_model().objects.create_user(username="taxonomy-race-admin")
        AccountProfile.objects.create(
            user=user,
            worker_code="TAXONOMY-RACE-ADMIN",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.admin_id = user.id

    @skipUnless(
        connection.vendor == "postgresql",
        "La carrera entre edición y emisión requiere bloqueos reales de PostgreSQL.",
    )
    def test_prefix_update_and_code_issuance_keep_one_consistent_prefix(self):
        for index in range(5):
            old_prefix = f"ZX{index}"
            new_prefix = f"ZY{index}"
            taxonomy = Taxonomy.objects.create(
                prefix=old_prefix,
                canonical_prefix=old_prefix,
                name=f"Prueba de carrera {index}",
                asset_type="Equipo",
                category="Prueba",
                subcategory="Prueba",
                specialty="FM",
            )
            TaxonomySequence.objects.create(taxonomy=taxonomy)
            start = Barrier(2)

            def issue_code(barrier=start, current_taxonomy_id=taxonomy.id):
                close_old_connections()
                try:
                    barrier.wait()
                    current = Taxonomy.objects.get(pk=current_taxonomy_id)
                    code, _ = allocate_fm_identifier(current)
                    return code
                finally:
                    connection.close()

            def update_prefix(
                barrier=start,
                current_taxonomy_id=taxonomy.id,
                target_prefix=new_prefix,
            ):
                close_old_connections()
                try:
                    client = APIClient()
                    client.force_authenticate(
                        get_user_model().objects.get(pk=self.admin_id)
                    )
                    barrier.wait()
                    response = client.patch(
                        f"/api/v1/taxonomies/{current_taxonomy_id}/",
                        {"prefix": target_prefix},
                        format="json",
                    )
                    return response.status_code
                finally:
                    connection.close()

            with ThreadPoolExecutor(max_workers=2) as executor:
                issue_future = executor.submit(issue_code)
                update_future = executor.submit(update_prefix)
                code = issue_future.result()
                update_status = update_future.result()

            taxonomy.refresh_from_db()
            self.assertIn(update_status, {200, 400})
            self.assertEqual(code.rsplit("-", 1)[0], taxonomy.prefix)
            self.assertEqual(
                taxonomy.prefix,
                new_prefix if update_status == 200 else old_prefix,
            )
