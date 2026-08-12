from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.assets.models import (
    Asset,
    AssetAssignment,
    AssignableResponsible,
    Taxonomy,
)
from apps.audit.models import AuditEvent
from apps.lifecycle.models import RetirementRequest, TechnicalDiagnosis


class AssetEntryApiTests(TestCase):
    def setUp(self):
        call_command('seed_demo_data', verbosity=0)
        self.client = APIClient()
        self.admin = get_user_model().objects.get(username='admin')
        self.client.force_authenticate(self.admin)

    def test_seed_is_idempotent_and_list_uses_database(self):
        before = dict(Asset.objects.values_list('code', 'fm_code'))
        call_command('seed_demo_data', verbosity=0)
        response = self.client.get('/api/v1/assets/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 31)
        self.assertEqual(Asset.objects.count(), 31)
        self.assertEqual(before, dict(Asset.objects.values_list('code', 'fm_code')))
        self.assertEqual(Asset.objects.filter(fm_code__isnull=True).count(), 1)
        self.assertTrue(all(
            int(code.rsplit('-', 1)[-1]) > {'IM': 12, 'SL': 774, 'ME': 590}[prefix]
            for prefix in ('IM', 'SL', 'ME')
            for code in Asset.objects.filter(
                taxonomy__prefix=prefix,
            ).values_list('fm_code', flat=True)
        ))
        self.assertEqual(
            Asset.objects.filter(name__icontains='Laptop').first().taxonomy.prefix,
            'LAP',
        )
        self.assertEqual(
            Asset.objects.filter(name__icontains='Impresora').first().taxonomy.prefix,
            'IM',
        )
        self.assertEqual(
            Asset.objects.filter(name__icontains='Silla').first().taxonomy.prefix,
            'SL',
        )
        self.assertEqual(Taxonomy.objects.filter(source_version='DEMO').count(), 14)
        self.assertEqual(TechnicalDiagnosis.objects.count(), 2)
        self.assertEqual(RetirementRequest.objects.count(), 2)
        self.assertGreaterEqual(AuditEvent.objects.count(), 20)
        self.assertFalse(AssetAssignment.objects.filter(start_date__gt=timezone.now()).exists())

    def test_create_asset_does_not_create_assignment_even_with_legacy_payload(self):
        responsible = AssignableResponsible.objects.get(external_reference='P-0142')
        response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Equipo de prueba integrado',
            'description': 'Registro enviado por el frontend',
            'brand': 'Test',
            'model': 'API-1',
            'condition': 'Nuevo',
            'entry_payload': {
                'assigneeId': responsible.external_reference,
                'assignmentReason': 'Asignación inicial',
                'classificationPending': True,
                'locationPending': True,
            },
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        self.assertTrue(response.json()['code'].startswith('INC-BIEN-'))
        self.assertEqual(response.json()['assignment_status'], 'Sin asignar')
        self.assertEqual(AssetAssignment.objects.filter(asset_id=response.json()['id']).count(), 0)

    def test_public_endpoint_excludes_sensitive_fields(self):
        asset = Asset.objects.filter(fm_code__isnull=False).order_by('code').first()
        self.assertIsNotNone(asset)
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/v1/public/assets/{asset.public_token}/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('serial_number', response.json())
        self.assertNotIn('entry_payload', response.json())
        self.assertNotIn('registered_by_name', response.json())
        self.assertNotIn('fm_code', response.json())
        self.assertEqual(response.json()['code'], asset.fm_code)
        self.assertEqual(response.json()['display_code'], asset.fm_code)
        self.assertIsNone(response.json()['admin_edit_id'])

    def test_public_endpoint_exposes_edit_shortcut_only_to_administrator(self):
        asset = Asset.objects.filter(fm_code__isnull=False).order_by('code').first()
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/v1/public/assets/{asset.public_token}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['admin_edit_id'], str(asset.id))

    def test_public_endpoint_uses_technical_code_while_classification_is_pending(self):
        asset = Asset.objects.filter(fm_code__isnull=True).order_by('code').first()
        self.assertIsNotNone(asset)

        response = self.client.get(f'/api/v1/public/assets/{asset.public_token}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['code'], asset.code)
        self.assertEqual(response.json()['display_code'], asset.code)

    def test_taxonomy_id_generates_next_ordered_fm_code(self):
        taxonomy = Taxonomy.objects.get(prefix='IM')
        previous = taxonomy.sequence.last_value
        response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Impresora de prueba',
            'description': 'Registro con taxonomía maestra.',
            'condition': 'Nuevo',
            'taxonomy_id': str(taxonomy.id),
            'entry_payload': {
                'classificationPending': False,
                'locationPending': True,
            },
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()['fm_code'], f'IM-{previous + 1:04d}')
        self.assertEqual(response.json()['display_code'], response.json()['fm_code'])
        self.assertTrue(response.json()['code'].startswith('INC-BIEN-'))
        taxonomy.sequence.refresh_from_db()
        self.assertEqual(taxonomy.sequence.last_value, previous + 1)

    def test_pending_asset_is_classified_once_without_changing_qr_identity(self):
        taxonomy = Taxonomy.objects.get(prefix='IM')
        response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Bien por clasificar',
            'description': 'Registro pendiente.',
            'condition': 'Bueno',
            'taxonomy_id': str(taxonomy.id),
            'entry_payload': {
                'classificationPending': True,
                'locationPending': True,
            },
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        asset_id = response.json()['id']
        technical_code = response.json()['code']
        public_token = response.json()['public_token']
        self.assertIsNone(response.json()['fm_code'])
        self.assertIsNone(response.json()['taxonomy_detail'])

        previous = taxonomy.sequence.last_value
        response = self.client.post(
            f'/api/v1/assets/{asset_id}/classify/',
            {'taxonomy_id': str(taxonomy.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()['code'], technical_code)
        self.assertEqual(response.json()['public_token'], public_token)
        self.assertEqual(response.json()['fm_code'], f'IM-{previous + 1:04d}')
        assigned_code = response.json()['fm_code']

        repeated = self.client.post(
            f'/api/v1/assets/{asset_id}/classify/',
            {'taxonomy_id': str(taxonomy.id)},
            format='json',
        )
        self.assertEqual(repeated.status_code, 200, repeated.json())
        self.assertEqual(repeated.json()['fm_code'], assigned_code)
        taxonomy.sequence.refresh_from_db()
        self.assertEqual(taxonomy.sequence.last_value, previous + 1)

        other = Taxonomy.objects.get(prefix='SL')
        rejected = self.client.post(
            f'/api/v1/assets/{asset_id}/classify/',
            {'taxonomy_id': str(other.id)},
            format='json',
        )
        self.assertEqual(rejected.status_code, 400)

    def test_asset_search_accepts_fm_code(self):
        asset = Asset.objects.exclude(fm_code__isnull=True).first()
        response = self.client.get('/api/v1/assets/', {'search': asset.fm_code})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['id'] for row in response.json()], [str(asset.id)])

    def test_asset_list_filters_pending_fm_code_and_taxonomy(self):
        pending_response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Bien pendiente para filtros',
            'description': 'Sin código FM todavía.',
            'condition': 'Bueno',
            'entry_payload': {
                'classificationPending': True,
                'locationPending': True,
            },
        }, format='json')
        self.assertEqual(pending_response.status_code, 201, pending_response.json())
        pending_id = pending_response.json()['id']

        response = self.client.get('/api/v1/assets/', {'classification_pending': 'true'})
        self.assertEqual(response.status_code, 200)
        expected_pending_ids = {
            str(asset_id)
            for asset_id in Asset.objects.filter(fm_code__isnull=True).values_list(
                'id', flat=True,
            )
        }
        self.assertIn(pending_id, expected_pending_ids)
        self.assertEqual(
            {row['id'] for row in response.json()},
            expected_pending_ids,
        )

        response = self.client.get('/api/v1/assets/', {'classification_pending': 'false'})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(pending_id, [row['id'] for row in response.json()])
        self.assertTrue(all(row['fm_code'] for row in response.json()))

        response = self.client.get('/api/v1/assets/', {'has_fm_code': 'false'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {row['id'] for row in response.json()},
            expected_pending_ids,
        )

        response = self.client.get('/api/v1/assets/', {'has_fm_code': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(pending_id, [row['id'] for row in response.json()])
        self.assertTrue(all(row['fm_code'] for row in response.json()))

        taxonomy = Taxonomy.objects.get(prefix='IM')
        response = self.client.get('/api/v1/assets/', {'taxonomy_id': str(taxonomy.id)})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json())
        self.assertTrue(all(
            row['taxonomy_detail']['id'] == str(taxonomy.id)
            for row in response.json()
        ))

    def test_asset_list_validates_boolean_uuid_and_ordering_filters(self):
        for params, field in (
            ({'classification_pending': 'yes'}, 'classification_pending'),
            ({'has_fm_code': '1'}, 'has_fm_code'),
            ({'taxonomy_id': 'no-es-uuid'}, 'taxonomy_id'),
            ({'ordering': 'registered_by'}, 'ordering'),
            ({'ordering': '--created_at'}, 'ordering'),
        ):
            with self.subTest(params=params):
                response = self.client.get('/api/v1/assets/', params)
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())

        response = self.client.get('/api/v1/assets/', {'ordering': 'name'})
        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in response.json()]
        self.assertEqual(names, sorted(names))

        response = self.client.get('/api/v1/assets/', {'ordering': '-code'})
        self.assertEqual(response.status_code, 200)
        codes = [row['code'] for row in response.json()]
        self.assertEqual(codes, sorted(codes, reverse=True))

    def test_only_administrator_can_issue_fm_code_for_pending_asset(self):
        pending_response = self.client.post('/api/v1/assets/', {
            'entry_type': 'purchase',
            'name': 'Bien pendiente protegido',
            'description': 'La clasificación requiere rol administrador.',
            'condition': 'Bueno',
            'entry_payload': {
                'classificationPending': True,
                'locationPending': True,
            },
        }, format='json')
        self.assertEqual(pending_response.status_code, 201, pending_response.json())
        asset = Asset.objects.get(pk=pending_response.json()['id'])
        technical_code = asset.code
        public_token = asset.public_token
        taxonomy = Taxonomy.objects.get(prefix='IM')
        previous = taxonomy.sequence.last_value

        technician_client = APIClient()
        technician_client.force_authenticate(
            get_user_model().objects.get(username='tecnico')
        )
        forbidden = technician_client.post(
            f'/api/v1/assets/{asset.id}/classify/',
            {'taxonomy_id': str(taxonomy.id)},
            format='json',
        )
        self.assertEqual(forbidden.status_code, 403)
        asset.refresh_from_db()
        taxonomy.sequence.refresh_from_db()
        self.assertIsNone(asset.fm_code)
        self.assertIsNone(asset.taxonomy_id)
        self.assertEqual(taxonomy.sequence.last_value, previous)

        response = self.client.post(
            f'/api/v1/assets/{asset.id}/classify/',
            {'taxonomy_id': str(taxonomy.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()['fm_code'], f'IM-{previous + 1:04d}')
        self.assertEqual(response.json()['code'], technical_code)
        self.assertEqual(response.json()['public_token'], public_token)
        taxonomy.sequence.refresh_from_db()
        self.assertEqual(taxonomy.sequence.last_value, previous + 1)

    def test_administrator_can_edit_asset_without_changing_assignment(self):
        asset = Asset.objects.filter(assignments__status='ACTIVA').first()
        assignment_id = asset.assignments.get(status='ACTIVA').id
        response = self.client.patch(
            f'/api/v1/assets/{asset.id}/',
            {
                'name': 'Bien actualizado desde ficha',
                'condition': 'Bueno',
                'criticality': 'Alta',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()['name'], 'Bien actualizado desde ficha')
        self.assertEqual(response.json()['condition'], 'Bueno')
        self.assertEqual(response.json()['criticality'], 'Alta')
        self.assertTrue(asset.assignments.filter(id=assignment_id, status='ACTIVA').exists())

    def test_frontend_origin_header_is_allowed_by_cors(self):
        response = self.client.options(
            '/api/v1/assets/',
            HTTP_ORIGIN='http://127.0.0.1:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type,x-frontend-origin',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('x-frontend-origin', response['access-control-allow-headers'])
